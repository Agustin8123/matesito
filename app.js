const express = require('express');
const { Client } = require('pg');
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express();
const port = 3000;
const secretKey = '2spG4b2SbwuKNCT';

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

        if (results.rows && results.rows.length > 0) {
            const user = results.rows[0];
            const isValidPassword = await bcryptjs.compare(password, user.password);

            if (isValidPassword) {
                // Generar un token JWT
                const token = jwt.sign({ username: user.username, id: user.id }, secretKey, { expiresIn: '1d' }); // Expira en 1 día
                console.log('Login exitoso para usuario:', username);
                
                // Enviar el token como respuesta
                return res.status(200).json({ username: user.username, token });
            } else {
                return res.status(401).json('Usuario o contraseña incorrectos');
            }
        } else {
            return res.status(404).json('Usuario no encontrado');
        }
    });
});

app.post('/verifyToken', (req, res) => {
    const { token } = req.body;

    if (!token) {
        return res.status(401).json({ message: 'Token no proporcionado' });
    }

    jwt.verify(token, secretKey, (err, decoded) => {
        if (err) {
            return res.status(401).json({ message: 'Token inválido o expirado' });
        }
        
        // Token válido
        res.status(200).json({ username: decoded.username });
    });
});

// Crear un nuevo tweet
app.post('/tweets', (req, res) => {
    const { username, content, media, mediaType } = req.body;

    if (!username || !content) {
        return res.status(400).json('Faltan datos requeridos');
    }

    // Verificar si el último tweet del usuario es igual al nuevo
    const checkQuery = 'SELECT * FROM tweets WHERE username = $1 ORDER BY createdAt DESC LIMIT 1';
    db.query(checkQuery, [username], (err, result) => {
        if (err) {
            console.error('Error al verificar tweet previo:', err);
            return res.status(500).json('Error al verificar el tweet');
        }

        const lastTweet = result.rows[0];

        // Si el contenido del nuevo tweet es igual al último tweet, no permitir la publicación
        if (lastTweet && lastTweet.content === content) {
            return res.status(400).json('No puedes enviar el mismo tweet que el anterior.');
        }

        // Insertar el nuevo tweet
        const query = 'INSERT INTO tweets (username, tweet, content, media, mediatype) VALUES ($1, $2, $3, $4, $5) RETURNING id';
        db.query(query, [username, content, content, media, mediaType], (err, result) => {
            if (err) {
                console.error('Error al insertar el tweet:', err);
                return res.status(500).json('Error al publicar el tweet');
            } else {
                const tweetId = result.rows[0].id;
                res.status(201).json({ id: tweetId, content, media, mediaType });
            }
        });
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
