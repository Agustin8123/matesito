const fs = require('fs');
const jwt = require('jsonwebtoken');
const { readVisible } = require('./notifications');

module.exports = function mountPush(app, { db, requireAuth, getToken, secret }) {
 let credentials;
 if (process.env.FIREBASE_SERVICE_ACCOUNT_FILE) {
  credentials = JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_FILE, 'utf8'));
  if (!credentials.project_id || !credentials.client_email || !credentials.private_key) throw new Error('Configuración de Firebase incompleta');
 }
 app.get('/api/push/config', (_req,res) => res.json({ enabled: Boolean(credentials) }));
 const validToken = token => typeof token === 'string' && /^[A-Za-z0-9_:.-]{20,4096}$/.test(token);
 app.post('/api/push/devices', requireAuth, async (req,res,next) => {
  if (!validToken(req.body.token)) return res.status(400).json({ error:'Dispositivo inválido.' });
  try {
   const claims=jwt.verify(getToken(req),secret,{algorithms:['HS256']});
   if (!Number.isFinite(claims.exp)) return res.status(401).json({error:'Volvé a iniciar sesión.'});
   await db.query(`INSERT INTO push_devices(token,user_id,auth_version,expires_at) VALUES($1,$2,$3,$4)
    ON CONFLICT(token) DO UPDATE SET user_id=EXCLUDED.user_id,auth_version=EXCLUDED.auth_version,expires_at=EXCLUDED.expires_at,updated_at=now()`,
    [req.body.token,req.user.id,req.user.auth_version,new Date(claims.exp*1000)]);
   await db.query('DELETE FROM push_devices WHERE user_id=$1 AND token IN (SELECT token FROM push_devices WHERE user_id=$1 ORDER BY updated_at DESC OFFSET 10)',[req.user.id]);
   res.json({enabled:Boolean(credentials)});
  } catch(error){next(error);}
 });
 app.delete('/api/push/devices',requireAuth,async(req,res,next)=>{
  try {await db.query('DELETE FROM push_devices WHERE token=$1 AND user_id=$2',[req.body.token,req.user.id]);res.json({message:'Dispositivo desconectado.'});}catch(error){next(error);}
 });
 if(!credentials)return ()=>{};

 let accessToken,expires=0,refreshing,running=false,stopped=false;
 async function authorize() {
  if(accessToken && Date.now()<expires)return accessToken;
  if(refreshing)return refreshing;
  refreshing=(async()=>{
   const assertion=jwt.sign({scope:'https://www.googleapis.com/auth/firebase.messaging'},credentials.private_key,{algorithm:'RS256',issuer:credentials.client_email,audience:'https://oauth2.googleapis.com/token',expiresIn:'1h'});
   const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}),signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw new Error('Firebase no autorizó el envío');
   const payload=await response.json();accessToken=payload.access_token;expires=Date.now()+(Number(payload.expires_in)-120)*1000;return accessToken;
  })().finally(()=>{refreshing=null;});return refreshing;
 }
 async function send(device,notification) {
  const publicPost=/^(?:F-)?[1-9]\d*$/.test(notification.referencia_id);
  const title=notification.tipo==='anuncio'?notification.announcement_title:'Matesito';
  const body=notification.tipo==='anuncio'?notification.announcement_body:notification.tipo==='reaccion'?'Recibiste una reacción.':'Tenés un mensaje nuevo en tu ronda.';
  const url=publicPost?'/p/'+notification.referencia_id:'/#notificaciones';
  const response=await fetch('https://fcm.googleapis.com/v1/projects/'+encodeURIComponent(credentials.project_id)+'/messages:send',{
   method:'POST',headers:{Authorization:'Bearer '+await authorize(),'Content-Type':'application/json'},signal:AbortSignal.timeout(10000),
   body:JSON.stringify({message:{token:device.token,data:{title:String(title).slice(0,120),body:String(body).slice(0,220),url,userId:String(device.user_id),notificationId:String(notification.id)},android:{priority:'high',ttl:'3600s',collapse_key:'notification-'+notification.id}}})
  });
  if(response.ok)return;
  const data=await response.json().catch(()=>({}));
  if(data.error?.details?.some(detail=>detail.errorCode==='UNREGISTERED')){await db.query('DELETE FROM push_devices WHERE token=$1',[device.token]);return;}
  if(response.status===401){accessToken=null;expires=0;}
  throw new Error('Envío push pendiente');
 }
 async function tick() {
  if(running||stopped)return;running=true;
  try {
   const jobs=(await db.query(`UPDATE push_jobs SET available_at=now()+interval '2 minutes'
    WHERE notification_id IN (SELECT notification_id FROM push_jobs WHERE available_at<=now() ORDER BY available_at LIMIT 1 FOR UPDATE SKIP LOCKED)
    RETURNING notification_id,revision,attempts`)).rows;
   for(const job of jobs){
    if(stopped)break;
    try {
     const row=(await db.query('SELECT user_id FROM notificaciones WHERE id=$1 AND leido=FALSE',[job.notification_id])).rows[0];
     const notification=row&&(await readVisible(db,row.user_id,job.notification_id))[0];
     if(notification){
      const devices=(await db.query('SELECT d.* FROM push_devices d JOIN users u ON u.id=d.user_id WHERE d.user_id=$1 AND d.auth_version=u.auth_version AND d.expires_at>now()',[row.user_id])).rows;
      for(const device of devices)await send(device,notification);
     }
     await db.query('DELETE FROM push_jobs WHERE notification_id=$1 AND revision=$2',[job.notification_id,job.revision]);
    }catch{
     if(job.attempts>=7)await db.query('DELETE FROM push_jobs WHERE notification_id=$1 AND revision=$2',[job.notification_id,job.revision]);
     else await db.query("UPDATE push_jobs SET attempts=attempts+1,available_at=now()+($3 * interval '1 second') WHERE notification_id=$1 AND revision=$2",[job.notification_id,job.revision,Math.min(3600,30*2**job.attempts)]);
    }
   }
  }catch{console.error('No se pudo procesar la cola de notificaciones push.');}finally{running=false;}
 }
 const timer=setInterval(tick,10000);timer.unref();
 return ()=>{stopped=true;clearInterval(timer);};
};
