const fs = require('node:fs');
let s = fs.readFileSync('app.js', 'utf8');
function route(start, code) {
    const a = s.indexOf(start), b = s.indexOf('\n});', a) + 4;
    if (a < 0 || b < 4) throw Error(start);
    s = s.slice(0, a) + code + s.slice(b);
}
const helper = `
function requestError(status, message) { return Object.assign(new Error(message), { status }); }
async function transaction(action) {
    const client = await db.connect();
    try {
        await client.query('BEGIN');
        const result = await action(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
    } finally { client.release(); }
}
const asyncRoute = action => (req, res, next) => Promise.resolve(action(req, res)).catch(next);

`;
s = s.replace(' // Obtener la cantidad de reacciones', helper + ' // Obtener la cantidad de reacciones');
route("app.post('/foros'", `app.post('/foros', requireAuth, asyncRoute(async (req, res) => {
    const { name, description, ownerId } = req.body;
    if (!validText(name, 30) || !validText(description, 2000) || !sameUser(req, ownerId)) throw requestError(400, 'Datos del foro inválidos');
    const forum = await transaction(async client => {
        const existing = await client.query('SELECT 1 FROM foros WHERE name = $1', [name.trim()]);
        if (existing.rows.length) throw requestError(409, 'El nombre del foro ya está en uso');
        const result = await client.query('INSERT INTO foros (name, description, owner_id, created_at) VALUES ($1, $2, $3, NOW()) RETURNING id, name, description', [name.trim(), description.trim(), req.user.id]);
        await client.query('INSERT INTO participantes (user_id, forum_or_group_id, is_group, joined_at) VALUES ($1, $2, FALSE, NOW())', [req.user.id, result.rows[0].id]);
        return result.rows[0];
    });
    io.emit('reloadFG');
    res.status(201).json(forum);
}));`);
route("app.post('/grupos'", `app.post('/grupos', requireAuth, asyncRoute(async (req, res) => {
    const { name, description, ownerId } = req.body;
    if (!validText(name, 30) || !validText(description, 2000) || !sameUser(req, ownerId)) throw requestError(400, 'Datos del grupo inválidos');
    const group = await transaction(async client => {
        const inviteCode = require('node:crypto').randomBytes(8).toString('hex');
        const result = await client.query('INSERT INTO grupos (name, description, owner_id, invite_code, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING id, name, description, invite_code', [name.trim(), description.trim(), req.user.id, inviteCode]);
        await client.query('INSERT INTO participantes (user_id, forum_or_group_id, is_group, joined_at) VALUES ($1, $2, TRUE, NOW())', [req.user.id, result.rows[0].id]);
        return result.rows[0];
    });
    io.emit('reloadFG');
    res.status(201).json(group);
}));`);
for (const isGroup of [false, true]) {
    const path = isGroup ? '/grupo/:groupId/:ownerId' : '/foros/:forumId';
    const table = isGroup ? 'grupos' : 'foros';
    const prefix = isGroup ? 'G-' : 'F-';
    const noun = isGroup ? 'Grupo' : 'Foro';
    route("app.delete('" + path + "'", `app.delete('${path}', requireAuth, asyncRoute(async (req, res) => {
    const id = req.params.${isGroup ? 'groupId' : 'forumId'};
    if (!validNumericId(id)) throw requestError(400, 'ID inválido');
    await transaction(async client => {
        const entity = await client.query('SELECT owner_id FROM ${table} WHERE id = $1 FOR UPDATE', [id]);
        if (!entity.rows.length) throw requestError(404, '${noun} no encontrado');
        if (!sameUser(req, entity.rows[0].owner_id)) throw requestError(403, 'No tenés permiso para eliminarlo');
        const context = '${prefix}' + id;
        const messages = await client.query('SELECT id FROM mensajes WHERE chat_or_group_id = $1', [context]);
        for (const message of messages.rows) {
            const reactionId = 'Matesito_post-' + message.id;
            await client.query('DELETE FROM user_reactions WHERE post_id = $1', [reactionId]);
            await client.query('DELETE FROM reactions WHERE id = $1', [reactionId]);
        }
        await client.query('DELETE FROM notificaciones WHERE chat_or_group_id = $1', [context]);
        await client.query('DELETE FROM mensajes WHERE chat_or_group_id = $1', [context]);
        await client.query('DELETE FROM participantes WHERE forum_or_group_id = $1 AND is_group = $2', [id, ${isGroup}]);
        await client.query('DELETE FROM ${table} WHERE id = $1', [id]);
    });
    io.emit('reloadFG');
    res.json(${isGroup ? "{ message: 'Grupo eliminado correctamente' }" : "'Foro eliminado con éxito'"});
}));`);
}
// Atomic reaction toggles; lock the post so simultaneous users cannot corrupt totals.
route("app.post('/hit/microreact--reactions/:id/:reaction'", `app.post('/hit/microreact--reactions/:id/:reaction', requireAuth, asyncRoute(async (req, res) => {
    const { id, reaction } = req.params;
    const userId = req.user.id;
    if (!validReactionPostId(id) || !/^[1-5]$/.test(reaction) || !sameUser(req, req.body.user_id)) throw requestError(400, 'Reacción inválida');
    await transaction(async client => {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [id]);
        const existing = await client.query('SELECT reaction_id FROM user_reactions WHERE user_id = $1 AND post_id = $2', [userId, id]);
        const previous = existing.rows[0]?.reaction_id;
        await client.query('DELETE FROM user_reactions WHERE user_id = $1 AND post_id = $2', [userId, id]);
        if (String(previous) !== reaction) await client.query('INSERT INTO user_reactions (user_id, post_id, reaction_id) VALUES ($1, $2, $3)', [userId, id, reaction]);
        // Derive totals from actual selections, including a newly selected reaction type.
        await client.query('DELETE FROM reactions WHERE id = $1', [id]);
        await client.query('INSERT INTO reactions (id, reaction_id, count) SELECT post_id, reaction_id, COUNT(*) FROM user_reactions WHERE post_id = $1 GROUP BY post_id, reaction_id', [id]);
    });
    io.emit('reloadReactions', { id });
    res.json({ message: 'Reacción actualizada' });
}));`);
// Correct status/message propagation for the async routes.
s = s.replace("const status = error.status || 500;", "const status = error.status || (error.code === '23505' ? 409 : 500);");
s = s.replace("res.status(status).json({ error: status === 413", "if (status < 500 && !error.type) return res.status(status).json({ error: error.message });\n    res.status(status).json({ error: status === 413");
fs.writeFileSync('app.js', s);

