const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const response = (body, status = 200) => ({ ok: status < 400, status, json: async () => body });
async function page(t, fetcher = async () => response([])) {
    const html = fs.readFileSync('public/index.html', 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
    const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/' });
    const w = dom.window;
    w.eval = source => require('node:vm').runInContext(source, dom.getInternalVMContext());
    await new Promise(resolve => w.addEventListener('load', resolve, { once: true }));
    w.fetch = fetcher;
    w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    w.HTMLDialogElement.prototype.close = function () { this.open = false; };
    for (const file of ['feedback.js', 'utils.js', 'scripts.js', 'scripts2.js', 'theme.js', 'modern.js']) w.eval(fs.readFileSync('public/' + file, 'utf8'));
    w.eval("activeUser = 'MateUno'; users[activeUser] = { id: 1 }; ");
    t.after(() => w.close());
    return w;
}
const post = (id, sensitive = false) => ({ postId: id, userId: 1, username: 'MateUno', content: 'Post ' + id, sensitive, created_at: `2026-09-${String(id).padStart(2, '0')}T12:00:00Z` });

test('POST failure keeps the draft and attachment and never reports success', async t => {
    const w = await page(t, async () => response({ error: 'Sesión expirada' }, 401));
    w.document.getElementById('postContent').value = 'No perder este texto';
    await w.postpost();
    assert.equal(w.document.getElementById('postContent').value, 'No perder este texto');
    assert.match(w.document.getElementById('feedback-region').textContent, /Sesión expirada/);
    assert.doesNotMatch(w.document.getElementById('feedback-region').textContent, /correctamente/);
    assert.equal(w.document.getElementById('publishButton').disabled, false);
    assert.equal(w.document.getElementById('loading').style.display, 'none');
});
test('successful publication sends booleans, clears draft and reloads without sockets', async t => {
    const calls = [];
    const w = await page(t, async (url, options) => {
        calls.push({ url, options });
        return response(options ? { id: 10, content: 'Hola comunidad' } : [post(10)]);
    });
    w.document.getElementById('postContent').value = 'Hola comunidad';
    await w.postpost();
    assert.equal(JSON.parse(calls[0].options.body).sensitive, false);
    assert.equal(calls[1].url, '/posts');
    assert.equal(w.document.getElementById('postContent').value, '');
    assert.equal(w.document.querySelectorAll('#postList .post').length, 1);
});
test('forums, private chats and groups send boolean sensitive values', async t => {
    for (const kind of ['forum', 'chat', 'group']) {
        let sent;
        const w = await page(t, async (url, options) => { sent = JSON.parse(options.body); return response({ id: 'F-1' }); });
        w.document.getElementById('postContent').value = 'Un mensaje';
        w.document.getElementById('sensitiveContentCheckbox').checked = true;
        await w.publishContent(kind, 5);
        assert.equal(sent.sensitive, true);
        assert.equal(sent.is_private, kind === 'chat');
    }
});
test('visible posts render when the last entry is sensitive, with no reaction API dependency', async t => {
    const urls = [];
    const w = await page(t, async url => { urls.push(url); return response([post(3), post(2), post(1, true)]); });
    await w.loadposts(false);
    assert.equal(w.document.querySelectorAll('#postList .post').length, 2);
    assert.deepEqual(urls, ['/posts']);
});
test('filtering runs before the twelve-post limit and empty feeds display a state', async t => {
    const rows = Array.from({ length: 18 }, (_, n) => post(n + 1, n > 5));
    const w = await page(t, async () => response(rows));
    await w.loadposts(false);
    assert.equal(w.document.querySelectorAll('#postList .post').length, 6);
    w.fetch = async () => response([]);
    await w.loadposts(false);
    assert.match(w.document.querySelector('#postList').textContent, /No hay publicaciones/);
});
test('a slow old request cannot overwrite a newer feed', async t => {
    let resolveOld;
    const w = await page(t, url => url === '/posts' ? new Promise(resolve => { resolveOld = resolve; }) : Promise.resolve(response([])));
    const old = w.loadposts(false);
    await w.loadForumPosts(1, false);
    resolveOld(response([post(1)]));
    await old;
    assert.equal(w.document.querySelectorAll('#postList .post').length, 0);
    assert.equal(w.document.getElementById('forumList').style.display, 'block');
});
test('double clicks send only one request; draft edits during upload survive', async t => {
    let resolvePost, count = 0;
    const w = await page(t, (url, options) => options ? (count++, new Promise(resolve => { resolvePost = resolve; })) : Promise.resolve(response([])));
    const input = w.document.getElementById('postContent');
    input.value = 'Texto inicial';
    const first = w.postpost();
    await w.postpost();
    input.value = 'Otro borrador';
    resolvePost(response({ id: 1 }));
    await first;
    assert.equal(count, 1);
    assert.equal(input.value, 'Otro borrador');
});
test('failed media upload never sends a post', async t => {
    const calls = [];
    const w = await page(t, async url => { calls.push(url); return response({ error: { message: 'Archivo rechazado' } }, 400); });
    w.eval("selectedFile = new File(['image'], 'foto.png', { type: 'image/png' });");
    w.document.getElementById('postContent').value = 'Con imagen';
    await w.postpost();
    assert.equal(calls.length, 1);
    assert.match(calls[0], /cloudinary/);
    assert.equal(w.document.getElementById('postContent').value, 'Con imagen');
    assert.match(w.document.getElementById('feedback-region').textContent, /Archivo rechazado/);
});
test('post content is escaped and theme/navigation controls work', async t => {
    const w = await page(t, async () => response([{ ...post(1), content: '<img src=x onerror=alert(1)>' }]));
    await w.loadposts(false);
    assert.equal(w.document.querySelector('.post-text').children.length, 0);
    w.toggleTheme();
    assert.equal(w.document.documentElement.dataset.theme, 'light');
    w.toggleForumMenu();
    assert.equal(w.document.getElementById('navigationPanel').open, true);
    w.closePanel();
    assert.ok(w.document.getElementById('menuStore').contains(w.document.getElementById('forumSubMenu')));
});
test('group lists do not erase each other or create duplicate IDs', async t => {
    const w = await page(t, async () => response([{ id: 1, name: '<script>bad</script>', description: 'Grupo', invite_code: 'test' }]));
    await w.loadUserGroups();
    await w.loadCreatedGroups();
    assert.equal(w.document.querySelectorAll('#joinedGruposContainer .group-item').length, 1);
    assert.equal(w.document.querySelectorAll('#createdGroupsContainer .group-item').length, 1);
    assert.equal(w.document.querySelectorAll('.group-item script').length, 0);
});
test('a followed user with quotes is rendered safely', async t => {
    const w = await page(t, async () => response([{ id: 2, username: '\"<img src=x onerror=alert(1)>\"' }]));
    await w.loadFollowedUsers();
    assert.equal(w.document.querySelectorAll('#usersContainer img').length, 0);
    assert.match(w.document.getElementById('usersContainer').textContent, /onerror/);
});
test('session recovery activates the account, while expired sessions show login', async t => {
    const w = await page(t, async url => response(url === '/session' ? { id: 1, username: 'MateUno' } : url === '/getUserDetails' ? { id: 1, username: 'MateUno' } : []));
    await w.init();
    assert.equal(w.document.getElementById('initialOverlay').style.display, 'none');
    w.fetch = async () => response({ error: 'Expirada' }, 401);
    await w.init();
    assert.equal(w.document.getElementById('initialOverlay').style.display, 'flex');
});
test('notification navigation uses numeric context IDs for chats, forums and groups', async t => {
    const w = await page(t);
    const navigated = [];
    w.loadChatMessages = id => navigated.push(['chat', id]);
    w.loadForumPosts = id => navigated.push(['forum', id]);
    w.loadGroupMessages = id => navigated.push(['group', id]);
    w.marcarComoLeida = async () => {};
    w.renderizarNotificaciones([
        { id: 1, tipo: 'mensaje', chat_or_group_id: 'C-22', nombre: 'Usuario' },
        { id: 2, tipo: 'foro', chat_or_group_id: 'F-33', nombre: 'Foro' },
        { id: 3, tipo: 'grupo', chat_or_group_id: 'G-44', nombre: 'Grupo' }
    ]);
    for (const child of w.document.getElementById('renderNotif').children) child.click();
    assert.deepEqual(navigated, [['chat', 22], ['forum', 33], ['group', 44]]);
});
test('confirmations wait for a choice, and cancel is non-destructive', async t => {
    const w = await page(t);
    const result = w.confirmAction('¿Eliminar?');
    const dialog = w.document.querySelector('.confirmation-dialog');
    assert.equal(dialog.open, true);
    dialog.querySelector('button').click();
    assert.equal(await result, false);
    assert.equal(w.document.querySelector('.confirmation-dialog'), null);
});
