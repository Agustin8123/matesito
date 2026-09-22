const express = require('express');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const http = require('http');

require('dotenv').config();
const app = express();
if (require.main === module) require('./ups-monitor')(app);
app.disable('x-powered-by');
const port = Number(process.env.PORT) || 3000;
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET es obligatorio en producción');
}
const authSecret = jwtSecret || 'development-only-change-me';
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

const db = new Pool(poolConfig);
db.on('error', error => console.error('Error de conexión inactiva a PostgreSQL:', error.message));

app.use('/scripts.js', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

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

function requireAuth(req, res, next) {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: 'Autenticación requerida' });
    try {
        req.user = jwt.verify(token, authSecret);
        next();
    } catch {
        return res.status(401).json({ error: 'Sesión inválida o expirada' });
    }
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
    return typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value);
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
 app.get('/get/microreact--reactions/:id', async (req, res) => {
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
  app.post('/hit/microreact--reactions/:id/:reaction', requireAuth, asyncRoute(async (req, res) => {
    const { id, reaction } = req.params;
    const userId = req.user.id;
    if (!validReactionPostId(id) || !/^[1-5]$/.test(reaction) || !sameUser(req, req.body.user_id)) throw requestError(400, 'Reacción inválida');
    await transaction(async client => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [id]);
        const existing = await client.query('SELECT reaction_id FROM user_reactions WHERE user_id = $1 AND post_id = $2', [userId, id]);
        const previous = existing.rows[0]?.reaction_id;
        await client.query('DELETE FROM user_reactions WHERE user_id = $1 AND post_id = $2', [userId, id]);
        if (String(previous) !== reaction) await client.query('INSERT INTO user_reactions (user_id, post_id, reaction_id) VALUES ($1, $2, $3)', [userId, id, reaction]);
        // Derive totals from actual selections, including a newly selected reaction type.
        await client.query('DELETE FROM reactions WHERE id = $1', [id]);
        await client.query('INSERT INTO reactions (id, reaction_id, count) SELECT post_id, reaction_id, COUNT(*) FROM user_reactions WHERE post_id = $1 GROUP BY post_id, reaction_id', [id]);
    });
    io.emit('reloadReactions', { id });
    res.json({ message: 'Reacción actualizada' });
}));

// Ruta para obtener todas las reacciones del post
app.get('/get/microreact--reactionss/:id', async (req, res) => {
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

        res.status(200).json({ reactions });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

  app.get('/api/reactions/totals', async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, SUM(count) AS total
            FROM reactions
            GROUP BY id
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
app.post('/users', async (req, res) => {
    const { username, password, profileImage, description, token } = req.body;

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
});

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
        const results = await db.query('SELECT id, username, password FROM public.users WHERE username = $1', [username.trim()]);
        if (!results.rows.length || !(await bcryptjs.compare(password, results.rows[0].password))) {
            return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
        }
        const user = results.rows[0];
        const authToken = jwt.sign({ id: user.id, username: user.username }, authSecret, { expiresIn: '7d' });
        setAuthCookie(res, authToken);
        return res.status(200).json({ id: user.id, username: user.username });
    } catch (err) {
        console.error('Error al buscar el usuario:', err);
        return res.status(500).json({ error: 'Error al buscar el usuario' });
    }
});
;

// Crear un nuevo post
app.post('/posts', requireAuth, (req, res) => {
    const { username, content, media, mediaType, sensitive } = req.body;

    // Verifica si el usuario y el contenido están presentes
    if (username !== req.user.username || !validText(content, 10000) ||
        (media !== undefined && media !== null && !validText(media, 2000000)) ||
        (mediaType !== undefined && mediaType !== null && !validText(mediaType, 100))) {
        return res.status(400).json('Faltan datos requeridos');
    }

    const checkQuery = 'SELECT * FROM posts WHERE username = $1 ORDER BY created_at DESC LIMIT 1';
    db.query(checkQuery, [username], (err, result) => {
        if (err) {
            console.error('Error al verificar post previo:', err);
            return res.status(500).json('Error al verificar el post');
        }

        const lastpost = result.rows[0];
        if (lastpost && lastpost.content === content) {
            return res.status(400).json('No puedes enviar el mismo post que el anterior.');
        }

        if (sensitive !== undefined && typeof sensitive !== 'boolean') {
            return res.status(400).json('El campo sensitive debe ser booleano');
        }
        const isSensitive = sensitive === true;
        const query = `
        INSERT INTO posts (username, content, media, mediatype, sensitive, created_at) 
        VALUES ($1, $2, $3, $4, $5, $6) 
        RETURNING id`;

        const params = [username, content, media || null, mediaType || null, isSensitive, new Date().toISOString()];
        db.query(query, params, (err, result) => {
            if (err) {
                console.error('Error al insertar el post:', err);
                return res.status(500).json('Error al publicar el post');
            }
            const postId = result.rows[0].id;
            io.emit('reloadPosts');
            res.status(201).json({ id: postId, content, media, mediaType });
        });
    });
});

