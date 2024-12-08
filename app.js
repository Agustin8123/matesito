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
    
    console.log('Solicitud de login recibida:', req.body);

    const { username, password } = req.body;

    const query = 'SELECT * FROM users WHERE username = $1';
    db.query(query, [username], async (err, results) => {
        if (err) {
            return res.status(500).json('Error al buscar el usuario');
        }

        if (results.length > 0) {
            const user = results[0];
            const isValidPassword = await bcryptjs.compare(password, user.password);

            if (isValidPassword) {
                res.status(200).json({ username: user.username });
            } else {
                res.status(401).json('Usuario o contraseña incorrectos');
            }
        } else {
            res.status(404).json('Usuario no encontrado');
        }
    });
});

// Crear un nuevo tweet
app.post('/tweets', (req, res) => {
    const { username, content, media, mediaType } = req.body;

    const query = 'INSERT INTO tweets (username, content, media, mediaType) VALUES ($1, $2, $3, $4)';
    db.query(query, [username, content, media, mediaType], (err, result) => {
        if (err) {
            res.status(500).json('Error al publicar el tweet');
        } else {
            res.status(201).json({ id: result.insertId, content, media, mediaType });
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
    const { username } = req.body; // Extrae el nombre de usuario desde la solicitud

    // Consulta a la base de datos para obtener el usuario
    const query = 'SELECT * FROM users WHERE username = $1';
    db.query(query, [username], (err, results) => {
        if (err) {
            return res.status(500).json({ message: 'Error al obtener los detalles del usuario' });
        }

        if (results.length > 0) {
            const user = results[0]; // El primer usuario que coincida con el nombre de usuario
            // Devolver los detalles del usuario (puedes ajustar los campos que quieres devolver)
            res.status(200).json({
                username: user.username,
                password: user.password, // Devolver la contraseña cifrada (para comparación)
                image: user.image || 'default-avatar.png' // Si tiene una imagen de perfil, la devolvemos
            });
        } else {
            // Si no se encuentra el usuario
            res.status(404).json({ message: 'Usuario no encontrado' });
        }
    });
});

app.use(express.static(path.join(__dirname, 'public')));

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
