const express = require('express');
const { Client } = require('pg');
const bcryptjs = require('bcryptjs');
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

// Crear un nuevo tweet
app.post('/tweets', (req, res) => {
    const { username, content, media, mediaType, sensitive } = req.body;

    // Verifica si el usuario y el contenido están presentes
    if (!username || !content) {
        return res.status(400).json('Faltan datos requeridos');
    }

    const checkQuery = 'SELECT * FROM tweets WHERE username = $1 ORDER BY createdAt DESC LIMIT 1';
    db.query(checkQuery, [username], (err, result) => {
        if (err) {
            console.error('Error al verificar tweet previo:', err);
            return res.status(500).json('Error al verificar el tweet');
        }

        const lastTweet = result.rows[0];
        if (lastTweet && lastTweet.content === content) {
            return res.status(400).json('No puedes enviar el mismo tweet que el anterior.');
        }

        const query = `
            INSERT INTO tweets (username, tweet, content, media, mediatype, sensitive) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING id`;
        const params = [username, content, content, media || null, mediaType || null, sensitive || false];

        db.query(query, params, (err, result) => {
            if (err) {
                console.error('Error al insertar el tweet:', err);
                return res.status(500).json('Error al publicar el tweet');
            }
            const tweetId = result.rows[0].id;
            res.status(201).json({ id: tweetId, content, media, mediaType });
        });
    });
});


// Obtener todos los tweets
app.get('/tweets', (req, res) => {
    const query = `
        SELECT 
            t.id, t.username, t.content, t.media, t.mediatype, t.createdAt,
            u.image
        FROM tweets t
        JOIN users u ON t.username = u.username
        ORDER BY t.createdAt DESC
    `;
    
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener los tweets:', err);
            return res.status(500).json({ error: 'Error al obtener los tweets' });
        }
        
        const tweets = results.rows.map(tweet => ({
            id: tweet.id,
            username: tweet.username,
            content: tweet.content,
            media: tweet.media || null,
            mediaType: tweet.mediatype || null,
            createdAt: tweet.createdat,
            profilePicture: tweet.image || null, // Devuelve null si no hay imagen
        }));

        res.status(200).json(tweets);
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


app.use(express.static(path.join(__dirname, 'public')));

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