s = fs.readFileSync('public/scripts.js', 'utf8');
for (const expr of ['foro.name', 'foro.description', 'foro.owner_name', 'foro.ownerName', 'group.name', 'groupName', 'ownerName']) s = s.replaceAll('${' + expr + '}', '${escapeHTML(' + expr + ')}');
// Rebuild following and group lists using DOM APIs: user data never becomes HTML or JS.
function replaceSection(start, end, code) { const a = s.indexOf(start), b = s.indexOf(end, a + start.length); s = s.slice(0, a) + code + '\n\n' + s.slice(b); }
replaceSection('function loadFollowedUsers()', 'async function deleteGroup(', `function menuButton(text, action) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = text; button.addEventListener('click', action);
    return button;
}
async function loadFollowedUsers() {
    const userId = users[activeUser]?.id;
    if (!userId) return;
    const container = document.getElementById('usersContainer');
    try {
        const following = await fetch('/followedUsers/' + userId).then(readResponse);
        container.replaceChildren();
        if (!following.length) container.textContent = 'Todavía no seguís a nadie. Buscá usuarios para sumarte a su ronda.';
        for (const user of following) {
            const card = document.createElement('div'); card.className = 'user-item';
            const name = document.createElement('h3'); name.textContent = user.username;
            card.append(name, menuButton('Ver perfil', () => viewProfile(user.username)),
                menuButton('Chat privado', () => createOrLoadChat(user.id)),
                menuButton('Dejar de seguir', () => unfollowUser(userId, user.id)));
            container.appendChild(card);
        }
    } catch (error) { notify(error.message, 'error'); }
}
async function loadGroups(created) {
    const userId = users[activeUser]?.id;
    if (!userId) return;
    const container = document.getElementById(created ? 'createdGroupsContainer' : 'joinedGruposContainer');
    try {
        const groups = await fetch((created ? '/grupos-creados/' : '/grupos-usuario/') + userId).then(readResponse);
        container.replaceChildren();
        if (!groups.length) container.textContent = created ? 'Todavía no creaste grupos.' : 'Todavía no pertenecés a un grupo.';
        for (const group of groups) {
            const card = document.createElement('div'); card.className = 'group-item';
            const name = document.createElement('h3'); name.textContent = group.name;
            const description = document.createElement('p'); description.textContent = group.description;
            const invite = document.createElement('p'); invite.textContent = 'Código de invitación: ' + group.invite_code;
            card.append(name, description, invite, menuButton('Entrar al chat', () => loadGroupMessages(group.id, loadAll)),
                menuButton(created ? 'Eliminar grupo' : 'Salir del grupo', () => created ? deleteGroup(group.id) : leaveGroup(group.id)));
            container.appendChild(card);
        }
    } catch (error) { notify(error.message, 'error'); }
}
function loadUserGroups() { return loadGroups(false); }
function loadCreatedGroups() { return loadGroups(true); }`);
s = s.replace("    joinGroup();\n    createGroupMenu();", "    reloadFG();\n    createGroupMenu();");
s = s.replace("function reloadFG(){", "function reloadFG(){\n    if (!users[activeUser]?.id) return;");
s = s.replace("    const user1Id = users[activeUser].id;", "    const user1Id = users[activeUser]?.id;");
s = s.replace("const user1Id = users[activeUser].id;", "const user1Id = users[activeUser]?.id;");
s = s.replace("const userId = users[activeUser].id;", "const userId = users[activeUser]?.id;\nif (!userId) return;");
s = s.replace("const followerId = users[activeUser].id;", "const followerId = users[activeUser]?.id;");
s = s.replace("const chat_or_group_id = Number", "notiElemento.addEventListener('click', () => hideMenus('notifMenu'));\n    const chat_or_group_id = Number");
s = s.replace('let isSortingInProgress = false;\nlet postsArray = []; // Guardará los posts temporalmente\n', '');
s = s.replace('let lastpostContent = "";\n', '').replace("        lastpostContent = '';\n", '');
fs.writeFileSync('public/scripts.js', s);
