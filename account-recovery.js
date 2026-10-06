const passwords = require('./passwords');
const jwt = require('jsonwebtoken');
const { randomUUID, createHmac } = require('crypto');
const normalize = value => String(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
module.exports = function mountRecovery(app, { db, requireAuth, transaction, io, secret }) {
 secret = createHmac('sha256', secret).update('matesito:account-recovery:v1').digest('hex');
 const wrap = fn => (req,res,next) => Promise.resolve(fn(req,res)).catch(next);
 const fail = (status,message) => Object.assign(new Error(message),{status});
 const text = (value,min,max) => typeof value==='string' && value.trim().length>=min && value.length<=max;
 app.get('/api/account/recovery',requireAuth,wrap(async(req,res)=>{
  const row=(await db.query('SELECT questions FROM account_recovery WHERE user_id=$1',[req.user.id])).rows[0];res.json({questions:row?.questions || []});
 }));
 app.put('/api/account/recovery',requireAuth,wrap(async(req,res)=>{
  const {currentPassword,questions,answers}=req.body;
  if(!text(currentPassword,1,128)||!Array.isArray(questions)||!Array.isArray(answers)||questions.length!==3||answers.length!==3||!questions.every(q=>text(q,5,160))||!answers.every(a=>(text(a,2,200)&&normalize(a).length>=2))||new Set(questions.map(normalize)).size!==3)throw fail(400,'Completá tres preguntas diferentes y sus respuestas.');
  await transaction(async client=>{
   const user=(await client.query('SELECT password FROM users WHERE id=$1 FOR UPDATE',[req.user.id])).rows[0];
   if(!user||!await passwords.compare(currentPassword,user.password))throw fail(401,'La contraseña actual es incorrecta.');
   const hashes=[];for(const answer of answers)hashes.push(await passwords.hash(normalize(answer)));
   await client.query('INSERT INTO account_recovery(user_id,questions,answer_hashes,version) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET questions=EXCLUDED.questions,answer_hashes=EXCLUDED.answer_hashes,version=EXCLUDED.version,attempts=0,blocked_until=NULL',[req.user.id,JSON.stringify(questions.map(q=>q.trim())),JSON.stringify(hashes),randomUUID()]);
  });res.json({message:'Preguntas de recuperación guardadas.'});
 }));
 app.post('/api/recovery/questions',wrap(async(req,res)=>{
  if(!text(req.body.username,1,25))throw fail(400,'Escribí tu nombre de usuario.');
  const row=(await db.query('SELECT r.user_id,r.questions,r.version,u.auth_version FROM account_recovery r JOIN users u ON u.id=r.user_id WHERE u.username=$1',[req.body.username.trim()])).rows[0];
  res.set('Cache-Control','no-store');
  if(!row)throw fail(400,'No se puede recuperar esa cuenta con preguntas. Revisá el nombre o contactá al soporte.');
  const token=jwt.sign({id:row.user_id,version:row.version,auth_version:row.auth_version},secret,{expiresIn:'10m',audience:'account-recovery'});
  res.json({questions:row.questions,token});
 }));
 app.post('/api/recovery/reset',wrap(async(req,res)=>{
  const {token,answers,newPassword}=req.body;
  if(!Array.isArray(answers)||answers.length!==3||!answers.every(a=>(text(a,2,200)&&normalize(a).length>=2))||!text(newPassword,8,128)||typeof token!=='string')throw fail(400,'Completá las tres respuestas y una contraseña de 8 a 128 caracteres.');
  let claims;try{claims=jwt.verify(token,secret,{algorithms:['HS256'],audience:'account-recovery'});}catch{throw fail(400,'La recuperación venció. Volvé a ingresar tu usuario.');}
  const result=await transaction(async client=>{
   const user=(await client.query('SELECT auth_version FROM users WHERE id=$1 FOR UPDATE',[claims.id])).rows[0];
   const row=(await client.query('SELECT * FROM account_recovery WHERE user_id=$1 FOR UPDATE',[claims.id])).rows[0];
   if(!user||!row||row.version!==claims.version||user.auth_version!==claims.auth_version)return {status:400,error:'La recuperación venció. Volvé a empezar.'};
   if(row.blocked_until && new Date(row.blocked_until)>new Date())return {status:429,error:'Demasiados intentos. Esperá 15 minutos para volver a probar.'};
   let correct=true;for(let i=0;i<3;i++){const match=await passwords.compare(normalize(answers[i]),row.answer_hashes[i]);correct=correct&&match;}
   if(!correct){const attempts=(row.blocked_until?0:row.attempts)+1;await client.query("UPDATE account_recovery SET attempts=$2,blocked_until=CASE WHEN $2>=5 THEN now()+interval '15 minutes' ELSE NULL END WHERE user_id=$1",[claims.id,attempts]);return{status:400,error:'Las respuestas no coinciden. Revisá las tres e intentá nuevamente.'};}
   await client.query('UPDATE users SET password=$2,auth_version=auth_version+1 WHERE id=$1',[claims.id,await passwords.hash(newPassword)]);
   await client.query('UPDATE account_recovery SET attempts=0,blocked_until=NULL,version=$2 WHERE user_id=$1',[claims.id,randomUUID()]);return{status:200};
  });
  if(result.error)return res.status(result.status).json({error:result.error});
  io.to('user:'+claims.id).emit('sessionExpired');io.in('user:'+claims.id).disconnectSockets(true);
  res.json({message:'Contraseña actualizada. Ya podés iniciar sesión.'});
 }));
};
module.exports.normalize=normalize;
