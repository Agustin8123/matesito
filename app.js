const express = require('express');

const { Client } = require('pg');
const bcryptjs = require('bcryptjs');

const http = require('http');
const socketIo = require('socket.io');

require('dotenv').config();
const app = express();
const port = 3000;

app.use(express.json()); // Para recibir datos JSON

const db = new Client({
    host: 'dpg-d24044re5dus73b5nrvg-a.oregon-postgres.render.com', // Solo el host
    user: 'root', // Usuario
    password: 'vo1WkLOF9RwOLkJRUxLOOSVywFSswakm', // Contraseña
    database: 'matesito_7', // Base de datos
    port: 5432, // Puerto
    ssl: { rejectUnauthorized: false } // Asegura conexión segura
});

// Verificar conexión
db.connect()
  .then(() => console.log('Conexión a la base de datos PostgreSQL exitosa'))
  .catch(err => console.error('Error al conectar a la base de datos:', err));


 // Obtener la cantidad de reacciones
 app.get('/get/microreact--reactions/:id', async (req, res) => {
    const { id } = req.params;
    const reaction = req.query.reaction;
  
    if (!reaction) {
      return res.status(400).json({ error: 'Reaction parameter is missing' });
    }
  
    try {
      const result = await db.query(
        `SELECT SUM(count) AS total_count 
         FROM reactions 
         WHERE id LIKE $1 || '%' AND reaction_id = $2`,
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
  app.post('/hit/microreact--reactions/:id/:reaction', async (req, res) => {
    const { id, reaction } = req.params;
    const userId = req.body.user_id; // Se debe recibir el user_id en el request

    if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        // Verificar si el usuario ya reaccionó a este post
        const existingReaction = await db.query(
            'SELECT reaction_id FROM user_reactions WHERE user_id = $1 AND post_id = $2',
            [userId, id]
        );

        if (existingReaction.rows.length > 0) {
            const previousReaction = existingReaction.rows[0].reaction_id;

            if (previousReaction === reaction) {
                // Si ya reaccionó con la misma, la eliminamos
                await db.query('DELETE FROM user_reactions WHERE user_id = $1 AND post_id = $2', [userId, id]);
                await db.query('UPDATE reactions SET count = count - 1 WHERE id = $1 AND reaction_id = $2', [id, reaction]);
                io.emit('reloadReactions', { id });
                return res.status(200).json({ message: 'Reaction removed' });
            } else {
                // Si reaccionó con otra, la cambiamos
                await db.query('UPDATE user_reactions SET reaction_id = $1 WHERE user_id = $2 AND post_id = $3', [reaction, userId, id]);
                await db.query('UPDATE reactions SET count = count - 1 WHERE id = $1 AND reaction_id = $2', [id, previousReaction]);
                await db.query('UPDATE reactions SET count = count + 1 WHERE id = $1 AND reaction_id = $2', [id, reaction]);
                io.emit('reloadReactions', { id });
                return res.status(200).json({ message: 'Reaction updated' });
            }
        } else {
            // Si no ha reaccionado antes, la agregamos
            await db.query('INSERT INTO user_reactions (user_id, post_id, reaction_id) VALUES ($1, $2, $3)', [userId, id, reaction]);
            
            // Verificar si existe el conteo de la reacción en la tabla 'reactions'
            const reactionCount = await db.query('SELECT count FROM reactions WHERE id = $1 AND reaction_id = $2', [id, reaction]);
            if (reactionCount.rows.length === 0) {
                // Si no existe, insertamos una nueva entrada con conteo inicial de 1
                await db.query('INSERT INTO reactions (id, reaction_id, count) VALUES ($1, $2, 1)', [id, reaction]);
            } else {
                // Si existe, simplemente incrementamos el conteo
                await db.query('UPDATE reactions SET count = count + 1 WHERE id = $1 AND reaction_id = $2', [id, reaction]);
            }
            io.emit('reloadReactions', { id });
            return res.status(200).json({ message: 'Reaction added' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Ruta para obtener todas las reacciones del post
app.get('/get/microreact--reactionss/:id', async (req, res) => {
    const { id } = req.params;
  
    try {
        // Obtener todas las reacciones asociadas al post
        const result = await db.query(
            `SELECT reaction_id, count FROM reactions WHERE id = $1`,
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No reactions found for this post' });
        }

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
    const { username, password, profileImage, description } = req.body;
    const hashedPassword = await bcryptjs.hash(password, 10);

    const query = 'INSERT INTO users (username, password, image, description) VALUES ($1, $2, $3, $4) RETURNING id';
    db.query(query, [username, hashedPassword, profileImage || 'default-avatar.png', description || null], (err, result) => {
        if (err) {
            console.error("Error al insertar usuario:", err);
            res.status(500).json({ error: 'Error al crear el usuario' });
        } else {
            const userId = result.rows[0].id;
            res.status(201).json({ id: userId, username });
        }
    });
});

// Iniciar sesión con un usuario existente
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    const query = 'SELECT * FROM users WHERE username = $1';
    db.query(query, [username], async (err, results) => {
        if (err) {
            console.error('Error al buscar el usuario:', err);
            return res.status(500).json('Error al buscar el usuario');
        }

        console.log('Resultados de la consulta:', results);
        if (results.rows && results.rows.length > 0) {
            const user = results.rows[0];
            const isValidPassword = await bcryptjs.compare(password, user.password);

            if (isValidPassword) {
                console.log('Login exitoso para usuario:', username);
                return res.status(200).json({ username: user.username });
            } else {
                console.log('Contraseña incorrecta para usuario:', username);
                return res.status(401).json('Usuario o contraseña incorrectos');
            }
        } else {
            console.log('Usuario no encontrado:', username);
            return res.status(404).json('Usuario no encontrado');
        }
    });
});
;

// Crear un nuevo post
app.post('/posts', (req, res) => {
    const { username, content, media, mediaType, sensitive } = req.body;

    // Verifica si el usuario y el contenido están presentes
    if (!username || !content) {
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

        const isSensitive = !!sensitive; // Convierte cualquier valor "truthy" en true, y "falsy" en false
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

app.post('/mensajes/:forumId', async (req, res) => {
    const { forumId } = req.params; // Este es el chat_or_group_id
    const { content, sensitive, sender_id, created_at, media, mediaType, is_private } = req.body;

    try {
        // Insertar mensaje y obtener el ID generado
        const result = await db.query(
            `INSERT INTO mensajes (chat_or_group_id, content, sensitive, sender_id, created_at, media, media_type, is_private) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
             RETURNING id, chat_or_group_id, content, sensitive, sender_id, created_at, media, media_type, is_private`,
            [forumId, content, sensitive, sender_id, created_at, media, mediaType, is_private]
        );

        const mensaje = result.rows[0];

        // Crear el ID personalizado
        const formattedId = is_private ? `C-${mensaje.id}` : `F-${mensaje.id}`;

        // Actualizar el campo id con el ID formateado
        await db.query(
            `UPDATE mensajes SET id = $1 WHERE id = $2`,
            [formattedId, mensaje.id]
        );

        // Actualizar el objeto de respuesta con el ID formateado
        mensaje.id = formattedId;
        if (is_private) {
            // Si es privado (chat), crear notificación para el receptor
            const receptor = await db.query(
                `SELECT CASE 
                    WHEN user1_id = $1 THEN user2_id 
                    ELSE user1_id 
                END AS receptor 
                FROM chats 
                WHERE id = $2`,
                [sender_id, forumId] // Asegúrate de pasar el forumId correctamente
            );
            
            if (receptor.rows.length > 0) {
                // Insertar la notificación para el receptor
                await db.query(
                    `INSERT INTO notificaciones (user_id, tipo, referencia_id, chat_or_group_id)
                     VALUES ($1, 'mensaje', $2, $3)`,
                    [receptor.rows[0].receptor, formattedId, sender_id]
                );                
            }     
        } else {
            // Si no es privado (foro), crear notificaciones para los participantes del foro
            await db.query(
                `INSERT INTO notificaciones (user_id, tipo, referencia_id, chat_or_group_id)
                 SELECT user_id, 'foro', $1, $2 FROM participantes
                 WHERE forum_or_group_id = $2 AND is_group = FALSE AND user_id != $3`,
                [formattedId, forumId, sender_id]
            );
        }

        if (is_private) {
            io.emit('reloadCPosts');
        } else {
            io.emit('reloadFPosts');
        }
        res.status(201).json(mensaje);
    } catch (error) {
        console.error('Error al guardar el mensaje:', error);
        res.status(500).json({ error: 'Error al guardar el mensaje' });
    }
});

  app.get('/mensajes/:forumId', async (req, res) => {
    const forumId = parseInt(req.params.forumId, 10); // Convierte a número entero

    if (isNaN(forumId)) {
        return res.status(400).json({ error: 'ID del foro no válido' });
    }

    try {
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
            [forumId]
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
        JOIN users u ON t.username = u.username
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
        JOIN users u ON t.username = u.username
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

    const query = 'SELECT * FROM users WHERE username = $1';
    db.query(query, [username], (err, results) => {
        if (err) {
            console.error('Error en la consulta /getUserDetails:', err);
            return res.status(500).json({ message: 'Error al obtener los detalles del usuario' });
        }

        if (results.rows.length > 0) {
            const user = results.rows[0];
            res.status(200).json({
                id: user.id,  // Agregado: devolver también el id
                username: user.username,
                profileImage: user.image || 'default-avatar.png',
                description: user.description || ''
            });
        } else {
            res.status(404).json({ message: 'Usuario no encontrado' });
        }
    });
});

app.put('/updateProfileImage', (req, res) => {
    const { username, profileImage } = req.body;

    if (!username || !profileImage) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    const query = 'UPDATE users SET image = $1 WHERE username = $2';
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

app.put('/updateDescription', (req, res) => {
    const { username, description } = req.body;

    if (!username || !description) {
        return res.status(400).json({ success: false, message: 'Faltan datos.' });
    }

    const query = 'UPDATE users SET description = $1 WHERE username = $2';
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
app.put('/updateUsername', (req, res) => {
    const { currentUsername, newUsername } = req.body;

    if (!currentUsername || !newUsername) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    const query = 'UPDATE users SET username = $1 WHERE username = $2';
    db.query(query, [newUsername, currentUsername], (err, result) => {
        if (err) {
            console.error('Error al actualizar el nombre de usuario:', err);
            return res.status(500).json({ error: 'Error al actualizar el nombre de usuario' });
        }

        if (result.rowCount > 0) {
            res.status(200).json({ success: true, message: 'Nombre de usuario actualizado con éxito' });
        } else {
            res.status(404).json({ success: false, message: 'Usuario no encontrado' });
        }
    });
});

// Ruta para actualizar la contraseña
app.put('/updatePassword', async (req, res) => {
    const { username, currentPassword, newPassword } = req.body;

    if (!username || !currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    const query = 'SELECT password FROM users WHERE username = $1';
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
        const updateQuery = 'UPDATE users SET password = $1 WHERE username = $2';
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
app.post('/foros', (req, res) => {
    const { name, description, ownerId } = req.body;

    if (!name || !description || !ownerId) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    const checkQuery = 'SELECT id FROM foros WHERE name = $1';

    db.query(checkQuery, [name], (err, result) => {
        if (err) {
            console.error('Error al verificar el nombre del foro:', err);
            return res.status(500).json({ error: 'Error interno del servidor' });
        }

        if (result.rows.length > 0) {
            return res.status(400).json({ error: 'El nombre del foro ya está en uso' });
        }

        // Si el nombre no está en uso, procedemos a insertarlo
        const insertQuery = 'INSERT INTO foros (name, description, owner_id, created_at) VALUES ($1, $2, $3, $4) RETURNING id';

        db.query(insertQuery, [name, description, ownerId, new Date().toISOString()], (err, insertResult) => {
            if (err) {
                console.error('Error al crear el foro:', err);
                return res.status(500).json({ error: 'Error al crear el foro' });
            }

            res.status(201).json({ id: insertResult.rows[0].id, name, description });
            io.emit('reloadFG');
        });
    });
});

app.get('/foros', (req, res) => {
    const query = `
        SELECT foros.id, foros.name, foros.description, users.username AS owner_name
        FROM foros
        JOIN users ON foros.owner_id = users.id
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

app.post('/grupos', async (req, res) => {
    const { name, description, ownerId } = req.body;

    // Validar que los campos requeridos estén presentes
    if (!name || !description || !ownerId) {
        return res.status(400).json('Datos incompletos');
    }

    try {
        // Función para generar un código de invitación único
        async function generateUniqueInviteCode() {
            let inviteCode;
            let exists = true;

            while (exists) {
                inviteCode = Math.random().toString(36).substring(2, 8); // Generar código aleatorio de 6 caracteres

                // Verificar si el código ya existe
                const result = await db.query('SELECT 1 FROM grupos WHERE invite_code = $1', [inviteCode]);
                exists = result.rows.length > 0;
            }

            return inviteCode;
        }

        // Generar el código único
        const inviteCode = await generateUniqueInviteCode();

        // Insertar el nuevo grupo en la base de datos
        const query = `
            INSERT INTO grupos (name, description, owner_id, invite_code, created_at) 
            VALUES ($1, $2, $3, $4, $5) 
            RETURNING id, name, description, invite_code
        `;
        const result = await db.query(query, [
            name,
            description,
            ownerId,
            inviteCode,
            new Date().toISOString(),
        ]);

        // Responder con los datos del grupo creado

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error al crear el grupo:', error);
        res.status(500).json('Error al crear el grupo');
    }
});

app.get('/grupos-creados/:ownerId', async (req, res) => {
    const { ownerId } = req.params;

    // Validar que se haya proporcionado el ID del propietario
    if (!ownerId) {
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

app.delete('/grupo/:groupId/:ownerId', async (req, res) => {
    const { groupId, ownerId } = req.params;

    // Validar que el ID del propietario y del grupo estén presentes
    if (!groupId || !ownerId) {
        return res.status(400).json({ error: 'El ID del grupo y el propietario son requeridos' });
    }

    try {
        // Verificar si el grupo existe y si el propietario es el dueño del grupo
        const groupResult = await db.query(
            'SELECT owner_id FROM grupos WHERE id = $1',
            [groupId]
        );

        if (groupResult.rows.length === 0) {
            return res.status(404).json({ error: 'Grupo no encontrado' });
        }

        const groupOwnerId = groupResult.rows[0].owner_id;

        if (parseInt(ownerId) !== groupOwnerId) {
            return res.status(403).json({ error: 'No tienes permisos para eliminar este grupo' });
        }

        // Eliminar el grupo
        await db.query('DELETE FROM grupos WHERE id = $1', [groupId]);

        // Eliminar los participantes asociados al grupo
        await db.query('DELETE FROM participantes WHERE forum_or_group_id = $1 AND is_group = TRUE', [groupId]);

        res.status(200).json({ message: 'Grupo eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar el grupo:', error);
        res.status(500).json({ error: 'Error al procesar la solicitud' });
    }
});

app.post('/unir-grupo', async (req, res) => {
    const { inviteCode, userId } = req.body;

    // Validar que se envíen todos los datos necesarios
    if (!inviteCode || !userId) {
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

app.delete('/salir-grupo', async (req, res) => {
    const { groupId, userId } = req.body;

    // Validar que se envíen todos los datos necesarios
    if (!groupId || !userId) {
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

app.get('/grupos-usuario/:userId', async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json({ error: 'El ID del usuario es requerido' });
    }

    try {
        const gruposResult = await db.query(
            `
            SELECT g.id, g.name, g.description, g.invite_code, g.created_at, u.username AS owner_name
            FROM grupos g
            INNER JOIN participantes p ON g.id = p.forum_or_group_id
            INNER JOIN users u ON g.owner_id = u.id
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
app.get('/grupo/:id', async (req, res) => {
    const groupId = req.params.id;

    try {
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

app.get('/userCreatedForums/:userId', (req, res) => {
    const userId = req.params.userId;

    if (!userId) {
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

app.delete('/foros/:forumId', (req, res) => {
    const forumId = req.params.forumId;
    const { userId } = req.body; // El usuario que intenta eliminar el foro

    if (!forumId || !userId) {
        return res.status(400).json('Datos incompletos');
    }

    // Verificar que el usuario es el propietario del foro
    const verifyQuery = 'SELECT owner_id FROM foros WHERE id = $1';
    db.query(verifyQuery, [forumId], (err, result) => {
        if (err) {
            console.error('Error al verificar el foro:', err);
            return res.status(500).json('Error al verificar el foro');
        }

        if (result.rows.length === 0 || result.rows[0].owner_id !== userId) {
            return res.status(403).json('No tienes permiso para eliminar este foro');
        }

        // Eliminar el foro si es el propietario
        const deleteQuery = 'DELETE FROM foros WHERE id = $1';
        db.query(deleteQuery, [forumId], (err) => {
            if (err) {
                console.error('Error al eliminar el foro:', err);
                return res.status(500).json('Error al eliminar el foro');
            }

            res.status(200).json('Foro eliminado con éxito');
            io.emit('reloadFG');
        });
    });
});

app.post('/joinForum', (req, res) => {
    const { userId, forumId } = req.body;

    if (!userId || !forumId) {
        return res.status(400).json({ message: 'Datos incompletos' }); // Mensaje claro
    }

    const checkQuery = 'SELECT * FROM participantes WHERE user_id = $1 AND forum_or_group_id = $2 AND is_group = false';
    db.query(checkQuery, [userId, forumId], (err, result) => {
        if (err) {
            console.error('Error al verificar si sigues el foro:', err);
            return res.status(500).json({ message: 'Error al verificar la el seguimiento' }); // Mensaje de error
        }

        if (result.rows.length > 0) {
            return res.status(400).json({ message: 'Ya estás siguiendo este foro' }); // Mensaje de advertencia
        }

        const insertQuery = 'INSERT INTO participantes (user_id, forum_or_group_id, is_group, joined_at) VALUES ($1, $2, false, $3)';
        db.query(insertQuery, [userId, forumId, new Date().toISOString()], (err) => {
            if (err) {
                console.error('Error al unirse al foro:', err);
                return res.status(500).json({ message: 'Error al seguir al foro' }); // Mensaje de error
            }

            res.status(201).json({ message: 'Sigueiendo al foro con éxito' }); // Mensaje de éxito
            io.emit('reloadFG');
        });
    });
});

app.post('/leaveForum', (req, res) => {
    const { userId, forumId } = req.body;

    if (!userId || !forumId) {
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

app.get('/userForums/:userId', (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json('ID de usuario no proporcionado');
    }

    const query = `
        SELECT f.id, f.name, f.description, u.username AS owner_name
        FROM foros f
        INNER JOIN participantes p ON f.id = p.forum_or_group_id
        INNER JOIN users u ON f.owner_id = u.id
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
app.post('/followUser', (req, res) => {
    const { followerId, followedId } = req.body;

    if (!followerId || !followedId) {
        return res.status(400).json({ message: 'Datos incompletos' });
    }

    const checkQuery = 'SELECT * FROM seguir WHERE follower_id = $1 AND followed_id = $2';
    db.query(checkQuery, [followerId, followedId], (err, result) => {
        if (err) {
            console.error('Error al verificar si ya sigues a este usuario:', err);
            return res.status(500).json({ message: 'Error al verificar si ya sigues a este usuario' });
        }

        if (result.rows.length > 0) {
            return res.status(400).json({ message: 'Ya sigues a este usuario' });
        }

        const insertQuery = 'INSERT INTO seguir (follower_id, followed_id, forum_id, created_at) VALUES ($1, $2, NULL, $3)';
        db.query(insertQuery, [followerId, followedId, new Date().toISOString()], (err) => {
            if (err) {
                console.error('Error al seguir al usuario:', err);
                return res.status(500).json({ message: 'Error al seguir al usuario' });
            }

            res.status(201).json({ message: 'Ahora sigues a este usuario' });
            io.emit('reloadFG');
        });
    });
});

app.get('/followedUsers/:followerId', (req, res) => {
    const { followerId } = req.params;

    if (!followerId) {
        return res.status(400).json('ID de usuario no proporcionado');
    }

    const query = `
        SELECT u.id, u.username, u.id, u.image AS profilePicture
        FROM users u
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

app.post('/unfollowUser', (req, res) => {
    const { followerId, followedId } = req.body;

    if (!followerId || !followedId) {
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

    if (!query) {
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
        FROM users
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
app.post('/createOrLoadPrivateChat', (req, res) => {
    const { user1Id, user2Id } = req.body;

    if (!user1Id || !user2Id) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    // Verificar si los usuarios se siguen mutuamente usando la tabla `seguir`
    const checkFollowQuery = `
    SELECT COUNT(*) = 2 AS bothFollow
    FROM seguir
    WHERE (follower_id = $1 AND followed_id = $2)
    OR (follower_id = $2 AND followed_id = $1);
    `;
    db.query(checkFollowQuery, [user1Id, user2Id], (err, followResult) => {
        if (err) {
            console.error('Error al verificar si los usuarios se siguen mutuamente:', err);
            return res.status(500).json({ error: 'Error al verificar las relaciones de seguimiento' });
        }

        const bothFollow = followResult.rows[0].bothfollow;
        if (!bothFollow) {
            return res.status(403).json({ error: 'Ambos usuarios deben seguirse mutuamente para iniciar un chat' });
        }

        // Verificar si ya existe un chat entre estos dos usuarios
        const checkExistingChatQuery = `
            SELECT id FROM chats 
            WHERE (user1_id = $1 AND user2_id = $2) 
            OR (user1_id = $2 AND user2_id = $1)
        `;
        db.query(checkExistingChatQuery, [user1Id, user2Id], (err, chatResult) => {
            if (err) {
                console.error('Error al verificar el chat existente:', err);
                return res.status(500).json({ error: 'Error al verificar el chat existente' });
            }

            if (chatResult.rows.length > 0) {
                const chatId = chatResult.rows[0].id;

                // Retornar el chatId para que el frontend lo utilice
                return res.status(200).json({ chatId });
            } else {
                // Crear un nuevo chat si no existe
                const createChatQuery = `
                    INSERT INTO chats (user1_id, user2_id, created_at) 
                    VALUES ($1, $2, $3) RETURNING id
                `;
                db.query(createChatQuery, [user1Id, user2Id, new Date().toISOString()], (err, createResult) => {
                    if (err) {
                        console.error('Error al crear el chat privado:', err);
                        return res.status(500).json({ error: 'Error al crear el chat privado' });
                    }

                    return res.status(201).json({ chatId: createResult.rows[0].id });
                    io.emit('reloadFG');
                });
            }
        });
    });
});

  app.get('/chat/messages/:chatId', async (req, res) => {
    const { chatId } = req.params;

    try {
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
            [chatId]
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al cargar los mensajes del chat:', error);
        res.status(500).json({ error: 'Error al cargar los mensajes del chat' });
    }
});

app.get('/group/messages/:groupId/:userId', async (req, res) => {
    const { groupId, userId } = req.params;

    try {
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
            AND m.is_private = FALSE
            AND (
                m.sender_id IN (
                    SELECT user_id 
                    FROM participantes 
                    WHERE forum_or_group_id = $1 AND is_group = TRUE
                )
                AND m.sender_id IN (
                    SELECT followed_id 
                    FROM seguir 
                    WHERE follower_id = $2
                )
                AND m.sender_id IN (
                    SELECT follower_id 
                    FROM seguir 
                    WHERE followed_id = $2
                )
                OR m.sender_id = $2 -- Incluir siempre los mensajes del usuario activo
            )
            ORDER BY m.created_at ASC`,
            [groupId, userId]
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al cargar los mensajes del grupo:', error);
        res.status(500).json({ error: 'Error al cargar los mensajes del grupo' });
    }
});

app.post('/group/messages/:groupId', async (req, res) => {
    const { groupId } = req.params;
    const { content, sensitive, sender_id, media, mediaType } = req.body;

    try {
        // Validar que el usuario pertenece al grupo
        const isParticipant = await db.query(
            `SELECT COUNT(*) 
             FROM participantes 
             WHERE forum_or_group_id = $1 
             AND user_id = $2 
             AND is_group = TRUE`,
            [groupId, sender_id]
        );

        if (parseInt(isParticipant.rows[0].count) === 0) {
            return res.status(403).json({ error: 'No tienes permiso para publicar en este grupo.' });
        }

        // Insertar el mensaje en la base de datos
        const result = await db.query(
            `INSERT INTO mensajes (chat_or_group_id, sender_id, content, sensitive, media, media_type, is_private, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, FALSE, NOW())
             RETURNING id, chat_or_group_id, content, sensitive, sender_id, media, media_type, created_at`,
            [groupId, sender_id, content, sensitive, media, mediaType]
        );

        const mensaje = result.rows[0];

        // Crear el ID personalizado
        const formattedId = `G-${mensaje.id}`;

        // Actualizar el campo id con el ID formateado
        await db.query(
            `UPDATE mensajes SET id = $1 WHERE id = $2`,
            [formattedId, mensaje.id]
        );

        // Actualizar el objeto de respuesta con el ID formateado
        mensaje.id = formattedId;

        await db.query(
            `INSERT INTO notificaciones (user_id, tipo, referencia_id, chat_or_group_id)
             SELECT user_id, 'grupo', $1, $2 FROM participantes
             WHERE forum_or_group_id = $2 AND is_group = TRUE AND user_id != $3`,
            [formattedId, groupId, sender_id]
        );

        io.emit('reloadGPosts');
        res.status(201).json(mensaje);
    } catch (error) {
        console.error('Error al publicar el mensaje:', error);
        res.status(500).json({ error: 'Error al publicar el mensaje.' });
    }
});

app.get('/notificaciones/:user_id', async (req, res) => {
    const { user_id } = req.params;

    try {
        const notificaciones = await db.query(
            `SELECT n.id, n.tipo, n.referencia_id, n.chat_or_group_id, n.leido
             FROM notificaciones n
             WHERE n.user_id = $1 AND n.leido = FALSE;`,
            [user_id]
        );

        const notiDetalles = await Promise.all(
            notificaciones.rows.map(async (noti) => {
                let nombre;

                if (noti.tipo === 'foro') {
                    // Obtener el nombre del foro
                    const foro = await db.query(
                        `SELECT name FROM foros WHERE id = $1`,
                        [noti.chat_or_group_id]
                    );
                    if (foro.rows.length > 0) nombre = foro.rows[0].name;
                } else if (noti.tipo === 'grupo') {
                    // Obtener el nombre del grupo
                    const grupo = await db.query(
                        `SELECT name FROM grupos WHERE id = $1`,
                        [noti.chat_or_group_id]
                    );
                    if (grupo.rows.length > 0) nombre = grupo.rows[0].name;
                } else if (noti.tipo === 'mensaje') {             
                    const sender = await db.query(
                        `SELECT username FROM users WHERE id = $1`,
                        [noti.chat_or_group_id]
                    );                                 
                    if (sender.rows.length > 0) nombre = sender.rows[0].username;
                }
                
                console.log("Enviando notificación con nombre:", nombre); // <-- Agrega esto
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

app.put('/notificaciones/:user_id/leer', async (req, res) => {
    const { user_id } = req.params;
    const { id } = req.body; // Cambié referencia_id por id
    try {
        await db.query(
            `DELETE FROM notificaciones WHERE user_id = $1 AND id = $2;`,
            [user_id, id]
        );
        res.json({ message: 'Notificación eliminada.' });
    } catch (error) {
        console.error('Error al eliminar notificación:', error);
        res.status(500).json({ error: 'Error al eliminar notificación' });
    }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/:page?', (req, res) => {
    let page = req.params.page || 'inicio'; // Si no hay parámetro, usar 'inicio'
    let filePath = path.join(__dirname, 'public', `${page}.html`);

    res.sendFile(filePath, (err) => {
        if (err) {
            res.sendFile(path.join(__dirname, 'public', 'error.html')); // Si no existe, cargar error.html
        }
    });
});

// Crear el servidor
const server = app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});

// Iniciar Socket.IO en el servidor
const io = socketIo(server);

// Cuando un cliente se conecta
io.on('connection', (socket) => {
  console.log('Un cliente se ha conectado');
  
  // Aquí podrías hacer otras configuraciones, como emitir un mensaje de bienvenida

  // Cuando un cliente se desconecta
  socket.on('disconnect', () => {
    console.log('Un cliente se ha desconectado');
  });
});
// Iniciar el servidor