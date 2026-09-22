// Local-only visual QA with disposable data. Not used by npm start.
const express = require('express');
const { fixture } = require('./fixture.cjs');
const f = fixture();
f.memory.public.none(`INSERT INTO posts (username, content, sensitive, created_at)
    VALUES ('MateUno', 'Arrancamos la semana con un buen mate. ¿Amargo o dulce? 🧉', false, NOW()),
    ('MateDos', 'Qué lindo tener un lugar para compartir ideas y conocer gente. ¡Bienvenidos a la ronda!', false, NOW());`);
const preview = express();
preview.get('/__preview/login', (req, res) => {
    res.cookie('auth_token', f.token(), { httpOnly: true, sameSite: 'lax' });
    res.redirect('/');
});
preview.use(f.app);
preview.listen(3100, '127.0.0.1', () => console.log('Local preview: http://127.0.0.1:3100/__preview/login'));
