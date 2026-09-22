const fs = require('fs');
let s = fs.readFileSync('app.js', 'utf8');
function route(start, code) { const a = s.indexOf(start), b = s.indexOf('\n});', a) + 4; if (a < 0 || b < 4) throw Error(start); s = s.slice(0, a) + code + s.slice(b); }
route("app.post('/joinForum'", `app.post('/joinForum', requireAuth, asyncRoute(async (req, res) => {
    const { userId, forumId } = req.body;
    if (!validNumericId(forumId) || !sameUser(req, userId)) throw requestError(400, 'Datos inválidos');
    await transaction(async client => {
        const forum = await client.query('SELECT id FROM foros WHERE id = $1 FOR UPDATE', [forumId]);
        if (!forum.rows.length) throw requestError(404, 'Foro no encontrado');
        const member = await client.query('SELECT 1 FROM participantes WHERE user_id = $1 AND forum_or_group_id = $2 AND is_group = FALSE', [userId, forumId]);
        if (member.rows.length) throw requestError(409, 'Ya estás siguiendo este foro');
        await client.query('INSERT INTO participantes (user_id, forum_or_group_id, is_group, joined_at) VALUES ($1, $2, FALSE, NOW())', [userId, forumId]);
    });
    io.emit('reloadFG'); res.status(201).json({ message: 'Ahora seguís este foro' });
}));`);
route("app.post('/followUser'", `app.post('/followUser', requireAuth, asyncRoute(async (req, res) => {
    const { followerId, followedId } = req.body;
    if (!validNumericId(followedId) || !sameUser(req, followerId) || String(followerId) === String(followedId)) throw requestError(400, 'Usuarios inválidos');
    await transaction(async client => {
        await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [followerId]);
        const user = await client.query('SELECT id FROM users WHERE id = $1', [followedId]);
        if (!user.rows.length) throw requestError(404, 'Usuario no encontrado');
        const following = await client.query('SELECT 1 FROM seguir WHERE follower_id = $1 AND followed_id = $2', [followerId, followedId]);
        if (following.rows.length) throw requestError(409, 'Ya seguís a este usuario');
        await client.query('INSERT INTO seguir (follower_id, followed_id, forum_id, created_at) VALUES ($1, $2, NULL, NOW())', [followerId, followedId]);
    });
    io.emit('reloadFG'); res.status(201).json({ message: 'Ahora seguís a este usuario' });
}));`);
route("app.post('/createOrLoadPrivateChat'", `app.post('/createOrLoadPrivateChat', requireAuth, asyncRoute(async (req, res) => {
    const { user1Id, user2Id } = req.body;
    if (!validNumericId(user2Id) || !sameUser(req, user1Id) || String(user1Id) === String(user2Id)) throw requestError(400, 'Usuarios inválidos');
    const chat = await transaction(async client => {
        const pair = [Number(user1Id), Number(user2Id)].sort((a, b) => a - b);
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['chat:' + pair.join(':')]);
        const existing = await client.query('SELECT id FROM chats WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)', pair);
        // Existing participants retain access to their conversation after unfollowing.
        if (existing.rows.length) return { id: existing.rows[0].id, created: false };
        const forward = await client.query('SELECT 1 FROM seguir WHERE follower_id = $1 AND followed_id = $2', pair);
        const backward = await client.query('SELECT 1 FROM seguir WHERE follower_id = $2 AND followed_id = $1', pair);
        if (!forward.rows.length || !backward.rows.length) throw requestError(403, 'Ambos usuarios deben seguirse para iniciar un chat');
        const result = await client.query('INSERT INTO chats (user1_id, user2_id, created_at) VALUES ($1, $2, NOW()) RETURNING id', pair);
        return { id: result.rows[0].id, created: true };
    });
    if (chat.created) io.emit('reloadFG');
    res.status(chat.created ? 201 : 200).json({ chatId: chat.id });
}));`);
fs.writeFileSync('app.js', s);

s = fs.readFileSync('public/scripts.js', 'utf8');
function section(start, end, code) { const a = s.indexOf(start), b = s.indexOf(end, a + start.length); if (a < 0 || b < 0) throw Error(start); s = s.slice(0, a) + code + '\n\n' + s.slice(b); }
section('function loadForos()', 'function joinForum(', `async function loadForumMenu(kind) {
    const userId = users[activeUser]?.id;
    if (kind !== 'all' && !userId) return;
    const container = document.getElementById(kind === 'all' ? 'forosContainer' : kind === 'followed' ? 'forosContainer2' : 'createdForosContainer');
    const url = kind === 'all' ? '/foros' : kind === 'followed' ? '/userForums/' + userId : '/userCreatedForums/' + userId;
    try {
        const forums = await fetch(url).then(readResponse);
        container.replaceChildren();
        if (!forums.length) container.textContent = 'No hay foros en esta lista todavía.';
        for (const forum of forums) {
            const card = document.createElement('div'); card.className = 'forum-item';
            const title = document.createElement('h3'); title.textContent = forum.name;
            const description = document.createElement('p'); description.textContent = forum.description;
            card.append(title, description, menuButton('Ver foro', () => loadForumPosts(forum.id, loadAll)),
                menuButton(kind === 'created' ? 'Eliminar foro' : kind === 'followed' ? 'Dejar de seguir' : 'Seguir foro',
                    () => kind === 'created' ? deleteForum(forum.id) : kind === 'followed' ? leaveForum(forum.id) : joinForum(forum.id)));
            container.appendChild(card);
        }
    } catch (error) { notify(error.message, 'error'); }
}
function loadForos() { return loadForumMenu('all'); }`);
section('function loadUserForums()', 'async function deleteForum(', `function loadUserForums() { return loadForumMenu('followed'); }
function loadUserCreatedForums() { return loadForumMenu('created'); }`);
// Avoid errors on menus before authentication or just after signing out.
s = s.replaceAll('users[activeUser].id', 'users[activeUser]?.id');
// The socket is an enhancement: mutations also refresh their affected lists directly.
s = s.replaceAll("    notify(data.message);\n", "    notify(data.message);\n    reloadFG();\n");
s = s.replace("        createForumMenu();", "        reloadFG();\n        document.getElementById('forumName').value = '';\n        document.getElementById('forumDescription').value = '';\n        createForumMenu();");
fs.writeFileSync('public/scripts.js', s);
const index = fs.readFileSync('public/index.html', 'utf8').replaceAll('        reloadFPosts();', '        reloadFPosts(); obtenerNotificaciones();').replaceAll('        reloadGPosts();', '        reloadGPosts(); obtenerNotificaciones();').replaceAll('        reloadCPosts();', '        reloadCPosts(); obtenerNotificaciones();');
fs.writeFileSync('public/index.html', index);
