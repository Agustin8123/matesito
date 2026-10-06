module.exports = function mountAnnouncements(app,{db,requireAuth,transaction,io}) {
 const isAdmin=id=>(process.env.ADMIN_USER_IDS||'').split(',').map(x=>x.trim()).includes(String(id));
 app.get('/api/admin/status',requireAuth,(req,res)=>res.json({admin:isAdmin(req.user.id)}));
 app.post('/api/announcements',requireAuth,async(req,res,next)=>{
  if(!isAdmin(req.user.id))return res.status(403).json({error:'Acceso restringido.'});
  const {title,body,requestId}=req.body;
  if(typeof title!=='string'||!title.trim()||title.length>120||typeof body!=='string'||!body.trim()||body.length>5000||typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId))return res.status(400).json({error:'Completá el título (120 caracteres) y el mensaje (5.000 caracteres).'});
  try {
   const count=await transaction(async client=>{
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[requestId]);
    const previous=(await client.query('SELECT title,body FROM announcements WHERE id=$1',[requestId])).rows[0];
    if(previous){if(previous.title!==title.trim()||previous.body!==body.trim())throw Object.assign(new Error('Ese envío ya se usó para otro aviso.'),{status:409});return 0;}
    await client.query('INSERT INTO announcements(id,author_id,title,body) VALUES($1,$2,$3,$4)',[requestId,req.user.id,title.trim(),body.trim()]);
    const sent=await client.query("WITH recipients AS (INSERT INTO notificaciones(user_id,tipo,referencia_id,chat_or_group_id,leido) SELECT id,'anuncio',$1,'A',false FROM users RETURNING id) SELECT COUNT(*)::integer AS count FROM recipients",[requestId]);return sent.rows[0].count;
   });
   io.emit('notificationsChanged');res.json({message:count?'Aviso enviado a '+count+' cuentas.':'Este aviso ya se había enviado.'});
  }catch(error){next(error);}
 });
};
