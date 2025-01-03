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
    host: 'dpg-ctaka0ogph6c73ephsng-a.oregon-postgres.render.com', // Solo el host
    user: 'root', // Usuario
    password: 'BUkFrhcaMEnOI3cMszZijlrTFqcNbSoy', // Contraseña
    database: 'matesito', // Base de datos
    port: 5432, // Puerto
    ssl: { rejectUnauthorized: false } // Asegura conexión segura
});

// Verificar conexión
db.connect()
  .then(() => console.log('Conexión a la base de datos PostgreSQL exitosa'))
  .catch(err => console.error('Error al conectar a la base de datos:', err));

// Crear nuevo usuario
app.post('/users', async (req, res) => {
    const { username, password, profileImage } = req.body;
    const hashedPassword = await bcryptjs.hash(password, 10); // Cifrar la contraseña

    const query = 'INSERT INTO users (username, password, image) VALUES ($1, $2, $3) RETURNING id'; // Usamos RETURNING id para obtener el id insertado
    db.query(query, [username, hashedPassword, profileImage || 'default-avatar.png'], (err, result) => {
        if (err) {
            console.error("Error al insertar usuario:", err);  // Log del error
            res.status(500).json({ error: 'Error al crear el usuario' });  // Responder como JSON
        } else {
            const userId = result.rows[0].id; // Obtener el id desde result.rows[0].id
            res.status(201).json({ id: userId, username });  // Devolver el id y el username
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

    const checkQuery = 'SELECT * FROM posts WHERE username = $1 ORDER BY createdAt DESC LIMIT 1';
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
        INSERT INTO posts (username, content, media, mediatype, sensitive, createdAt) 
        VALUES ($1, $2, $3, $4, $5, $6) 
        RETURNING id`;

        const params = [username, content, media || null, mediaType || null, isSensitive, new Date().toISOString()];
        db.query(query, params, (err, result) => {
            if (err) {
                console.error('Error al insertar el post:', err);
                return res.status(500).json('Error al publicar el post');
            }
            const postId = result.rows[0].id;
            res.status(201).json({ id: postId, content, media, mediaType });
        });
    });
});

// Obtener todos los posts
app.get('/posts', (req, res) => {
    const query = `
        SELECT 
        t.id AS postId, t.username, t.content, t.media, t.mediatype, t.createdAt, t.sensitive,
        u.id AS userId, u.image AS profilePicture
        FROM posts t
        JOIN users u ON t.username = u.username
        ORDER BY t.createdAt DESC
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
            createdAt: post.createdat,
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
        t.id AS postId, t.username, t.content, t.media, t.mediatype, t.createdAt, t.sensitive,
        u.id AS userId
        FROM posts t
        JOIN users u ON t.username = u.username
        WHERE t.username = $1
        ORDER BY t.createdAt DESC
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
            createdAt: post.createdat,
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
                profileImage: user.image || 'default-avatar.png'
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
        return res.status(400).json('Datos incompletos');
    }

    const query = 'INSERT INTO foros (name, description, owner_id, created_at) VALUES ($1, $2, $3, $4) RETURNING id';
    db.query(query, [name, description, ownerId, new Date().toISOString()], (err, result) => {
        if (err) {
            console.error('Error al crear el foro:', err);
            return res.status(500).json('Error al crear el foro');
        }

        res.status(201).json({ id: result.rows[0].id, name, description });
    });
});

app.get('/foros', (req, res) => {
    const query = `
        SELECT id, name, description FROM forums ORDER BY name;
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener los foros:', err);
            return res.status(500).json({ error: 'Error al obtener los foros' });
        }

        const foros = results.rows.map(foro => ({
            id: foro.id,
            name: foro.name,
            description: foro.description
        }));

        res.status(200).json(foros);
    });
});


// Unirse a un foro
app.post('/joinForum', (req, res) => {
    const { userId, forumId } = req.body;

    if (!userId || !forumId) {
        return res.status(400).json('Datos incompletos');
    }

    const checkQuery = 'SELECT * FROM participantes WHERE user_id = $1 AND forum_or_group_id = $2 AND is_group = false';
    db.query(checkQuery, [userId, forumId], (err, result) => {
        if (err) {
            console.error('Error al verificar la participación en el foro:', err);
            return res.status(500).json('Error al verificar la participación');
        }

        if (result.rows.length > 0) {
            return res.status(400).json('Ya estás participando en este foro');
        }

        const insertQuery = 'INSERT INTO participantes (user_id, forum_or_group_id, is_group, joined_at) VALUES ($1, $2, false, $3)';
        db.query(insertQuery, [userId, forumId, new Date().toISOString()], (err) => {
            if (err) {
                console.error('Error al unirse al foro:', err);
                return res.status(500).json('Error al unirse al foro');
            }

            res.status(201).json({ message: 'Unido al foro con éxito' });
        });
    });
});

app.get('/userForums/:userId', (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).json('ID de usuario no proporcionado');
    }

    const query = `
        SELECT f.id, f.name, f.description
        FROM foros f
        INNER JOIN participantes p ON f.id = p.forum_or_group_id
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
        });
    });
});