app.post('/mensajes/:forumId', requireAuth, async (req, res) => {
    const { forumId } = req.params;
    const { content, sensitive, sender_id, created_at, media, mediaType, is_private } = req.body;

    if (!validId(forumId) || !sameUser(req, sender_id) || !validText(content, 10000) ||
        (sensitive !== undefined && typeof sensitive !== 'boolean') ||
        (is_private !== undefined && typeof is_private !== 'boolean')) {
        return res.status(400).json({ error: 'Contenido o remitente inválido' });
    }
    let client;
    try {
        client = await db.connect();
        await client.query('BEGIN');
        const numericForumId = Number(forumId);
        if (is_private) {
            const chat = await client.query(
                'SELECT 1 FROM chats WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)',
                [numericForumId, req.user.id]
            );
            if (!chat.rows.length) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Acceso denegado' }); }
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

        await client.query('COMMIT');
        io.emit(is_private ? 'reloadCPosts' : 'reloadFPosts');
        res.status(201).json(mensaje);

    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('Error al guardar el mensaje:', error);
        res.status(500).json({ error: 'Error al guardar el mensaje' });
    } finally { client?.release(); }
});


app.get('/mensajes/:forumId', requireAuth, async (req, res) => {
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
            // Los foros son legibles por cualquier usuario autenticado; los chats
            // privados se restringen al participante anterior.
            const forum = await db.query('SELECT 1 FROM foros WHERE id = $1', [forumId]);
            if (!forum.rows.length) return res.status(404).json({ error: 'Foro no encontrado' });
        }
        const formattedId = isPrivate ? `C-${forumId}` : `F-${forumId}`;
        const result = await db.query(
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

        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al cargar los mensajes:', error);
        res.status(500).json({ error: 'Error al cargar los mensajes' });
    }
});


// Obtener todos los posts
app.get('/posts', (req, res) => {
    const query = `
        SELECT 
        t.id AS postId, t.username, t.content, t.media, t.mediatype, t.created_at, t.sensitive,
        u.id AS userId, u.image AS profilePicture
        FROM posts t
        LEFT JOIN public.users u ON t.username = u.username
        ORDER BY t.created_at DESC
    `;
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener los posts:', err);
            return res.status(500).json({ error: 'Error al obtener los posts' });
        }
        
        // Mapear los resultados para incluir los IDs
        const posts = results.rows.map(post => ({
            postId: post.postid, // ID del post
            userId: post.userid, // ID del usuario
            username: post.username,
            content: post.content,
            media: post.media || null,
            mediaType: post.mediatype || null,
            created_at: post.created_at,
            profilePicture: post.profilepicture || null,
            sensitive: !!post.sensitive // Asegúrate de que sea un booleano
        }));

        // Devolver los posts con los IDs incluidos
        res.status(200).json(posts);
    });
});

app.get('/posts/user/:username', (req, res) => {
    const { username } = req.params;
    const query = `
        SELECT 
        t.id AS postId, t.username, t.content, t.media, t.mediatype, t.created_at, t.sensitive,
        u.id AS userId, u.image AS profilePicture
        FROM posts t
        LEFT JOIN public.users u ON t.username = u.username
        WHERE t.username = $1
        ORDER BY t.created_at DESC
    `;
    
    db.query(query, [username], (err, results) => {
        if (err) {
            console.error('Error al obtener los posts del usuario:', err);
            return res.status(500).json({ error: 'Error al obtener los posts del usuario' });
        }

        const posts = results.rows.map(post => ({
            postId: post.postid, // ID del post
            userId: post.userid, // ID del usuario
            username: post.username,
            content: post.content,
            media: post.media || null,
            mediaType: post.mediatype || null,
            created_at: post.created_at,
            profilePicture: post.profilepicture || null,
            sensitive: !!post.sensitive // Asegúrate de que sea un booleano
        }));

        res.status(200).json(posts);
    });
});


