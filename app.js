//SERVER beta-2

const express = require('express');
const { Server } = require('socket.io');
const { Client } = require('pg');
const bcryptjs = require('bcryptjs');
const http = require('http');
const path = require('path');

require('dotenv').config();
const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static('.')); // Servir archivos estáticos desde el root

// Configuración de la base de datos (mantén tu configuración actual)
const db = new Client({
    host: 'localhost', // Solo el host
    user: 'root', // Usuario
    password: 'agustin2', // Contraseña
    database: 'matesito_8s', // Base de datos
    port: 5432, // Puerto
    ssl: { rejectUnauthorized: false } // Asegura conexión segura
});

db.connect()
  .then(() => console.log('Conexión a PostgreSQL exitosa'))
  .catch(err => console.error('Error de conexión:', err));

// ===== RUTAS ESENCIALES PARA TU FRONTEND =====

// Crear nuevo usuario (Registro)
app.post('/users', async (req, res) => {
    const { username, password, profileImage, description } = req.body;
    
    // Validaciones básicas
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }
    
    if (username.length > 25) {
        return res.status(400).json({ error: 'El usuario no puede tener más de 25 caracteres' });
    }

    try {
        const hashedPassword = await bcryptjs.hash(password, 10);
        const defaultImage = 'res/default-avatar.svg';
        
        const query = 'INSERT INTO public.users (username, password, image, description) VALUES ($1, $2, $3, $4) RETURNING id, username';
        const result = await db.query(query, [username, hashedPassword, profileImage || defaultImage, description || 'No hay descripción todavía.']);
        
        const userId = result.rows[0].id;
        res.status(201).json({ id: userId, username });
        
    } catch (err) {
        console.error("Error al crear usuario:", err);
        
        if (err.code === '23505') { // Violación de unique constraint
            res.status(400).json({ error: 'El nombre de usuario ya existe' });
        } else {
            res.status(500).json({ error: 'Error al crear el usuario' });
        }
    }
});

// Login de usuario
app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    try {
        const query = 'SELECT * FROM public.users WHERE username = $1';
        const results = await db.query(query, [username]);
        
        if (results.rows.length === 0) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

        const user = results.rows[0];
        const isValidPassword = await bcryptjs.compare(password, user.password);

        if (!isValidPassword) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        // Login exitoso
        res.status(200).json({ 
            username: user.username,
            id: user.id,
            profileImage: user.image 
        });
        
    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// Obtener detalles del usuario
app.post('/getUserDetails', async (req, res) => {
    const { username } = req.body;

    try {
        const query = 'SELECT id, username, image as profileImage, description FROM public.users WHERE username = $1';
        const results = await db.query(query, [username]);
        
        if (results.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const user = results.rows[0];
        res.status(200).json({
            id: user.id,
            username: user.username,
            profileImage: user.profileimage || 'res/default-avatar.svg',
            description: user.description || ''
        });
        
    } catch (error) {
        console.error('Error al obtener detalles:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
});

// Crear un nuevo post
app.post('/posts', async (req, res) => {
    const { username, content, media, mediaType, sensitive } = req.body;

    if (!username || !content) {
        return res.status(400).json({ error: 'Usuario y contenido requeridos' });
    }

    try {
        // Verificar post duplicado
        const checkQuery = 'SELECT * FROM posts WHERE username = $1 ORDER BY created_at DESC LIMIT 1';
        const checkResult = await db.query(checkQuery, [username]);
        
        const lastPost = checkResult.rows[0];
        if (lastPost && lastPost.content === content) {
            return res.status(400).json({ error: 'No puedes enviar el mismo post que el anterior' });
        }

        const isSensitive = !!sensitive;
        const query = `
            INSERT INTO posts (username, content, media, mediatype, sensitive, created_at) 
            VALUES ($1, $2, $3, $4, $5, $6) 
            RETURNING id, content, media, mediatype
        `;
        
        const params = [username, content, media || null, mediaType || null, isSensitive, new Date().toISOString()];
        const result = await db.query(query, params);
        
        const post = result.rows[0];
        
        // Emitir evento Socket.IO para actualizar posts en tiempo real
        io.emit('newPost', post);
        
        res.status(201).json(post);
        
    } catch (error) {
        console.error('Error al crear post:', error);
        res.status(500).json({ error: 'Error al publicar el post' });
    }
});

// Obtener todos los posts
app.get('/posts', async (req, res) => {
    try {
        const query = `
            SELECT 
                t.id AS postId, t.username, t.content, t.media, t.mediatype, 
                t.created_at, t.sensitive,
                u.id AS userId, u.image AS profilePicture
            FROM posts t
            JOIN public.users u ON t.username = u.username
            ORDER BY t.created_at DESC
        `;
        
        const results = await db.query(query);
        
        const posts = results.rows.map(post => ({
            postId: post.postid,
            userId: post.userid,
            username: post.username,
            content: post.content,
            media: post.media,
            mediaType: post.mediatype,
            created_at: post.created_at,
            profilePicture: post.profilepicture || 'res/default-avatar.svg',
            sensitive: !!post.sensitive
        }));

        res.status(200).json(posts);
        
    } catch (error) {
        console.error('Error al obtener posts:', error);
        res.status(500).json({ error: 'Error al obtener los posts' });
    }
});

// ===== RUTAS ADICIONALES (para futuras funcionalidades) =====

// Obtener posts de un usuario específico
app.get('/posts/user/:username', async (req, res) => {
    const { username } = req.params;
    
    try {
        const query = `
            SELECT 
                t.id AS postId, t.username, t.content, t.media, t.mediatype, 
                t.created_at, t.sensitive,
                u.id AS userId, u.image AS profilePicture
            FROM posts t
            JOIN public.users u ON t.username = u.username
            WHERE t.username = $1
            ORDER BY t.created_at DESC
        `;
        
        const results = await db.query(query, [username]);
        
        const posts = results.rows.map(post => ({
            postId: post.postid,
            userId: post.userid,
            username: post.username,
            content: post.content,
            media: post.media,
            mediaType: post.mediatype,
            created_at: post.created_at,
            profilePicture: post.profilepicture || 'res/default-avatar.svg',
            sensitive: !!post.sensitive
        }));

        res.status(200).json(posts);
        
    } catch (error) {
        console.error('Error al obtener posts del usuario:', error);
        res.status(500).json({ error: 'Error al obtener los posts' });
    }
});

// Servir el archivo principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ===== CONFIGURACIÓN DEL SERVIDOR =====
const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" }
});

io.on('connection', (socket) => {
    console.log('Cliente conectado');
    
    socket.on('disconnect', () => {
        console.log('Cliente desconectado');
    });
});

server.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});