app.get('/followedUsers/:followerId', (req, res) => {
    const { followerId } = req.params;

    if (!followerId) {
        return res.status(400).json('ID de usuario no proporcionado');
    }

    const query = `
        SELECT u.id, u.username
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

// Crear un chat privado
app.post('/createPrivateChat', (req, res) => {
    const { user1Id, user2Id } = req.body;

    if (!user1Id || !user2Id) {
        return res.status(400).json('Datos incompletos');
    }

    // Verificar si ambos usuarios se siguen mutuamente
    const checkQuery = `
        SELECT * FROM seguir 
        WHERE (follower_id = $1 AND followed_id = $2) 
        AND (follower_id = $2 AND followed_id = $1)
    `;
    db.query(checkQuery, [user1Id, user2Id], (err, result) => {
        if (err) {
            console.error('Error al verificar el seguimiento mutuo:', err);
            return res.status(500).json('Error al verificar el seguimiento mutuo');
        }

        if (result.rows.length === 0) {
            return res.status(400).json('Ambos usuarios deben seguirse mutuamente');
        }

        const createChatQuery = 'INSERT INTO chats (user1_id, user2_id, created_at) VALUES ($1, $2, $3) RETURNING id';
        db.query(createChatQuery, [user1Id, user2Id, new Date().toISOString()], (err, result) => {
            if (err) {
                console.error('Error al crear el chat privado:', err);
                return res.status(500).json('Error al crear el chat privado');
            }

            res.status(201).json({ chatId: result.rows[0].id });
        });
    });
});

// Enviar un mensaje
app.post('/sendMessage', (req, res) => {
    const { senderId, chatOrGroupId, content, isPrivate, media, mediaType } = req.body;

    if (!senderId || !chatOrGroupId || !content) {
        return res.status(400).json('Datos incompletos');
    }

    const query = `
        INSERT INTO mensajes (content, media, media_type, sender_id, chat_or_group_id, is_private, created_at) 
        VALUES ($1, $2, $3, $4, $5, $6, $7) 
        RETURNING id
    `;
    db.query(query, [content, media || null, mediaType || null, senderId, chatOrGroupId, isPrivate, new Date().toISOString()], (err, result) => {
        if (err) {
            console.error('Error al enviar el mensaje:', err);
            return res.status(500).json('Error al enviar el mensaje');
        }

        res.status(201).json({ messageId: result.rows[0].id, content });
    });
});

// Buscar usuarios y foros
app.get('/search', (req, res) => {
    const { query } = req.query;

    if (!query) {
        return res.status(400).json('Consulta vacía');
    }

    const userQuery = 'SELECT * FROM users WHERE username LIKE $1';
    const forumQuery = 'SELECT * FROM foros WHERE name LIKE $1';

    db.query(userQuery, [`%${query}%`], (err, userResults) => {
        if (err) {
            console.error('Error al buscar usuarios:', err);
            return res.status(500).json('Error al buscar usuarios');
        }

        db.query(forumQuery, [`%${query}%`], (err, forumResults) => {
            if (err) {
                console.error('Error al buscar foros:', err);
                return res.status(500).json('Error al buscar foros');
            }

            res.status(200).json({
                users: userResults.rows,
                forums: forumResults.rows
            });
        });
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

// Función que envía el mensaje a todos los clientes cada 20 segundos
setInterval(() => {
  console.log('Enviando solicitud para recargar posts a todos los clientes');
  io.emit('reloadPosts'); // Emite el evento 'reloadPosts' a todos los clientes conectados
}, 20000); // 20000 ms = 20 segundo

app.use(express.static(path.join(__dirname, 'public')));

// Iniciar el servidor