const path = require('path');

// Ruta para obtener los detalles del usuario
app.post('/getUserDetails', (req, res) => {
    const { username } = req.body;

    const query = 'SELECT * FROM public.users WHERE username = $1';
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

app.put('/updateProfileImage', requireAuth, (req, res) => {
    const { username, profileImage } = req.body;

    if (username !== req.user.username || !validText(profileImage, 2000000)) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    const query = 'UPDATE public.users SET image = $1 WHERE username = $2';
    db.query(query, [profileImage, username], (err, result) => {
        if (err) {
            console.error('Error al actualizar la imagen de perfil:', err);
            return res.status(500).json({ error: 'Error al actualizar la imagen de perfil' });
        }

        if (result.rowCount > 0) {
            res.status(200).json({ success: true, message: 'Imagen de perfil actualizada con éxito' });
        } else {
            res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }
    });
});

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
        setAuthCookie(res, jwt.sign({ id: req.user.id, username: normalized }, authSecret, { expiresIn: '7d' }));
        res.json({ success: true, message: 'Nombre de usuario actualizado con éxito' });
    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'Ese nombre ya está en uso' : 'No se pudo actualizar el nombre' });
    } finally { client?.release(); }
});

// Ruta para actualizar la contraseña
app.put('/updatePassword', requireAuth, async (req, res) => {
    const { username, currentPassword, newPassword } = req.body;

    if (username !== req.user.username || !validText(currentPassword, 128) || !validText(newPassword, 128)) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    const query = 'SELECT password FROM public.users WHERE username = $1';
    db.query(query, [username], async (err, results) => {
        if (err) {
            console.error('Error al buscar la contraseña actual:', err);
            return res.status(500).json({ error: 'Error al verificar la contraseña actual' });
        }

        if (results.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const user = results.rows[0];
        const isValidPassword = await bcryptjs.compare(currentPassword, user.password);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
        }

        const hashedPassword = await bcryptjs.hash(newPassword, 10);
        const updateQuery = 'UPDATE public.users SET password = $1 WHERE username = $2';
        db.query(updateQuery, [hashedPassword, username], (err, result) => {
            if (err) {
                console.error('Error al actualizar la contraseña:', err);
                return res.status(500).json({ error: 'Error al actualizar la contraseña' });
            }

            if (result.rowCount > 0) {
                res.status(200).json({ success: true, message: 'Contraseña actualizada con éxito' });
            } else {
                res.status(404).json({ success: false, message: 'Usuario no encontrado' });
            }
        });
    });
});

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

