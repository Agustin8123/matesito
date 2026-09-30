const { queryFeed, feedResponse } = require('./feed-pagination');
const express = require('express');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const bcryptjs = require('./passwords');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const http = require('http');

require('dotenv').config();
const app = express();

app.disable('x-powered-by');
if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY.split(',').map(value => value.trim()));
app.use(require('./request-limits')());
const port = Number(process.env.PORT) || 3000;
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    throw new Error('JWT_SECRET es obligatorio');
}
const authSecret = jwtSecret;
const allowedOrigins = (process.env.CORS_ORIGINS || 'https://matesito.com.ar,http://localhost,capacitor://localhost')
    .split(',').map(origin => origin.trim()).filter(Boolean);
const corsOrigin = (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    try {
        const url = new URL(origin);
        if (process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return callback(null, true);
    } catch { /* Reject malformed origins. */ }
    const error = new Error('Origen no permitido');
    error.status = 403;
    return callback(error);
};

const poolConfig = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME || 'matesito_8s',
        port: Number(process.env.DB_PORT) || 5432
    };
if (process.env.DB_SSL === 'true' || (process.env.NODE_ENV === 'production' && process.env.DB_SSL !== 'false')) {
    poolConfig.ssl = { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };
}

async function verifyTurnstile(token, ip) {
    if (!process.env.TURNSTILE_SECRET || !token) return false;
    try {
        const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                secret: process.env.TURNSTILE_SECRET,
                response: token,
                remoteip: ip
            }),
            signal: AbortSignal.timeout(5000)
        });
        if (!resp.ok) return false;
        const data = await resp.json();
        return data.success === true;
    } catch (error) {
        console.error('Error verificando Turnstile:', error.message);
        return false;
    }
}

app.use(express.json({ limit: process.env.JSON_LIMIT || '1mb' }));

app.use(cors({
  origin: corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'same-origin');
    next();
});

poolConfig.connectionTimeoutMillis = 5000;
poolConfig.statement_timeout = 15000;
poolConfig.idleTimeoutMillis = 30000;
const db = new Pool(poolConfig);
require('./storage')(app, requireAuth, db);
const { claimMedia } = require('./media-access');
db.on('error', error => console.error('Error de conexión inactiva a PostgreSQL:', error.message));

// Verificar conexión
if (require.main === module) db.query('SELECT 1')
  .then(() => console.log('Conexión a la base de datos PostgreSQL exitosa'))
  .catch(err => console.error('Error al conectar a la base de datos:', err));

function getToken(req) {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) return header.slice(7);
    const cookies = (req.headers.cookie || '').split(';').map(value => value.trim());
    const authCookie = cookies.find(value => value.startsWith('auth_token='));
    try { return authCookie ? decodeURIComponent(authCookie.slice('auth_token='.length)) : null; }
    catch { return null; }
}

async function requireAuth(req, res, next) {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: 'Autenticación requerida' });
    try {
        req.user = jwt.verify(token, authSecret, { algorithms: ['HS256'] });
        const result = await db.query('SELECT id, username, auth_version FROM users WHERE id = $1', [req.user.id]);
        const user = result.rows[0];
        if (!user || Number(req.user.auth_version || 0) !== Number(user.auth_version || 0)) return res.status(401).json({ error: 'Sesión inválida o expirada' });
        req.user = user;
        res.setHeader('Cache-Control', 'no-store');
        next();
    } catch (error) {
        if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) return res.status(401).json({ error: 'Sesión inválida o expirada' });
        return res.status(503).json({ error: 'No se pudo verificar la sesión. Reintentá en un momento.' });
    }
}

async function optionalAuth(req, res, next) {
    if (!getToken(req)) return next();
    let claims;
    try { claims = jwt.verify(getToken(req), authSecret, { algorithms: ['HS256'] }); } catch { return next(); }
    try {
        const user = (await db.query('SELECT id, username, auth_version FROM users WHERE id=$1', [claims.id])).rows[0];
        if (user && Number(user.auth_version || 0) === Number(claims.auth_version || 0)) { req.user = user; res.set('Cache-Control', 'no-store'); }
        next();
    } catch (error) { next(Object.assign(new Error('La base de datos no está disponible. Reintentá.'), { status: 503 })); }
}
async function assertNotBlocked(client, first, second) {
    const blocked = await client.query('SELECT 1 FROM user_blocks WHERE (user_id=$1 AND blocked_id=$2) OR (user_id=$2 AND blocked_id=$1)', [first, second]);
    if (blocked.rows.length) throw requestError(403, 'No se puede interactuar con esta cuenta');
}

function setAuthCookie(res, token, maxAge = 7 * 24 * 60 * 60) {
    const cookieParts = [
        `auth_token=${encodeURIComponent(token)}`, 'HttpOnly', 'SameSite=Lax',
        'Path=/', `Max-Age=${maxAge}`
    ];
    if (process.env.NODE_ENV === 'production') cookieParts.push('Secure');
    res.setHeader('Set-Cookie', cookieParts.join('; '));
}

function sameUser(req, value) {
    return value !== undefined && String(value) === String(req.user.id);
}

