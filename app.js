const express = require('express');
const { Client } = require('pg');
const bcryptjs = require('bcryptjs');
const cloudinary = require('cloudinary').v2;
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

cloudinary.config({
  cloud_name: 'dtzl420mq',
  api_key: '848481859678637',
  api_secret: 'fBw0FjD4odakPW5_KY4alUAvV2c',
});



// Verificar conexión
db.connect()
  .then(() => console.log('Conexión a la base de datos PostgreSQL exitosa'))
  .catch(err => console.error('Error al conectar a la base de datos:', err));

// Crear nuevo usuario
app.post('/users', async (req, res) => {
    const { username, password, image } = req.body;
    const hashedPassword = await bcryptjs.hash(password, 10); // Cifrar la contraseña

    const query = 'INSERT INTO users (username, password, image) VALUES ($1, $2, $3)';
    db.query(query, [username, hashedPassword, image || 'default-avatar.png'], (err, result) => {
        if (err) {
            console.error("Error al insertar usuario:", err);  // Log del error
            res.status(500).json({ error: 'Error al crear el usuario' });  // Responder como JSON
        } else {
            res.status(201).json({ id: result.insertId, username });  // Responder con datos en formato JSON
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
    const { username, content, media, mediaType } = req.body;

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

        // Verificar si el contenido del nuevo tweet es igual al último tweet
        if (lastTweet && lastTweet.content === content) {
            return res.status(400).json('No puedes enviar el mismo tweet que el anterior.');
        }

        // Subir archivo a Cloudinary si hay media
        let mediaUrl = '';
        if (media) {
            cloudinary.uploader.upload(media, (error, result) => {
                if (error) {
                    return res.status(500).json('Error al subir el archivo.');
                }
                mediaUrl = result.secure_url;

                // Insertar el tweet en la base de datos con la URL de la imagen
                const query = 'INSERT INTO tweets (username, tweet, content, media, mediatype) VALUES ($1, $2, $3, $4, $5) RETURNING id';
                db.query(query, [username, content, content, mediaUrl, mediaType], (err, result) => {
                    if (err) {
                        console.error('Error al insertar el tweet:', err);
                        return res.status(500).json('Error al publicar el tweet');
                    }
                    const tweetId = result.rows[0].id;
                    res.status(201).json({ id: tweetId, content, media: mediaUrl, mediaType });
                });
            });
        } else {
            // Si no hay medios, solo se guarda el tweet
            const query = 'INSERT INTO tweets (username, tweet, content) VALUES ($1, $2, $3) RETURNING id';
            db.query(query, [username, content, content], (err, result) => {
                if (err) {
                    console.error('Error al insertar el tweet:', err);
                    return res.status(500).json('Error al publicar el tweet');
                }
                const tweetId = result.rows[0].id;
                res.status(201).json({ id: tweetId, content, media: null, mediaType: null });
            });
        }
    });
});

// Obtener todos los tweets
app.get('/tweets', (req, res) => {
    const query = 'SELECT * FROM tweets ORDER BY createdAt DESC';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener los tweets:', err);
            res.status(500).json({ error: 'Error al obtener los tweets' }); // Respuesta más clara
        } else {
            res.status(200).json(results.rows); // Devuelve solo los datos en la propiedad rows
        }
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
                image: user.image || 'default-avatar.png'
            });
        } else {
            res.status(404).json({ message: 'Usuario no encontrado' });
        }
    });
});



app.use(express.static(path.join(__dirname, 'public')));

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