app.get('/foros', (req, res) => {
    const query = `
        SELECT foros.id, foros.name, foros.description, public.users.username AS owner_name
        FROM foros
        JOIN public.users ON foros.owner_id = public.users.id
        ORDER BY foros.name;
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener los foros:', err);
            return res.status(500).json({ error: 'Error al obtener los foros' });
        }

        const foros = results.rows.map(foro => ({
            id: foro.id,
            name: foro.name,
            description: foro.description,
            ownerName: foro.owner_name // Ahora tenemos el nombre del creador
        }));

        res.status(200).json(foros);
    });
});

app.post('/grupos', requireAuth, asyncRoute(async (req, res) => {
    const { name, description, ownerId } = req.body;
    if (!validText(name, 30) || !validText(description, 2000) || !sameUser(req, ownerId)) throw requestError(400, 'Datos del grupo inválidos');
    const group = await transaction(async client => {
        const inviteCode = require('node:crypto').randomBytes(8).toString('hex');
        const result = await client.query('INSERT INTO grupos (name, description, owner_id, invite_code, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, name, description, invite_code', [name.trim(), description.trim(), req.user.id, inviteCode]);
        await client.query('INSERT INTO participantes (user_id, forum_or_group_id, is_group, joined_at) VALUES ($1, $2, TRUE, NOW())', [req.user.id, result.rows[0].id]);
        return result.rows[0];
    });
    io.emit('reloadFG');
    res.status(201).json(group);
}));

app.get('/grupos-creados/:ownerId', requireAuth, async (req, res) => {
    const { ownerId } = req.params;

    // Validar que se haya proporcionado el ID del propietario
    if (!validNumericId(ownerId) || !sameUser(req, ownerId)) {
        return res.status(400).json({ error: 'El ID del propietario es requerido' });
    }

    try {
        // Consultar los grupos creados por el usuario
        const query = `
            SELECT id, name, description, invite_code, created_at
            FROM grupos
            WHERE owner_id = $1
            ORDER BY created_at DESC
        `;
        const result = await db.query(query, [ownerId]);

        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener los grupos creados:', error);
        res.status(500).json({ error: 'Error al procesar la solicitud' });
    }
});

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
        io.emit('reloadFG');
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
        io.emit('reloadFG');
    } catch (error) {
        console.error('Error al salir del grupo:', error);
        res.status(500).json({ error: 'Error al procesar la solicitud' });
    }
});

app.get('/grupos-usuario/:userId', requireAuth, async (req, res) => {
    const { userId } = req.params;

    if (!validNumericId(userId) || !sameUser(req, userId)) {
        return res.status(400).json({ error: 'El ID del usuario es requerido' });
    }

    try {
        const gruposResult = await db.query(
            `
            SELECT g.id, g.name, g.description, g.invite_code, g.created_at, u.username AS owner_name
            FROM grupos g
            INNER JOIN participantes p ON g.id = p.forum_or_group_id
            INNER JOIN public.users u ON g.owner_id = u.id
            WHERE p.user_id = $1 AND p.is_group = TRUE
            ORDER BY g.created_at DESC
            `,
            [userId]
        );

        res.status(200).json(gruposResult.rows);
    } catch (error) {
        console.error('Error al obtener los grupos del usuario:', error);
        res.status(500).json({ error: 'Error al procesar la solicitud' });
    }
});

// Ruta para obtener los detalles de un grupo por su ID
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

app.get('/userCreatedForums/:userId', requireAuth, (req, res) => {
    const userId = req.params.userId;

    if (!validNumericId(userId) || !sameUser(req, userId)) {
        return res.status(400).json('ID de usuario no proporcionado');
    }

    const query = 'SELECT id, name, description FROM foros WHERE owner_id = $1';
    db.query(query, [userId], (err, result) => {
        if (err) {
            console.error('Error al obtener los foros del usuario:', err);
            return res.status(500).json('Error al obtener los foros del usuario');
        }

        res.status(200).json(result.rows);
    });
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
    io.emit('reloadFG'); res.status(201).json({ message: 'Ahora seguís este foro' });
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
            io.emit('reloadFG');
        });
    });
});

app.get('/userForums/:userId', requireAuth, (req, res) => {
    const { userId } = req.params;

    if (!validNumericId(userId) || !sameUser(req, userId)) {
        return res.status(400).json('ID de usuario no proporcionado');
    }

    const query = `
        SELECT f.id, f.name, f.description, u.username AS owner_name
        FROM foros f
        INNER JOIN participantes p ON f.id = p.forum_or_group_id
        INNER JOIN public.users u ON f.owner_id = u.id
        WHERE p.user_id = $1 AND p.is_group = false
    `;

    db.query(query, [userId], (err, result) => {
        if (err) {
            console.error('Error al cargar los foros del usuario:', err);
            return res.status(500).json('Error al cargar los foros del usuario');
        }

        res.status(200).json(result.rows);
    });
});

// Seguir un usuario
app.post('/followUser', requireAuth, asyncRoute(async (req, res) => {
    const { followerId, followedId } = req.body;
    if (!validNumericId(followedId) || !sameUser(req, followerId) || String(followerId) === String(followedId)) throw requestError(400, 'Usuarios inválidos');
    await transaction(async client => {
        await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [followerId]);
        const user = await client.query('SELECT id FROM users WHERE id = $1', [followedId]);
        if (!user.rows.length) throw requestError(404, 'Usuario no encontrado');
        const following = await client.query('SELECT 1 FROM seguir WHERE follower_id = $1 AND followed_id = $2', [followerId, followedId]);
        if (following.rows.length) throw requestError(409, 'Ya seguís a este usuario');
        await client.query('INSERT INTO seguir (follower_id, followed_id, forum_id, created_at) VALUES ($1, $2, NULL, NOW())', [followerId, followedId]);
    });
    io.emit('reloadFG'); res.status(201).json({ message: 'Ahora seguís a este usuario' });
}));

app.get('/followedUsers/:followerId', requireAuth, (req, res) => {
    const { followerId } = req.params;

    if (!validNumericId(followerId) || !sameUser(req, followerId)) {
        return res.status(400).json('ID de usuario no proporcionado');
    }

    const query = `
        SELECT u.id, u.username, u.id, u.image AS profilePicture
        FROM public.users u
        INNER JOIN seguir s ON u.id = s.followed_id
        WHERE s.follower_id = $1
    `;

    db.query(query, [followerId], (err, result) => {
        if (err) {
            console.error('Error al cargar los usuarios seguidos:', err);
            return res.status(500).json('Error al cargar los usuarios seguidos');
        }

        res.status(200).json(result.rows);
    });
});

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
            io.emit('reloadFG');
        });
    });
});

app.get('/search', (req, res) => {
    const { query } = req.query;  // El término de búsqueda se pasa como parámetro 'query'

    if (!validText(query, 200)) {
        return res.status(400).json({ message: 'Consulta vacía' });
    }

    // Buscando foros por nombre o descripción
    const forosQuery = `
        SELECT id, name, description
        FROM foros
        WHERE name ILIKE $1 OR description ILIKE $1
        ORDER BY name;
    `;
    
    // Buscando usuarios por nombre de usuario
    const usersQuery = `
        SELECT id, username, image
        FROM public.users
        WHERE username ILIKE $1
        ORDER BY username;
    `;

    // Ejecutamos las dos consultas en paralelo
    db.query(forosQuery, [`%${query}%`], (err, foroResults) => {
        if (err) {
            console.error('Error al obtener los foros:', err);
            return res.status(500).json({ error: 'Error al obtener los foros' });
        }

        db.query(usersQuery, [`%${query}%`], (err, userResults) => {
            if (err) {
                console.error('Error al obtener los usuarios:', err);
                return res.status(500).json({ error: 'Error al obtener los usuarios' });
            }

            // Mapear los resultados de los foros
            const foros = foroResults.rows.map(foro => ({
                id: foro.id,
                name: foro.name,
                description: foro.description
            }));

            // Mapear los resultados de los usuarios
            const usuarios = userResults.rows.map(user => ({
                id: user.id,
                username: user.username,
                profilePicture: user.image || null
            }));

            // Devolver los resultados de la búsqueda
            res.status(200).json({
                foros: foros,
                usuarios: usuarios
            });
        });
    });
});

// Crear un chat privado
app.post('/createOrLoadPrivateChat', requireAuth, asyncRoute(async (req, res) => {
    const { user1Id, user2Id } = req.body;
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
    if (chat.created) io.emit('reloadFG');
    res.status(chat.created ? 201 : 200).json({ chatId: chat.id });
}));

app.get('/chats', requireAuth, asyncRoute(async (req, res) => {
    const result = await db.query(
        `SELECT c.id, c.created_at, u.id AS user_id, u.username, u.image
         FROM chats c JOIN users u ON u.id = CASE WHEN c.user1_id = $1 THEN c.user2_id ELSE c.user1_id END
         WHERE c.user1_id = $1 OR c.user2_id = $1 ORDER BY c.created_at DESC`, [req.user.id]
    );
    res.json(result.rows);
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
          const result = await db.query(
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

        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al cargar los mensajes del chat:', error);
        res.status(500).json({ error: 'Error al cargar los mensajes del chat' });
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
        const result = await db.query(
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
            AND (
                (
                    m.sender_id IN (
                        SELECT user_id 
                        FROM participantes 
                        WHERE forum_or_group_id = $2 AND is_group = TRUE -- Aquí usamos el ID numérico
                    )
                    AND m.sender_id IN (
                        SELECT followed_id FROM seguir WHERE follower_id = $3
                    )
                    AND m.sender_id IN (
                        SELECT follower_id FROM seguir WHERE followed_id = $3
                    )
                )
                OR m.sender_id = $3 
            )
            ORDER BY m.created_at ASC`,
            [formattedGroupId, groupId, numericUserId] // Pasamos 3 parámetros
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al cargar los mensajes del grupo:', error);
        res.status(500).json({ error: 'Error al cargar los mensajes del grupo' });
    }
});