function validText(value, max) {
    return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

function validId(value) {
    return /^\d+$/.test(String(value || ''));
}

function validNumericId(value) {
    return validId(value) && Number(value) > 0 && Number.isSafeInteger(Number(value));
}

function validReactionPostId(value) {
    return typeof value === 'string' && /^Matesito_post-(?:[CFG]-)?[1-9]\d{0,15}$/.test(value);
}

async function reactionAccess(req, res, next) {
    try {
        const id = req.params.id;
        if (!validReactionPostId(id)) throw requestError(400, 'ID inválido');
        const target = id.slice('Matesito_post-'.length);
        if (/^\d+$/.test(target)) {
            const post = await db.query('SELECT u.id AS author_id FROM posts p LEFT JOIN users u ON u.username=p.username WHERE p.id=$1', [target]);
            if (!post.rows.length) throw requestError(404, 'Publicación no encontrada');
            req.reactionPublic = true;
            req.reactionAuthor = post.rows[0].author_id;
            req.reactionContext = 'P-' + target;
            return next();
        }
        const message = (await db.query('SELECT chat_or_group_id, sender_id, is_private FROM mensajes WHERE id = $1', [target])).rows[0];
        if (!message) throw requestError(404, 'Publicación no encontrada');
        const context = /^([CFG])-([1-9]\d*)$/.exec(message.chat_or_group_id);
        if (!context) throw requestError(404, 'Contexto no encontrado');
        const [, kind, entityId] = context;
        req.reactionContext = message.chat_or_group_id;
        req.reactionAuthor = message.sender_id;
        if (kind === 'F') {
            const forum = await db.query('SELECT 1 FROM foros WHERE id=$1', [entityId]);
            if (!forum.rows.length || message.is_private) throw requestError(404, 'Publicación no encontrada');
            req.reactionPublic = true; return next();
        }
        if (!req.user) return requireAuth(req, res, () => reactionAccess(req, res, next));
        if (kind === 'C') {
            const chat = await db.query('SELECT 1 FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)', [entityId, req.user.id]);
            if (!chat.rows.length) throw requestError(403, 'Acceso denegado');
        } else if (kind === 'G') {
            const member = await db.query('SELECT 1 FROM participantes WHERE user_id = $1 AND forum_or_group_id = $2 AND is_group = TRUE', [req.user.id, entityId]);
            const owner = await db.query('SELECT 1 FROM grupos WHERE owner_id = $1 AND id = $2', [req.user.id, entityId]);
            if (!member.rows.length && !owner.rows.length) throw requestError(403, 'Acceso denegado');
            if (Number(message.sender_id) !== Number(req.user.id)) {
                const sender = await db.query('SELECT 1 FROM participantes WHERE user_id = $1 AND forum_or_group_id = $2 AND is_group = TRUE', [message.sender_id, entityId]);
                const following = await db.query('SELECT 1 FROM seguir WHERE follower_id = $1 AND followed_id = $2', [req.user.id, message.sender_id]);
                const follower = await db.query('SELECT 1 FROM seguir WHERE follower_id = $1 AND followed_id = $2', [message.sender_id, req.user.id]);
                if (!sender.rows.length || !following.rows.length || !follower.rows.length) throw requestError(403, 'Acceso denegado');
            }
        } else req.reactionPublic = true;
        next();
    } catch (error) { next(error); }
}



function requestError(status, message) { return Object.assign(new Error(message), { status }); }
async function transaction(action) {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const result = await action(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally { client.release(); }
}
const asyncRoute = action => (req, res, next) => Promise.resolve(action(req, res)).catch(next);

 // Obtener la cantidad de reacciones
 app.get('/get/microreact--reactions/:id', reactionAccess, async (req, res) => {
    const { id } = req.params;
    const reaction = req.query.reaction;
  
     if (!validReactionPostId(id) || !/^[1-5]$/.test(String(reaction))) {
      return res.status(400).json({ error: 'Reaction parameter is missing' });
    }
  
    try {
      const result = await db.query(
        `SELECT SUM(count) AS total_count 
         FROM reactions 
         WHERE id = $1 AND reaction_id = $2`,
        [id, reaction]
      );
  
      const totalCount = result.rows[0].total_count || 0; // Manejo si el resultado es `null`
      res.status(200).json({ value: totalCount });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });  
  
  // Actualizar el contador de reacciones
  // Ruta para obtener el número de reacciones
  app.post('/hit/microreact--reactions/:id/:reaction', requireAuth, reactionAccess, asyncRoute(async (req, res) => {
    const { id, reaction } = req.params;
    const userId = req.user.id;
    if (!validReactionPostId(id) || !/^[1-5]$/.test(reaction) || !sameUser(req, req.body.user_id)) throw requestError(400, 'Reacción inválida');
    const recipient = Number(req.reactionAuthor);
    if (recipient && recipient !== req.user.id) await assertNotBlocked(db, req.user.id, recipient);
    await transaction(async client => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [id]);
        const existing = await client.query('SELECT reaction_id FROM user_reactions WHERE user_id = $1 AND post_id = $2', [userId, id]);
        const previous = existing.rows[0]?.reaction_id;
        await client.query('DELETE FROM user_reactions WHERE user_id = $1 AND post_id = $2', [userId, id]);
        if (String(previous) !== reaction) await client.query('INSERT INTO user_reactions (user_id, post_id, reaction_id) VALUES ($1, $2, $3)', [userId, id, reaction]);
        if (recipient && recipient !== req.user.id) {
            if (String(previous) === reaction) await client.query("DELETE FROM notificaciones WHERE user_id=$1 AND tipo='reaccion' AND referencia_id=$2 AND actor_id=$3", [recipient, id.slice('Matesito_post-'.length), userId]);
            else await client.query(`INSERT INTO notificaciones(user_id,tipo,referencia_id,chat_or_group_id,actor_id,reaction_id)
                VALUES ($1,'reaccion',$2,$3,$4,$5)
                ON CONFLICT (user_id,referencia_id,actor_id) WHERE tipo='reaccion'
                DO UPDATE SET reaction_id=EXCLUDED.reaction_id,leido=FALSE`,
                [recipient,id.slice('Matesito_post-'.length),req.reactionContext,userId,Number(reaction)]);
        }
        // Derive totals from actual selections, including a newly selected reaction type.
        await client.query('DELETE FROM reactions WHERE id = $1', [id]);
        await client.query('INSERT INTO reactions (id, reaction_id, count) SELECT post_id, reaction_id, COUNT(*) FROM user_reactions WHERE post_id = $1 GROUP BY post_id, reaction_id', [id]);
    });
    if (req.reactionPublic) io.emit('reloadReactions', { id });
    else await emitPrivateUpdate(req.reactionContext, req.reactionAuthor, 'reloadReactions', { id });
    if (recipient && recipient !== req.user.id) io.to('user:' + recipient).emit('notificationsChanged');
    res.json({ message: 'Reacción actualizada' });
}));

// Ruta para obtener todas las reacciones del post
app.get('/get/microreact--reactionss/:id', reactionAccess, async (req, res) => {
    const { id } = req.params;
    if (!validReactionPostId(id)) return res.status(400).json({ error: 'ID inválido' });
  
    try {
        // Obtener todas las reacciones asociadas al post
        const result = await db.query(
            `SELECT reaction_id, count FROM reactions WHERE id = $1`,
            [id]
        );
        
        const reactions = result.rows.map(row => ({
            reaction_id: row.reaction_id,
            count: row.count || 0, // Asegurar que el conteo no sea null
        }));

        let selected = null;
        const token = getToken(req);
        if (token) { try { const user = jwt.verify(token, authSecret, { algorithms: ['HS256'] }); selected = (await db.query('SELECT reaction_id FROM user_reactions WHERE user_id = $1 AND post_id = $2', [user.id, id])).rows[0]?.reaction_id || null; } catch {} }
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({ reactions, selected });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

  app.get('/api/reactions/totals', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT r.id, SUM(r.count) AS total FROM reactions r JOIN posts p ON r.id = 'Matesito_post-' || p.id::text GROUP BY r.id
        `);
        const totals = {};
        result.rows.forEach(row => {
            totals[row.id] = row.total; // Guardar totales en un objeto { postId: total }
        });
        res.json(totals);
    } catch (error) {
        console.error('Error obteniendo totales de reacciones:', error);
        res.status(500).json({ error: 'Error en el servidor' });
    }
});

// Crear nuevo usuario
app.post('/users', asyncRoute(async (req, res) => {
    const { username, password, profileImage, description, token } = req.body;
    if (String(profileImage || '').includes('/uploads/')) return res.status(400).json({ error: 'Subí la foto después de crear tu cuenta' });

    if (!validText(username, 25) || !validText(password, 128)) {
        return res.status(400).json({ error: 'Usuario o contraseña inválidos' });
    }
    const isHuman = await verifyTurnstile(token, req.ip);
    if (!isHuman) {
        return res.status(403).json({ error: 'Captcha inválido' });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    const query = 'INSERT INTO public.users (username, password, image, description) VALUES ($1, $2, $3, $4) RETURNING id';
    try {
        const result = await db.query(query, [username.trim(), hashedPassword, profileImage || '/resources/SVG/default-avatar.svg',
            validText(description, 1000) ? description.trim() : null]);
        const userId = result.rows[0].id;
        setAuthCookie(res, jwt.sign({ id: userId, username: username.trim() }, authSecret, { expiresIn: '7d' }));
        res.status(201).json({ id: userId, username: username.trim() });
    } catch (err) {
        console.error('Error al insertar usuario:', err);
        res.status(err.code === '23505' ? 409 : 500).json({ error: 'Error al crear el usuario' });
    }
}));

// Iniciar sesión con un usuario existente
app.post('/login', async (req, res) => {
    const { username, password, token } = req.body;

    if (!validText(username, 25) || !validText(password, 128)) {
        return res.status(400).json({ error: 'Credenciales inválidas' });
    }
    const isHuman = await verifyTurnstile(token, req.ip);
    if (!isHuman) {
        return res.status(403).json('Captcha inválido');
    }

    try {
        const results = await db.query('SELECT id, username, password, auth_version FROM public.users WHERE username = $1', [username.trim()]);
        if (!results.rows.length || !(await bcryptjs.compare(password, results.rows[0].password))) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
        const user = results.rows[0];
        if (bcryptjs.needsUpgrade(user.password)) {
            const upgraded = await bcryptjs.hash(password);
            await db.query('UPDATE users SET password=$1 WHERE id=$2 AND password=$3', [upgraded, user.id, user.password]);
        }
        const authToken = jwt.sign({ id: user.id, username: user.username, auth_version: user.auth_version || 0 }, authSecret, { expiresIn: '7d' });
        setAuthCookie(res, authToken);
        return res.status(200).json({ id: user.id, username: user.username });
    } catch (err) {
        console.error('Error al buscar el usuario:', err);
        return res.status(500).json({ error: 'Error al buscar el usuario' });
    }
});
;

// Crear un nuevo post

const MediaGallery = require('./public/scripts/media-gallery');
function validPublication(content, media, mediaType) {
    if (mediaType === MediaGallery.TYPE) return typeof content === 'string' && content.length <= 10000 && MediaGallery.valid(media);
    if (typeof content !== 'string' || content.length > 10000) return false;
    const attached = validText(media, 2000000) && /^(image|audio|video)\/[a-z0-9.+-]+(?:;.*)?$/i.test(mediaType || '');
    return content.trim().length > 0 || attached;
}

async function replayPublication(client, req) {
    const key = req.body.requestId;
    if (key === undefined) return null;
    if (typeof key !== 'string' || !/^[0-9a-f-]{36}$/i.test(key)) throw requestError(400, 'Identificador de envío inválido');
    const hash = require('crypto').createHash('sha256').update(req.path + JSON.stringify(req.body)).digest('hex');
    req.publicationHash = hash;
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['send:' + req.user.id + ':' + key]);
    const previous = (await client.query('SELECT request_hash,response FROM publication_requests WHERE user_id=$1 AND request_id=$2', [req.user.id, key])).rows[0];
    if (previous && previous.request_hash !== hash) throw requestError(409, 'Este envío corresponde a otro contenido');
    return previous?.response || null;
}
async function rememberPublication(client, req, response) {
    if (!req.publicationHash) return;
    await client.query('INSERT INTO publication_requests(user_id,request_id,request_hash,response) VALUES ($1,$2,$3,$4)', [req.user.id,req.body.requestId,req.publicationHash,JSON.stringify(response)]);
}
app.post('/posts', requireAuth, asyncRoute(async (req, res) => {
    const { username, content, media, mediaType, sensitive } = req.body;
    if (username !== req.user.username || !validPublication(content, media, mediaType) ||
        (media != null && !validText(media, 2000000)) || (mediaType != null && !validText(mediaType,100)) ||
        (sensitive !== undefined && typeof sensitive !== 'boolean')) throw requestError(400, 'Contenido inválido');
    let replayed = false;
    const saved = await transaction(async client => {
        const replay = await replayPublication(client, req);
        if (replay) { replayed = true; return replay; }
        await claimMedia(client, req, media, mediaType);
        await client.query('SELECT id FROM users WHERE id=$1 FOR UPDATE', [req.user.id]);
        const last = (await client.query('SELECT content,media FROM posts WHERE username=$1 ORDER BY created_at DESC,id DESC LIMIT 1', [username])).rows[0];
        if (last && last.content === content && (last.media || null) === (media || null)) throw requestError(409, 'No podés enviar el mismo post dos veces seguidas');
        const row = (await client.query('INSERT INTO posts(username,content,media,mediatype,sensitive,created_at) VALUES ($1,$2,$3,$4,$5,NOW()) RETURNING id', [username,content,media || null,mediaType || null,sensitive === true])).rows[0];
        const response = { id: row.id, content, media, mediaType };
        await rememberPublication(client, req, response); return response;
    });
    if (!replayed) io.emit('reloadPosts', { id: saved.id });
    res.status(201).json(saved);
}));

app.post('/mensajes/:forumId', requireAuth, async (req, res) => {
    const { forumId } = req.params;
    const { content, sensitive, sender_id, created_at, media, mediaType, is_private } = req.body;

    if (!validId(forumId) || !sameUser(req, sender_id) || !validPublication(content, media, mediaType) ||
        (sensitive !== undefined && typeof sensitive !== 'boolean') ||
        (is_private !== undefined && typeof is_private !== 'boolean')) {
        return res.status(400).json({ error: 'Contenido o remitente inválido' });
    }
    let client;
    try {
        client = await db.connect();
        await client.query('BEGIN');
        const replay = await replayPublication(client, req);
        if (replay) { await client.query('COMMIT'); return res.status(201).json(replay); }
        await claimMedia(client, req, media, mediaType);
        const numericForumId = Number(forumId);
        if (is_private) {
            const chat = await client.query(
                'SELECT 1 FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
                [numericForumId, req.user.id]
            );
            if (!chat.rows.length) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Acceso denegado' }); }
            const peers = (await client.query('SELECT user1_id,user2_id FROM chats WHERE id=$1', [numericForumId])).rows[0];
            await assertNotBlocked(client, peers.user1_id, peers.user2_id);
        } else {
            const participant = await client.query(
                'SELECT 1 FROM participantes WHERE forum_or_group_id = $1 AND user_id = $2 AND is_group = FALSE',
                [numericForumId, req.user.id]
            );
            const owner = await client.query('SELECT 1 FROM foros WHERE id = $1 AND owner_id = $2', [numericForumId, req.user.id]);
            if (!participant.rows.length && !owner.rows.length) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Acceso denegado' }); }
        }
        // Crear el ID del foro con prefijo
        const formattedForumId = is_private ? `C-${forumId}` : `F-${forumId}`;

        // Insertar mensaje
        const result = await client.query(
            `INSERT INTO mensajes (chat_or_group_id, content, sensitive, sender_id, created_at, media, media_type, is_private)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING id, chat_or_group_id, content, sensitive, sender_id, created_at, media, media_type, is_private`,
            [formattedForumId, content, sensitive === true, sender_id, new Date(), media, mediaType, is_private === true]
        );

        const mensaje = result.rows[0];

        // Crear el ID formateado del mensaje
        const formattedId = is_private ? `C-${mensaje.id}` : `F-${mensaje.id}`;

        // Actualizar el ID del mensaje
        await client.query(`UPDATE mensajes SET id = $1 WHERE id = $2`, [formattedId, mensaje.id]);

        mensaje.id = formattedId;

        if (is_private) {
            const receptor = await client.query(
                `SELECT CASE 
                    WHEN user1_id = $1 THEN user2_id 
                    ELSE user1_id 
                END AS receptor 
                FROM chats 
                WHERE id = $2`,
                [sender_id, forumId]
            );

            if (receptor.rows.length > 0) {
                await client.query(
                    `INSERT INTO notificaciones (user_id, tipo, referencia_id, chat_or_group_id)
                     VALUES ($1, 'mensaje', $2, $3)`,
                    [receptor.rows[0].receptor, formattedId, formattedForumId]
                );
            }
        } else {
            await client.query(
                `INSERT INTO notificaciones (user_id, tipo, referencia_id, chat_or_group_id)
                 SELECT user_id, 'foro', $1, $2 FROM participantes
                 WHERE forum_or_group_id = $3 AND is_group = FALSE AND user_id != $4`,
                [formattedId, formattedForumId, forumId, sender_id]
            );
        }

        await rememberPublication(client, req, mensaje);
        await client.query('COMMIT');
        if (is_private) await emitPrivateUpdate(formattedForumId, req.user.id, 'reloadCPosts', { id: formattedId });
        else io.emit('reloadFPosts', { id: formattedId });
        res.status(201).json(mensaje);

    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('Error al guardar el mensaje:', error);
        res.status(error.status || 500).json({ error: error.status ? error.message : 'Error al guardar el mensaje' });
    } finally { client?.release(); }
});


app.get('/mensajes/:forumId', (req, res, next) => req.query.private === 'true' ? requireAuth(req, res, next) : optionalAuth(req, res, next), async (req, res) => {
    const { forumId } = req.params;
    const isPrivate = req.query.private === 'true'; // opcional, según cómo lo llames desde frontend
    if (!validNumericId(forumId)) return res.status(400).json({ error: 'ID inválido' });
    try {
        if (isPrivate) {
            const chat = await db.query(
                'SELECT 1 FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
                [forumId, req.user.id]
            );
            if (!chat.rows.length) return res.status(403).json({ error: 'Acceso denegado' });
        } else {
            // Los foros son públicos, también para visitantes; los chats
            // privados se restringen al participante anterior.
            const forum = await db.query('SELECT 1 FROM foros WHERE id = $1', [forumId]);
            if (!forum.rows.length) return res.status(404).json({ error: 'Foro no encontrado' });
        }
        const formattedId = isPrivate ? `C-${forumId}` : `F-${forumId}`;
        const result = await queryFeed(req, db,
            `SELECT 
                m.id,
                m.chat_or_group_id, 
                m.content, 
                m.sensitive, 
                m.sender_id, 
                m.created_at, 
                m.media, 
                m.media_type, 
                m.is_private,
                u.username, 
                u.image
            FROM mensajes m
            INNER JOIN users u ON m.sender_id = u.id
            WHERE m.chat_or_group_id = $1
            ORDER BY m.created_at ASC`,
            [formattedId]
        );

        res.status(200).json(feedResponse(result));
    } catch (error) {
        console.error('Error al cargar los mensajes:', error);
        res.status(error.status || 500).json({ error: 'Error al cargar los mensajes' });
    }
});


function mapPost(post) {
    return { postId: post.postid, userId: post.userid, username: post.username, content: post.content,
        media: post.media || null, mediaType: post.mediatype || null, created_at: post.created_at,
        profilePicture: post.profilepicture || null, sensitive: !!post.sensitive, reactionTotal: Number(post.reaction_total || 0) };
}
for (const route of ['/posts', '/posts/user/:username']) app.get(route, optionalAuth, asyncRoute(async (req, res) => {
    const username = req.params.username;
    const result = await queryFeed(req, db, `SELECT t.id AS postid, t.username, t.content, t.media, t.mediatype, t.created_at, t.sensitive,
        u.id AS userid, u.image AS profilepicture FROM posts t LEFT JOIN users u ON t.username = u.username
        ${username ? 'WHERE t.username = $1' : ''} ORDER BY t.created_at DESC, t.id DESC`, username ? [username] : [], 'postid');
    res.json(feedResponse(result, result.rows.map(mapPost)));
}));

const path = require('path');

// Ruta para obtener los detalles del usuario
app.post('/getUserDetails', (req, res) => {
    const { username } = req.body;

    const query = 'SELECT id,username,image,description FROM public.users WHERE username = $1';
    db.query(query, [username], (err, results) => {
        if (err) {
            console.error('Error en la consulta /getUserDetails:', err);
            return res.status(500).json({ message: 'Error al obtener los detalles del usuario' });
        }

        if (results.rows.length > 0) {
            const user = results.rows[0];
            res.status(200).json({
                id: user.id,
                username: user.username,
                profileImage: user.image || '/resources/SVG/default-avatar.svg',
                description: user.description || ''
            });
        } else {
            res.status(404).json({ message: 'Usuario no encontrado' });
        }
    });
});

app.put('/updateProfileImage', requireAuth, asyncRoute(async (req,res) => {
    const { username,profileImage } = req.body;
    if (username !== req.user.username || !validText(profileImage,2000000)) throw requestError(400,'Imagen inválida');
    await transaction(async client => {
        await claimMedia(client, req, profileImage);
        await client.query('UPDATE users SET image=$1 WHERE id=$2',[profileImage,req.user.id]);
    });
    res.json({ success:true, message:'Imagen de perfil actualizada' });
}));

app.put('/updateDescription', requireAuth, (req, res) => {
    const { username, description } = req.body;

    if (username !== req.user.username || typeof description !== 'string' || description.length > 1000) {
        return res.status(400).json({ success: false, message: 'Faltan datos.' });
    }

    const query = 'UPDATE public.users SET description = $1 WHERE username = $2';
    db.query(query, [description, username], (err, result) => {
        if (err) {
            console.error('Error al actualizar la descripción:', err);
            return res.status(500).json({ success: false, message: 'Error del servidor.' });
        }

        if (result.rowCount > 0) {
            res.status(200).json({ success: true });
        } else {
            res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }
    });
});

// Ruta para actualizar el nombre de usuario
app.put('/updateUsername', requireAuth, async (req, res) => {
    const { currentUsername, newUsername } = req.body;
    if (currentUsername !== req.user.username || !validText(newUsername, 25)) {
        return res.status(400).json({ error: 'Nombre de usuario inválido' });
    }
    let client;
    try {
        client = await db.connect();
        await client.query('BEGIN');
        const current = await client.query('SELECT username FROM public.users WHERE id = $1 FOR UPDATE', [req.user.id]);
        if (!current.rows.length) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        const normalized = newUsername.trim();
        const oldName = current.rows[0].username;
        await client.query('UPDATE public.users SET username = $1 WHERE id = $2', [normalized, req.user.id]);
        // Los posts históricos usan el nombre como vínculo con el autor.
        await client.query('UPDATE posts SET username = $1 WHERE username = $2', [normalized, oldName]);
        await client.query('COMMIT');
        setAuthCookie(res, jwt.sign({ id: req.user.id, username: normalized, auth_version: req.user.auth_version || 0 }, authSecret, { expiresIn: '7d' }));
        res.json({ success: true, message: 'Nombre de usuario actualizado con éxito' });
    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'Ese nombre ya está en uso' : 'No se pudo actualizar el nombre' });
    } finally { client?.release(); }
});

// Ruta para actualizar la contraseña
app.put('/updatePassword', requireAuth, asyncRoute(async (req,res) => {
    const { username,currentPassword,newPassword } = req.body;
    if (username !== req.user.username || !validText(currentPassword,128) || !validText(newPassword,128)) throw requestError(400,'Datos incompletos');
    const version = await transaction(async client => {
        const user = (await client.query('SELECT password,auth_version FROM users WHERE id=$1 FOR UPDATE',[req.user.id])).rows[0];
        if (!user || !await bcryptjs.compare(currentPassword,user.password)) throw requestError(401,'La contraseña actual es incorrecta');
        const hash = await bcryptjs.hash(newPassword);
        return (await client.query('UPDATE users SET password=$1,auth_version=auth_version+1 WHERE id=$2 RETURNING auth_version',[hash,req.user.id])).rows[0].auth_version;
    });
    setAuthCookie(res,jwt.sign({ id:req.user.id,username,auth_version:version },authSecret,{ expiresIn:'7d' }));
    io.to('user:' + req.user.id).emit('sessionExpired');
    io.in('user:' + req.user.id).disconnectSockets(true);
    res.json({ success:true,message:'Contraseña actualizada con éxito' });
}));

// Crear un foro
app.post('/foros', requireAuth, asyncRoute(async (req, res) => {
    const { name, description, ownerId } = req.body;
    if (!validText(name, 30) || !validText(description, 2000) || !sameUser(req, ownerId)) throw requestError(400, 'Datos del foro inválidos');
    const forum = await transaction(async client => {
        const existing = await client.query('SELECT 1 FROM foros WHERE name = $1', [name.trim()]);
        if (existing.rows.length) throw requestError(409, 'El nombre del foro ya está en uso');
        const result = await client.query('INSERT INTO foros (name, description, owner_id, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, name, description', [name.trim(), description.trim(), req.user.id]);
        await client.query('INSERT INTO participantes (user_id, forum_or_group_id, is_group, joined_at) VALUES ($1, $2, FALSE, NOW())', [req.user.id, result.rows[0].id]);
        return result.rows[0];
    });
    io.emit('reloadFG');
    res.status(201).json(forum);
}));

app.post('/grupos', requireAuth, asyncRoute(async (req, res) => {
    const { name, description, ownerId } = req.body;
    if (!validText(name, 30) || !validText(description, 2000) || !sameUser(req, ownerId)) throw requestError(400, 'Datos del grupo inválidos');
    const group = await transaction(async client => {
        const inviteCode = require('node:crypto').randomBytes(8).toString('hex');
        const result = await client.query('INSERT INTO grupos (name, description, owner_id, invite_code, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, name, description, invite_code', [name.trim(), description.trim(), req.user.id, inviteCode]);
        await client.query('INSERT INTO participantes (user_id, forum_or_group_id, is_group, joined_at) VALUES ($1, $2, TRUE, NOW())', [req.user.id, result.rows[0].id]);
        return result.rows[0];
    });
    io.to('user:' + req.user.id).emit('reloadFG');
    res.status(201).json(group);
}));

app.delete('/grupo/:groupId/:ownerId', requireAuth, asyncRoute(async (req, res) => {
    const id = req.params.groupId;
    if (!validNumericId(id)) throw requestError(400, 'ID inválido');
    await transaction(async client => {
        const entity = await client.query('SELECT owner_id FROM grupos WHERE id = $1 FOR UPDATE', [id]);
        if (!entity.rows.length) throw requestError(404, 'Grupo no encontrado');
        if (!sameUser(req, entity.rows[0].owner_id)) throw requestError(403, 'No tenés permiso para eliminarlo');
        const context = 'G-' + id;
        const messages = await client.query('SELECT id FROM mensajes WHERE chat_or_group_id = $1', [context]);
        for (const message of messages.rows) {
            const reactionId = 'Matesito_post-' + message.id;
            await client.query('DELETE FROM user_reactions WHERE post_id = $1', [reactionId]);
            await client.query('DELETE FROM reactions WHERE id = $1', [reactionId]);
        }
        await client.query('DELETE FROM notificaciones WHERE chat_or_group_id = $1', [context]);
        await client.query('DELETE FROM mensajes WHERE chat_or_group_id = $1', [context]);
        await client.query('DELETE FROM participantes WHERE forum_or_group_id = $1 AND is_group = $2', [id, true]);
        await client.query('DELETE FROM grupos WHERE id = $1', [id]);
    });
    io.emit('reloadFG');
    res.json({ message: 'Grupo eliminado correctamente' });
}));

app.post('/unir-grupo', requireAuth, async (req, res) => {
    const { inviteCode, userId } = req.body;

    // Validar que se envíen todos los datos necesarios
    if (!validText(inviteCode, 32) || !sameUser(req, userId)) {
        return res.status(400).json({ error: 'Código de invitación y userId son requeridos' });
    }

    try {
        // Verificar si el código de invitación existe y obtener el grupo
        const grupoResult = await db.query(
            'SELECT id FROM grupos WHERE invite_code = $1',
            [inviteCode]
        );

        if (grupoResult.rows.length === 0) {
            return res.status(404).json({ error: 'Código de invitación no válido' });
        }

        const groupId = grupoResult.rows[0].id;

        // Verificar si el usuario ya es participante del grupo
        const participanteResult = await db.query(
            'SELECT 1 FROM participantes WHERE user_id = $1 AND forum_or_group_id = $2 AND is_group = TRUE',
            [userId, groupId]
        );

        if (participanteResult.rows.length > 0) {
            return res.status(400).json({ error: 'El usuario ya pertenece a este grupo' });
        }

        // Agregar al usuario al grupo
        const insertResult = await db.query(
            `
            INSERT INTO participantes (user_id, forum_or_group_id, is_group, joined_at)
            VALUES ($1, $2, TRUE, CURRENT_TIMESTAMP)
            RETURNING id
            `,
            [userId, groupId]
        );

        res.status(201).json({
            message: 'Usuario unido al grupo exitosamente',
            participanteId: insertResult.rows[0].id,
        });
        io.to('user:' + req.user.id).emit('reloadFG');
    } catch (error) {
        console.error('Error al unir al usuario al grupo:', error);
        res.status(500).json({ error: 'Error al procesar la solicitud' });
    }
});

app.delete('/salir-grupo', requireAuth, async (req, res) => {
    const { groupId, userId } = req.body;

    // Validar que se envíen todos los datos necesarios
    if (!validId(groupId) || !sameUser(req, userId)) {
        return res.status(400).json({ error: 'El ID del grupo y el ID del usuario son requeridos' });
    }

    try {
        // Verificar si el usuario pertenece al grupo
        const participanteResult = await db.query(
            'SELECT 1 FROM participantes WHERE user_id = $1 AND forum_or_group_id = $2 AND is_group = TRUE',
            [userId, groupId]
        );

        if (participanteResult.rows.length === 0) {
            return res.status(404).json({ error: 'El usuario no pertenece a este grupo' });
        }

        // Eliminar al usuario del grupo
        await db.query(
            'DELETE FROM participantes WHERE user_id = $1 AND forum_or_group_id = $2 AND is_group = TRUE',
            [userId, groupId]
        );

        res.status(200).json({ message: 'Usuario eliminado del grupo exitosamente' });
        io.to('user:' + req.user.id).emit('reloadFG');
    } catch (error) {
        console.error('Error al salir del grupo:', error);
        res.status(500).json({ error: 'Error al procesar la solicitud' });
    }
});

app.get('/grupo/:id', requireAuth, async (req, res) => {
    const groupId = req.params.id;
    if (!validNumericId(groupId)) return res.status(400).json({ error: 'ID inválido' });

    try {
        const membership = await db.query(
            'SELECT 1 FROM participantes WHERE forum_or_group_id = $1 AND user_id = $2 AND is_group = TRUE',
            [groupId, req.user.id]
        );
        const owner = await db.query('SELECT 1 FROM grupos WHERE id = $1 AND owner_id = $2', [groupId, req.user.id]);
        if (!membership.rows.length && !owner.rows.length) return res.status(403).json({ error: 'No perteneces a este grupo' });
        // Consulta para obtener los detalles del grupo por ID
        const query = 'SELECT name, description, invite_code FROM grupos WHERE id = $1';
        const result = await db.query(query, [groupId]);

        if (result.rows.length === 0) {
            return res.status(404).json('Grupo no encontrado');
        }

        // Retornar los detalles del grupo
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener los detalles del grupo:', error);
        res.status(500).json('Error al obtener los detalles del grupo');
    }
});

app.delete('/foros/:forumId', requireAuth, asyncRoute(async (req, res) => {
    const id = req.params.forumId;
    if (!validNumericId(id)) throw requestError(400, 'ID inválido');
    await transaction(async client => {
        const entity = await client.query('SELECT owner_id FROM foros WHERE id = $1 FOR UPDATE', [id]);
        if (!entity.rows.length) throw requestError(404, 'Foro no encontrado');
        if (!sameUser(req, entity.rows[0].owner_id)) throw requestError(403, 'No tenés permiso para eliminarlo');
        const context = 'F-' + id;
        const messages = await client.query('SELECT id FROM mensajes WHERE chat_or_group_id = $1', [context]);
        for (const message of messages.rows) {
            const reactionId = 'Matesito_post-' + message.id;
            await client.query('DELETE FROM user_reactions WHERE post_id = $1', [reactionId]);
            await client.query('DELETE FROM reactions WHERE id = $1', [reactionId]);
        }
        await client.query('DELETE FROM notificaciones WHERE chat_or_group_id = $1', [context]);
        await client.query('DELETE FROM mensajes WHERE chat_or_group_id = $1', [context]);
        await client.query('DELETE FROM participantes WHERE forum_or_group_id = $1 AND is_group = $2', [id, false]);
        await client.query('DELETE FROM foros WHERE id = $1', [id]);
    });
    io.emit('reloadFG');
    res.json('Foro eliminado con éxito');
}));

app.post('/joinForum', requireAuth, asyncRoute(async (req, res) => {
    const { userId, forumId } = req.body;
    if (!validNumericId(forumId) || !sameUser(req, userId)) throw requestError(400, 'Datos inválidos');
    await transaction(async client => {
        const forum = await client.query('SELECT id FROM foros WHERE id = $1 FOR UPDATE', [forumId]);
        if (!forum.rows.length) throw requestError(404, 'Foro no encontrado');
        const member = await client.query('SELECT 1 FROM participantes WHERE user_id = $1 AND forum_or_group_id = $2 AND is_group = FALSE', [userId, forumId]);
        if (member.rows.length) throw requestError(409, 'Ya estás siguiendo este foro');
        await client.query('INSERT INTO participantes (user_id, forum_or_group_id, is_group, joined_at) VALUES ($1, $2, FALSE, NOW())', [userId, forumId]);
    });
    io.to('user:' + req.user.id).emit('reloadFG'); res.status(201).json({ message: 'Ahora seguís este foro' });
}));

app.post('/leaveForum', requireAuth, (req, res) => {
    const { userId, forumId } = req.body;

    if (!validId(forumId) || !sameUser(req, userId)) {
        return res.status(400).json({ message: 'Datos incompletos' }); // Mensaje claro
    }

    const checkQuery = 'SELECT * FROM participantes WHERE user_id = $1 AND forum_or_group_id = $2 AND is_group = false';
    db.query(checkQuery, [userId, forumId], (err, result) => {
        if (err) {
            console.error('Error al verificar si sigues en el foro:', err);
            return res.status(500).json({ message: 'Error al verificar la participación' }); // Mensaje de error
        }

        if (result.rows.length === 0) {
            return res.status(400).json({ message: 'No sigues en este foro' }); // Mensaje de advertencia
        }

        const deleteQuery = 'DELETE FROM participantes WHERE user_id = $1 AND forum_or_group_id = $2 AND is_group = false';
        db.query(deleteQuery, [userId, forumId], (err) => {
            if (err) {
                console.error('Error al dejar de seguir del foro:', err);
                return res.status(500).json({ message: 'Error al dejar de seguir el foro' }); // Mensaje de error
            }

            res.status(200).json({ message: 'Dejaste de seguir el foro con éxito' }); // Mensaje de éxito
            io.to('user:' + req.user.id).emit('reloadFG');
        });
    });
});

app.post('/followUser', requireAuth, asyncRoute(async (req, res) => {
    const { followerId, followedId } = req.body;
    if (!validNumericId(followedId) || !sameUser(req, followerId) || String(followerId) === String(followedId)) throw requestError(400, 'Usuarios inválidos');
    await transaction(async client => {
        await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [followerId]);
        await assertNotBlocked(client, followerId, followedId);
        const user = await client.query('SELECT id FROM users WHERE id = $1', [followedId]);
        if (!user.rows.length) throw requestError(404, 'Usuario no encontrado');
        const following = await client.query('SELECT 1 FROM seguir WHERE follower_id = $1 AND followed_id = $2', [followerId, followedId]);
        if (following.rows.length) throw requestError(409, 'Ya seguís a este usuario');
        await client.query('INSERT INTO seguir (follower_id, followed_id, forum_id, created_at) VALUES ($1, $2, NULL, NOW())', [followerId, followedId]);
    });
    io.to('user:' + req.user.id).emit('reloadFG'); res.status(201).json({ message: 'Ahora seguís a este usuario' });
}));

app.post('/unfollowUser', requireAuth, (req, res) => {
    const { followerId, followedId } = req.body;

    if (!validNumericId(followedId) || !validNumericId(followerId) || !sameUser(req, followerId)) {
        return res.status(400).json({ message: 'Datos incompletos' });
    }

    // Verificamos si la relación de seguir existe
    const checkQuery = 'SELECT * FROM seguir WHERE follower_id = $1 AND followed_id = $2';
    db.query(checkQuery, [followerId, followedId], (err, result) => {
        if (err) {
            console.error('Error al verificar si sigues a este usuario:', err);
            return res.status(500).json({ message: 'Error al verificar si sigues a este usuario' });
        }

        if (result.rows.length === 0) {
            return res.status(400).json({ message: 'No sigues a este usuario' });
        }

        // Eliminamos la relación de seguimiento de la base de datos
        const deleteQuery = 'DELETE FROM seguir WHERE follower_id = $1 AND followed_id = $2';
        db.query(deleteQuery, [followerId, followedId], (err) => {
            if (err) {
                console.error('Error al dejar de seguir al usuario:', err);
                return res.status(500).json({ message: 'Error al dejar de seguir al usuario' });
            }

            res.status(200).json({ message: 'Has dejado de seguir a este usuario' });
            io.to('user:' + req.user.id).emit('reloadFG');
        });
    });
});

app.get('/search', asyncRoute(async (req,res) => {
    const query = req.query.query, offset = Number(req.query.offset || 0);
    if (!validText(query,200) || !Number.isSafeInteger(offset) || offset<0 || offset>10000) throw requestError(400,'Búsqueda inválida');
    const term = '%' + query.trim().replace(/[\\%_]/g, '\\$&') + '%';
    const [forums,users] = await Promise.all([
        db.query('SELECT id,name,description FROM foros WHERE name ILIKE $1 OR description ILIKE $1 ORDER BY name,id LIMIT 31 OFFSET $2',[term,offset]),
        db.query('SELECT id,username,image AS "profilePicture" FROM users WHERE username ILIKE $1 ORDER BY username,id LIMIT 31 OFFSET $2',[term,offset])
    ]);
    res.json({ foros:forums.rows.slice(0,30),usuarios:users.rows.slice(0,30),nextOffset:forums.rows.length>30 || users.rows.length>30 ? offset+30 : null });
}));

// Crear un chat privado
app.post('/createOrLoadPrivateChat', requireAuth, asyncRoute(async (req, res) => {
    const { user1Id, user2Id } = req.body;
    if (validNumericId(user2Id)) await assertNotBlocked(db, req.user.id, user2Id);
    if (!validNumericId(user2Id) || !sameUser(req, user1Id) || String(user1Id) === String(user2Id)) throw requestError(400, 'Usuarios inválidos');
    const chat = await transaction(async client => {
        const pair = [Number(user1Id), Number(user2Id)].sort((a, b) => a - b);
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['chat:' + pair.join(':')]);
        const existing = await client.query('SELECT id FROM chats WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)', pair);
        // Existing participants retain access to their conversation after unfollowing.
        if (existing.rows.length) return { id: existing.rows[0].id, created: false };
        const forward = await client.query('SELECT 1 FROM seguir WHERE follower_id = $1 AND followed_id = $2', pair);
        const backward = await client.query('SELECT 1 FROM seguir WHERE follower_id = $2 AND followed_id = $1', pair);
        if (!forward.rows.length || !backward.rows.length) throw requestError(403, 'Ambos usuarios deben seguirse para iniciar un chat');
        const result = await client.query('INSERT INTO chats (user1_id, user2_id, created_at) VALUES ($1, $2, NOW()) RETURNING id', pair);
        return { id: result.rows[0].id, created: true };
    });
    if (chat.created) io.to('user:' + req.user.id).emit('reloadFG');
    res.status(chat.created ? 201 : 200).json({ chatId: chat.id });
}));

app.get('/chat/messages/:chatId', requireAuth, async (req, res) => {
    const { chatId } = req.params;
      if (!validNumericId(chatId)) return res.status(400).json({ error: 'ID inválido' });
      const formattedChatId = `C-${chatId}`;

      try {
          const chat = await db.query(
              'SELECT 1 FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
              [chatId, req.user.id]
          );
          if (!chat.rows.length) return res.status(403).json({ error: 'Acceso denegado' });
          const result = await queryFeed(req, db,
            `SELECT 
                m.id,
                m.chat_or_group_id, 
                m.content, 
                m.sensitive, 
                m.sender_id, 
                m.created_at, 
                m.media, 
                m.media_type, 
                m.is_private,
                u.username, 
                u.image
            FROM mensajes m
            INNER JOIN users u ON m.sender_id = u.id
            WHERE m.chat_or_group_id = $1
            ORDER BY m.created_at ASC`,
            [formattedChatId]
        );

        res.status(200).json(feedResponse(result));
    } catch (error) {
        console.error('Error al cargar los mensajes del chat:', error);
        res.status(error.status || 500).json({ error: 'Error al cargar los mensajes del chat' });
    }
});

app.get('/group/messages/:groupId/:userId', requireAuth, async (req, res) => {
    const { groupId, userId } = req.params;
    
    // IMPORTANTE: Formatear el ID igual que en el POST
    const formattedGroupId = `G-${groupId}`; 
    const numericUserId = parseInt(userId, 10);
    if (!validId(groupId) || !sameUser(req, numericUserId)) {
        return res.status(403).json({ error: 'No tienes permiso para ver este grupo' });
    }

    try {
        const membership = await db.query(
            'SELECT 1 FROM participantes WHERE forum_or_group_id = $1 AND user_id = $2 AND is_group = TRUE',
            [groupId, numericUserId]
        );
        const owner = await db.query('SELECT 1 FROM grupos WHERE id = $1 AND owner_id = $2', [groupId, req.user.id]);
        if (!membership.rows.length && !owner.rows.length) return res.status(403).json({ error: 'No perteneces a este grupo' });
        const result = await queryFeed(req, db,
            `SELECT 
                m.id,
                m.chat_or_group_id, 
                m.content, 
                m.sensitive, 
                m.sender_id, 
                m.created_at, 
                m.media, 
                m.media_type, 
                m.is_private,
                u.username, 
                u.image
            FROM mensajes m
            INNER JOIN users u ON m.sender_id = u.id
            WHERE m.chat_or_group_id = $1  -- Aquí buscará "G-3"
            AND m.is_private = FALSE
            AND (m.sender_id = $3 OR (
                m.sender_id IN (SELECT user_id FROM participantes WHERE forum_or_group_id = $2 AND is_group = TRUE)
                AND m.sender_id IN (SELECT followed_id FROM seguir WHERE follower_id = $3)
                AND m.sender_id IN (SELECT follower_id FROM seguir WHERE followed_id = $3)
            ))
            ORDER BY m.created_at ASC`,
            [formattedGroupId, groupId, numericUserId]
        );

        res.status(200).json(feedResponse(result));
    } catch (error) {
        console.error('Error al cargar los mensajes del grupo:', error);
        res.status(error.status || 500).json({ error: 'Error al cargar los mensajes del grupo' });
    }
});

app.post('/group/messages/:groupId', requireAuth, async (req, res) => {
    const { groupId } = req.params;
    const { content, sensitive, sender_id, media, mediaType } = req.body;

    if (!validId(groupId) || !sameUser(req, sender_id) || !validPublication(content, media, mediaType) ||
        (sensitive !== undefined && typeof sensitive !== 'boolean') ||
        (media !== undefined && media !== null && !validText(media, 2000000)) ||
        (mediaType !== undefined && mediaType !== null && !validText(mediaType, 100))) {
        return res.status(400).json({ error: 'Contenido o remitente inválido' });
    }
    let client;
    try {
        client = await db.connect();
        await client.query('BEGIN');
        const replay = await replayPublication(client, req);
        if (replay) { await client.query('COMMIT'); return res.status(201).json(replay); }
        const isParticipant = await client.query(
            `SELECT COUNT(*) 
             FROM participantes 
             WHERE forum_or_group_id = $1 
             AND user_id = $2 
             AND is_group = TRUE`,
            [groupId, sender_id]
        );

        const owner = await client.query('SELECT 1 FROM grupos WHERE id = $1 AND owner_id = $2', [groupId, req.user.id]);
        if (parseInt(isParticipant.rows[0].count) === 0 && !owner.rows.length) {
            await client.query('ROLLBACK');
            return res.status(403).json({ error: 'No tienes permiso para publicar en este grupo.' });
        }

        await claimMedia(client, req, media, mediaType);
        const formattedGroupId = `G-${groupId}`;

        const result = await client.query(
            `INSERT INTO mensajes (chat_or_group_id, sender_id, content, sensitive, media, media_type, is_private, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, FALSE, NOW())
             RETURNING id, chat_or_group_id, content, sensitive, sender_id, media, media_type, created_at`,
            [formattedGroupId, sender_id, content, sensitive === true, media, mediaType]
        );

        const mensaje = result.rows[0];
        const formattedId = `G-${mensaje.id}`;

        await client.query(`UPDATE mensajes SET id = $1 WHERE id = $2`, [formattedId, mensaje.id]);
        mensaje.id = formattedId;

        await client.query(
            `INSERT INTO notificaciones (user_id, tipo, referencia_id, chat_or_group_id)
             SELECT user_id, 'grupo', $1, $2 FROM participantes
             WHERE forum_or_group_id = $3 AND is_group = TRUE AND user_id != $4
             AND user_id IN (SELECT follower_id FROM seguir WHERE followed_id = $4)
             AND user_id IN (SELECT followed_id FROM seguir WHERE follower_id = $4)`,
            [formattedId, formattedGroupId, groupId, sender_id]
        );

        await rememberPublication(client, req, mensaje);
        await client.query('COMMIT');
        await emitPrivateUpdate(formattedGroupId, req.user.id, 'reloadGPosts', { id: formattedId });
        res.status(201).json(mensaje);
    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('Error al publicar el mensaje:', error);
        res.status(error.status || 500).json({ error: error.status ? error.message : 'Error al publicar el mensaje.' });
    } finally { client?.release(); }
});

require('./community-lists')(app, { db, requireAuth });
require('./notifications')(app, { db, requireAuth });

app.put('/notificaciones/:user_id/leer', requireAuth, async (req, res) => {
    const { user_id } = req.params;
    const { id } = req.body;
    if (id !== undefined && !validNumericId(id)) return res.status(400).json({ error: 'ID inválido' });
    if (!sameUser(req, user_id)) return res.status(403).json({ error: 'Acceso denegado' });
    try {
        const result = id
            ? await db.query('UPDATE notificaciones SET leido = TRUE WHERE user_id = $1 AND id = $2', [user_id, id])
            : await db.query('UPDATE notificaciones SET leido = TRUE WHERE user_id = $1', [user_id]);
        res.json({ message: 'Notificación marcada como leída.', updated: result.rowCount });
    } catch (error) {
        console.error('Error al marcar notificación:', error);
        res.status(500).json({ error: 'Error al marcar notificación' });
    }
});

app.get('/session', requireAuth, async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
        const result = await db.query('SELECT id, username FROM public.users WHERE id = $1', [req.user.id]);
        if (!result.rows.length) return res.status(401).json({ error: 'La cuenta ya no existe' });
        // Refresh the signed name if it was changed from another tab.
        const user = result.rows[0];
        if (user.username !== req.user.username) setAuthCookie(res, jwt.sign(user, authSecret, { expiresIn: '7d' }));
        res.json(user);
    } catch (error) { res.status(500).json({ error: 'No se pudo recuperar la sesión' }); }
});

const internalOnly = (req,res,next) => requireAuth(req,res,() => {
    const admins = (process.env.ADMIN_USER_IDS || '').split(',').map(id => id.trim());
    if (!admins.includes(String(req.user.id))) return res.status(403).json({ error:'Acceso restringido' });
    next();
});
app.use(['/api/ups', '/dashboard', '/dashboard.html', '/html/dashboard.html'], internalOnly);
const stopMonitor = require.main === module ? require('./ups-monitor')(app) : () => {};
app.get('/health/live', (req,res) => res.json({ status:'ok' }));
app.get('/health/ready', async (req,res) => {
    try { await db.query('SELECT 1'); res.json({ status:'ready' }); }
    catch { res.status(503).json({ status:'unavailable' }); }
});
require('./gif-search')(app);
const renderPage = require('./page-renderer');
require('./public-posts')(app, db);
app.get('/manifest.webmanifest', (req, res) => res.redirect(308, '/manifest.json'));


// Keep historical root URLs while organizing physical files by type.
app.use((req,res,next) => {
    let pathname; try { pathname = decodeURIComponent(req.path).replace(/\/+/g, '/'); } catch { return res.status(400).end(); }
    const match = /^\/(?:html\/)?([a-zA-Z0-9_-]+)(?:\.html)?$/.exec(pathname);
    const page = req.path === '/' ? 'index' : match?.[1];
    const html = page && renderPage(page);
    if (!html || !['GET','HEAD'].includes(req.method)) return next();
    const send = () => res.set('Cache-Control','no-cache').type('html').send(html);
    if (page.toLowerCase() === 'dashboard') return internalOnly(req,res,send);
    send();
});
for (const directory of ['', 'html', 'css', 'scripts', 'json']) {
    app.use(express.static(path.join(__dirname, 'public', directory), {
        etag: true, lastModified: true, maxAge: 0, redirect: false,
        setHeaders: res => res.setHeader('Cache-Control', 'public, no-cache')
    }));
}

app.get('/:page?', (req, res) => {
    const page = req.params.page || 'index';
    if (!/^[a-zA-Z0-9_-]+$/.test(page)) return res.status(404).type('html').send(renderPage('error'));
    const filePath = path.join(__dirname, 'public', 'html', `${page}.html`);
    res.sendFile(filePath, err => {
        if (err) res.status(404).type('html').send(renderPage('error'));
    });
});

// Crear el servidor
const server = http.createServer(app);

// Inicializar Socket.IO en el servidor
const io = new Server(server, {
    cors: { origin: corsOrigin, credentials: true },
    allowRequest: (req, callback) => corsOrigin(req.headers.origin, (error, allowed) => callback(null, !error && allowed))
});

// Cuando un cliente se conecta
io.on('connection', (socket) => {
  console.log('Un cliente se ha conectado');
  
  // Aquí podrías hacer otras configuraciones, como emitir un mensaje de bienvenida

  // Cuando un cliente se desconecta
  socket.on('disconnect', () => {
    console.log('Un cliente se ha desconectado');
  });

});

io.use(async (socket, next) => {
    const token = getToken(socket.request) || socket.handshake.auth?.token;
    if (!token) return next();
    try {
        const claims = jwt.verify(token, authSecret, { algorithms: ['HS256'] });
        const user = (await db.query('SELECT id, auth_version FROM users WHERE id = $1', [claims.id])).rows[0];
        if (!user || Number(user.auth_version || 0) !== Number(claims.auth_version || 0)) throw new Error('Sesión inválida');
        socket.data.userId = user.id; socket.data.authVersion = Number(user.auth_version || 0);
        socket.data.expires = claims.exp * 1000;
        const expires = setTimeout(() => { socket.emit('sessionExpired'); socket.disconnect(true); }, Math.max(0, Math.min(2147483647, socket.data.expires - Date.now())));
        expires.unref(); socket.once('disconnect', () => clearTimeout(expires));
        socket.join('user:' + user.id);
        next();
    } catch { next(new Error('Sesión inválida')); }
});

const sessionAudit = setInterval(async () => {
    const sockets = [...io.sockets.sockets.values()].filter(socket => socket.data.userId);
    const ids = [...new Set(sockets.map(socket => socket.data.userId))];
    if (!ids.length) return;
    try {
        const users = new Map((await db.query('SELECT id,auth_version FROM users WHERE id=ANY($1::int[])', [ids])).rows.map(user => [user.id, Number(user.auth_version || 0)]));
        for (const socket of sockets) if (users.get(socket.data.userId) !== socket.data.authVersion) { socket.emit('sessionExpired'); socket.disconnect(true); }
    } catch { /* HTTP authorization continues to fail closed while the database is unavailable. */ }
}, 60000); sessionAudit.unref();

// Private events are delivered only to people allowed to read the message.
async function emitPrivateUpdate(context, author, event, payload) {
    try {
        const [kind, id] = context.split('-');
        let recipients = [];
        if (kind === 'C') {
            const chat = (await db.query('SELECT user1_id, user2_id FROM chats WHERE id = $1', [id])).rows[0];
            if (chat) recipients = [chat.user1_id, chat.user2_id];
        } else if (kind === 'G') {
            const result = await db.query(`SELECT u.id FROM users u WHERE
                (u.id IN (SELECT user_id FROM participantes WHERE forum_or_group_id = $1 AND is_group = TRUE)
                 OR u.id IN (SELECT owner_id FROM grupos WHERE id = $1))
                AND (u.id = $2 OR (u.id IN (SELECT follower_id FROM seguir WHERE followed_id = $2)
                AND u.id IN (SELECT followed_id FROM seguir WHERE follower_id = $2)))`, [id, author]);
            recipients = result.rows.map(row => row.id);
        }
        for (const id of recipients) io.to('user:' + id).emit(event, payload);
    } catch (error) { console.error('No se pudo enviar el aviso en tiempo real:', error.message); }
}

require('./community-tools')(app, { db, requireAuth, reactionAccess, transaction, io, emitPrivateUpdate });

app.post('/logout', (req, res) => {
    setAuthCookie(res, '', 0);
    res.status(204).end();
});

app.use((req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/get') || req.path.startsWith('/hit')) {
        return res.status(404).json({ error: 'Recurso no encontrado' });
    }
    res.status(404).type('html').send(renderPage('error'));
});

app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status || (error.code === '23505' ? 409 : 500);
    if (status < 500 && !error.type) return res.status(status).json({ error: error.message });
    res.status(status).json({ error: status === 413 ? 'El archivo o contenido es demasiado grande' : status === 400 ? 'Solicitud inválida' : status === 403 ? 'Origen no permitido' : 'Error interno del servidor' });
});

if (require.main === module) server.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});

let stopping = false;
async function shutdown() {
    if (stopping) return; stopping = true;
    clearInterval(sessionAudit);
    stopMonitor();
    const deadline = setTimeout(() => process.exit(1), 15000); deadline.unref();
    io.close();
    server.close(async () => { await db.end(); clearTimeout(deadline); });
    server.closeIdleConnections();
}
if (require.main === module) { process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown); }
module.exports = { app, server, db, io };
