const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
require('dotenv').config();
const app = express();
const port = 3000;

app.use(express.json()); // Para recibir datos JSON
app.use(express.json({ limit: '10mb' }));  // Limitar el tamaño de los JSON a 10 MB
app.use(express.urlencoded({ limit: '10mb', extended: true }));  // Limitar los datos de formulario


// Conectar a la base de datos MySQL
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// Verificar conexión
db.connect((err) => {
    if (err) {
        console.error('Error al conectar a la base de datos: ' + err.stack);
        return;
    }
    console.log('Conectado a la base de datos MySQL');
});

// Crear nuevo usuario
app.post('/users', async (req, res) => {
    const { username, password, image } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10); // Cifrar la contraseña

    const query = 'INSERT INTO users (username, password, image) VALUES (?, ?, ?)';
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

    const query = 'SELECT * FROM users WHERE username = ?';
    db.query(query, [username], async (err, results) => {
        if (err) {
            return res.status(500).json('Error al buscar el usuario');
        }

        if (results.length > 0) {
            const user = results[0];
            const isValidPassword = await bcrypt.compare(password, user.password);

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

    const query = 'INSERT INTO tweets (username, content, media, mediaType) VALUES (?, ?, ?, ?)';
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
            res.status(500).json('Error al obtener los tweets');
        } else {
            res.status(200).json(results);
        }
    });
});

const path = require('path');

// Ruta para obtener los detalles del usuario
app.post('/getUserDetails', (req, res) => {
    const { username } = req.body; // Extrae el nombre de usuario desde la solicitud

    // Consulta a la base de datos para obtener el usuario
    const query = 'SELECT * FROM users WHERE username = ?';
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