app.post('/group/messages/:groupId', requireAuth, async (req, res) => {
    const { groupId } = req.params;
    const { content, sensitive, sender_id, media, mediaType } = req.body;

    if (!validId(groupId) || !sameUser(req, sender_id) || !validText(content, 10000) ||
        (sensitive !== undefined && typeof sensitive !== 'boolean') ||
        (media !== undefined && media !== null && !validText(media, 2000000)) ||
        (mediaType !== undefined && mediaType !== null && !validText(mediaType, 100))) {
        return res.status(400).json({ error: 'Contenido o remitente inválido' });
    }
    let client;
    try {
        client = await db.connect();
        await client.query('BEGIN');
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
             WHERE forum_or_group_id = $3 AND is_group = TRUE AND user_id != $4`,
            [formattedId, formattedGroupId, groupId, sender_id]
        );

        await client.query('COMMIT');
        io.emit('reloadGPosts');
        res.status(201).json(mensaje);
    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('Error al publicar el mensaje:', error);
        res.status(500).json({ error: 'Error al publicar el mensaje.' });
    } finally { client?.release(); }
});

app.get('/notificaciones/:user_id', requireAuth, async (req, res) => {
    const { user_id } = req.params;
    if (!sameUser(req, user_id)) return res.status(403).json({ error: 'Acceso denegado' });

    try {
        const notificaciones = await db.query(
            `SELECT n.id, n.tipo, n.referencia_id, n.chat_or_group_id, n.leido
             FROM notificaciones n
             WHERE n.user_id = $1 AND n.leido = FALSE;`,
            [user_id]
        );

        const notiDetalles = await Promise.all(
            notificaciones.rows.map(async (noti) => {

                const rawId = noti.chat_or_group_id; // "C-5", "G-3", "F-2"
                const prefix = rawId.split('-')[0];
                const numericId = parseInt(rawId.split('-')[1], 10);

                let nombre = 'Desconocido';

                if (prefix === 'F') {
                    const foro = await db.query(
                        `SELECT name FROM foros WHERE id = $1`,
                        [numericId]
                    );
                    if (foro.rows.length > 0) nombre = foro.rows[0].name;

                } else if (prefix === 'G') {
                    const grupo = await db.query(
                        `SELECT name FROM grupos WHERE id = $1`,
                        [numericId]
                    );
                    if (grupo.rows.length > 0) nombre = grupo.rows[0].name;

                } else if (prefix === 'C') {
                    const user = await db.query(
                        `SELECT u.username FROM chats c JOIN users u
                         ON u.id = CASE WHEN c.user1_id = $2 THEN c.user2_id ELSE c.user1_id END
                         WHERE c.id = $1 AND (c.user1_id = $2 OR c.user2_id = $2)`,
                        [numericId, user_id]
                    );
                    if (user.rows.length > 0) nombre = user.rows[0].username;
                }

                return {
                    id: noti.id,
                    tipo: noti.tipo,
                    referencia_id: noti.referencia_id,
                    chat_or_group_id: noti.chat_or_group_id,
                    leido: noti.leido,
                    nombre,
                };
            })
        );

        res.json(notiDetalles);

    } catch (error) {
        console.error('Error al obtener notificaciones:', error);
        res.status(500).json({ error: 'Error al obtener notificaciones' });
    }
});


app.put('/notificaciones/:user_id/leer', requireAuth, async (req, res) => {
    const { user_id } = req.params;
    const { id } = req.body; // Cambié referencia_id por id
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

app.use(express.static(path.join(__dirname, 'public'), {
    etag: false,
    lastModified: false,
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
}));

app.get('/:page?', (req, res) => {
    const page = req.params.page || 'index';
    if (!/^[a-zA-Z0-9_-]+$/.test(page)) return res.status(404).sendFile(path.join(__dirname, 'public', 'error.html'));
    const filePath = path.join(__dirname, 'public', `${page}.html`);
    res.sendFile(filePath, err => {
        if (err) res.status(404).sendFile(path.join(__dirname, 'public', 'error.html'));
    });
});

// Crear el servidor
const server = http.createServer(app);

// Inicializar Socket.IO en el servidor
const io = new Server(server, {
    cors: { origin: corsOrigin, credentials: true }
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

io.use((socket, next) => {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    if (!token) return next();
    try {
        socket.user = jwt.verify(token, authSecret);
        next();
    } catch {
        next(new Error('Sesión inválida'));
    }
});

app.post('/logout', (req, res) => {
    setAuthCookie(res, '', 0);
    res.status(204).end();
});

app.use((req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/get') || req.path.startsWith('/hit')) {
        return res.status(404).json({ error: 'Recurso no encontrado' });
    }
    res.status(404).sendFile(path.join(__dirname, 'public', 'error.html'));
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

module.exports = { app, server, db, io };
