const fs = require('node:fs');
let s = fs.readFileSync('app.js', 'utf8').replace(/\r\n/g, '\n');
const a = s.indexOf("app.put('/updateUsername'");
const b = s.indexOf('// Ruta para actualizar la contraseña', a);
s = s.slice(0, a) + `app.put('/updateUsername', requireAuth, async (req, res) => {
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

` + s.slice(b);
// A message and its notifications must commit together, otherwise retries duplicate messages.
for (const start of ["app.post('/mensajes/:forumId'", "app.post('/group/messages/:groupId'"]) {
    const a = s.indexOf(start), b = s.indexOf('\n});', a) + 4;
    let route = s.slice(a, b);
    route = route.replace('    try {', "    let client;\n    try {\n        client = await db.connect();\n        await client.query('BEGIN');");
    route = route.replaceAll('await db.query(', 'await client.query(');
    // Roll back even for early access-denied returns.
    route = route.replace(/if \(!([a-z]+)\.rows\.length\) return res\.status\(403\)\.json\(\{ error: 'Acceso denegado' \}\);/g,
        "if (!$1.rows.length) { await client.query('ROLLBACK'); return res.status(403).json({ error: 'Acceso denegado' }); }");
    route = route.replace("if (parseInt(isParticipant.rows[0].count) === 0) {", "if (parseInt(isParticipant.rows[0].count) === 0) {\n            await client.query('ROLLBACK');");
    route = route.replace('        io.emit(', "        await client.query('COMMIT');\n        io.emit(");
    route = route.replace('    } catch (error) {', "    } catch (error) {\n        if (client) await client.query('ROLLBACK').catch(() => {});");
    route = route.replace(/\n    }\n}\);$/, '\n    } finally { client?.release(); }\n});');
    s = s.slice(0, a) + route + s.slice(b);
}
fs.writeFileSync('app.js', s);
