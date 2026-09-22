const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { fixture } = require('./fixture.cjs');
let f, base;
before(async () => { f = fixture(); await new Promise(resolve => f.server.listen(0, '127.0.0.1', resolve)); base = 'http://127.0.0.1:' + f.server.address().port; });
after(async () => { await new Promise(resolve => f.io.close(resolve)); await f.db.end(); });
async function request(path, method = 'GET', body, token = f.token()) {
    return fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
test('unauthenticated publishing fails and malformed cookies do not crash auth', async () => {
    assert.equal((await request('/posts', 'POST', { content: 'Hola' }, null)).status, 401);
    const bad = await fetch(base + '/session', { headers: { Cookie: 'auth_token=%E0%A4%A' } });
    assert.equal(bad.status, 401);
});
test('posts persist and round-trip through the feed with booleans', async () => {
    const res = await request('/posts', 'POST', { username: 'MateUno', content: 'Post comprobado', sensitive: false });
    assert.equal(res.status, 201);
    const saved = await res.json();
    const feed = await (await request('/posts')).json();
    assert.equal(feed.find(post => post.postId === saved.id).content, 'Post comprobado');
    assert.equal(feed.find(post => post.postId === saved.id).sensitive, false);
    assert.equal((await request('/posts', 'POST', { username: 'MateUno', content: 'Otro', sensitive: 0 })).status, 400);
});
test('posts whose historical author is missing remain visible', async () => {
    await f.db.query("INSERT INTO posts (username, content, sensitive, created_at) VALUES ('NombreAnterior', 'Histórico', false, NOW())");
    const feed = await (await request('/posts')).json();
    assert.ok(feed.some(post => post.content === 'Histórico'));
});
test('session reflects the database user', async () => {
    const session = await (await request('/session')).json();
    assert.equal(session.username, 'MateUno');
});
test('forum and private messages persist and can be read by their participants', async () => {
    for (const is_private of [false, true]) {
        const res = await request('/mensajes/1', 'POST', { content: 'Mensaje ' + is_private, sender_id: 1, sensitive: false, is_private });
        assert.equal(res.status, 201, await res.clone().text());
        const saved = await res.json();
        const messages = await (await request(is_private ? '/chat/messages/1' : '/mensajes/1')).json();
        assert.ok(messages.some(message => message.id === saved.id));
    }
});
test('non-members cannot read private chats or publish in groups', async () => {
    assert.equal((await request('/chat/messages/1', 'GET', null, f.token(3, 'MateTres'))).status, 403);
    assert.equal((await request('/group/messages/1', 'POST', { sender_id: 3, sensitive: false, content: 'No autorizado' }, f.token(3, 'MateTres'))).status, 403);
});
test('group messages persist with boolean sensitive fields', async () => {
    const res = await request('/group/messages/1', 'POST', { sender_id: 1, sensitive: false, content: 'Mensaje al grupo' });
    assert.equal(res.status, 201, await res.clone().text());
    const saved = await res.json();
    const messages = await (await request('/group/messages/1/1')).json();
    assert.ok(messages.some(message => message.id === saved.id));
});
test('reactions are counted by exact post ID, never by prefix', async () => {
    await f.db.query("INSERT INTO reactions VALUES ('Matesito_post-1', 1, 2), ('Matesito_post-10', 1, 9)");
    const result = await (await request('/get/microreact--reactions/Matesito_post-1?reaction=1')).json();
    assert.equal(Number(result.value), 2);
});
test('renaming an author retains their posts and refreshes the auth cookie', async () => {
    const res = await request('/updateUsername', 'PUT', { currentUsername: 'MateUno', newUsername: 'NuevoMate' });
    assert.equal(res.status, 200, await res.clone().text());
    assert.match(res.headers.get('set-cookie'), /HttpOnly/);
    const posts = await (await request('/posts/user/NuevoMate')).json();
    assert.ok(posts.some(post => post.content === 'Post comprobado'));
});

test('new forums and groups enroll their creator and allow immediate publishing', async () => {
    for (const [path, kind] of [['/foros', 'forum'], ['/grupos', 'group']]) {
        const created = await request(path, 'POST', { name: 'Nuevo ' + kind, description: 'Para conversar', ownerId: 1 });
        assert.equal(created.status, 201, await created.clone().text());
        const entity = await created.json();
        const membership = await f.db.query('SELECT 1 FROM participantes WHERE user_id = $1 AND forum_or_group_id = $2 AND is_group = $3', [1, entity.id, kind === 'group']);
        assert.equal(membership.rows.length, 1);
        const published = await request((kind === 'group' ? '/group/messages/' : '/mensajes/') + entity.id, 'POST', { content: 'Primera charla', sensitive: false, sender_id: 1, is_private: false });
        assert.equal(published.status, 201, await published.clone().text());
    }
});
test('group invite codes are private to members and owners', async () => {
    assert.equal((await request('/grupo/1', 'GET', null, null)).status, 401);
    assert.equal((await request('/grupo/1', 'GET', null, f.token(3, 'MateTres'))).status, 403);
    assert.equal((await request('/grupo/1')).status, 200);
});
test('reaction changes create missing counters and repeating a reaction removes it', async () => {
    const id = 'Matesito_post-777';
    for (const reaction of [1, 2, 2]) {
        const res = await request('/hit/microreact--reactions/' + id + '/' + reaction, 'POST', { user_id: 1 });
        assert.equal(res.status, 200, await res.clone().text());
    }
    const counts = await (await request('/get/microreact--reactionss/' + id)).json();
    assert.deepEqual(counts.reactions, []);
});
test('chat notifications name the other participant, not the user with the chat ID', async () => {
    await f.db.query("INSERT INTO notificaciones (user_id, tipo, referencia_id, chat_or_group_id) VALUES (1, 'mensaje', 'C-999', 'C-1')");
    const list = await (await request('/notificaciones/1')).json();
    assert.equal(list.find(item => item.referencia_id === 'C-999').nombre, 'MateDos');
});
test('new account receives a usable authenticated cookie', async () => {
    process.env.TURNSTILE_SECRET = 'fixture-only';
    const realFetch = global.fetch;
    global.fetch = (url, options) => String(url).startsWith('https://challenges.cloudflare.com/') ? Promise.resolve({ ok: true, json: async () => ({ success: true }) }) : realFetch(url, options);
    try {
        const res = await request('/users', 'POST', { username: 'NuevoRegistro', password: '  contraseña con espacios  ', token: 'fixture' }, null);
        assert.equal(res.status, 201);
        const cookie = res.headers.get('set-cookie').split(';')[0];
        const session = await realFetch(base + '/session', { headers: { Cookie: cookie } });
        assert.equal((await session.json()).username, 'NuevoRegistro');
        const login = await request('/login', 'POST', { username: 'NuevoRegistro', password: '  contraseña con espacios  ', token: 'fixture' }, null);
        assert.equal(login.status, 200);
    } finally { global.fetch = realFetch; delete process.env.TURNSTILE_SECRET; }
});
test('deleting a forum removes its messages, notifications and memberships only', async () => {
    const before = await f.db.query('SELECT * FROM participantes WHERE forum_or_group_id = 1 AND is_group = TRUE');
    const result = await request('/foros/1', 'DELETE', { userId: 1 });
    assert.equal(result.status, 200, await result.clone().text());
    assert.equal((await f.db.query("SELECT * FROM mensajes WHERE chat_or_group_id = 'F-1'")).rows.length, 0);
    assert.equal((await f.db.query("SELECT * FROM notificaciones WHERE chat_or_group_id = 'F-1'")).rows.length, 0);
    assert.equal((await f.db.query('SELECT * FROM participantes WHERE forum_or_group_id = 1 AND is_group = TRUE')).rows.length, before.rows.length);
});
test('description can be cleared; invalid search and malformed JSON return JSON errors', async () => {
    const desc = await request('/updateDescription', 'PUT', { username: 'NuevoMate', description: '' }, f.token(1, 'NuevoMate'));
    assert.equal(desc.status, 200);
    assert.equal((await request('/search?query[]=wrong')).status, 400);
    const res = await fetch(base + '/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{wrong' });
    assert.equal(res.status, 400);
    assert.equal(typeof (await res.json()).error, 'string');
});
