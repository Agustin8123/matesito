const fs = require('node:fs');
const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const write = (file, text) => fs.writeFileSync(file, text);
let s = read('public/scripts.js');
const section = (start, end, value) => {
    const a = s.indexOf(start), b = s.indexOf(end, a + start.length);
    if (a < 0 || b < 0) throw new Error(start);
    s = s.slice(0, a) + value + '\n\n' + s.slice(b);
};
s = s.replace('let mantenimiento = true;', 'let mantenimiento = false;');
section('function closeSesion()', '// Función para ocultar múltiples menús', `async function closeSesion() {
    try {
        const response = await fetch('/logout', { method: 'POST' });
        if (!response.ok) throw new Error('No se pudo cerrar la sesión.');
        users = {};
        activeUser = '';
        lastpostContent = '';
        lastMessageContentByContext.clear();
        for (const name of ['username', 'userID']) document.cookie = name + '=; Max-Age=0; path=/;';
        localStorage.removeItem('userID');
        updateUserButton();
        document.getElementById('appContainer').style.display = 'none';
        document.getElementById('initialOverlay').style.display = 'flex';
    } catch (error) { notify(error.message, 'error'); }
}`);
section('async function sendForumMessage(', 'function goBackToInitial()', `let publishing = false;

async function publishContent(kind, contextId) {
    if (publishing) return;
    if (!users[activeUser]?.id) {
        notify('Iniciá sesión para publicar.', 'error');
        showUserSelectOverlay();
        return;
    }
    const input = document.getElementById('postContent');
    const content = input.value.trim();
    const sensitiveInput = document.getElementById('sensitiveContentCheckbox');
    const file = selectedFile;
    const sensitive = sensitiveInput.checked;
    if (!content || content.length > 10000) return notify('Escribí un texto de entre 1 y 10.000 caracteres.', 'error');
    if (containsForbiddenWords(content)) return notify('Revisá el contenido: puede infringir los términos y condiciones.', 'error');
    const context = kind + ':' + (contextId || activeUser);
    if (lastMessageContentByContext.get(context) === content) return notify('No podés enviar el mismo texto dos veces seguidas.', 'error');
    const isPost = kind === 'post';
    const payload = isPost ? { username: activeUser, content, sensitive }
        : { content, sensitive, sender_id: users[activeUser].id, is_private: kind === 'chat' };
    const url = isPost ? '/posts' : kind === 'group' ? '/group/messages/' + contextId : '/mensajes/' + contextId;
    publishing = true;
    const sendButton = document.getElementById('publishButton');
    if (sendButton) { sendButton.disabled = true; sendButton.textContent = 'Publicando…'; }
    document.getElementById('loading').style.display = 'block';
    try {
        if (file) {
            const form = new FormData();
            form.append('file', file);
            form.append('upload_preset', 'matesito');
            const uploaded = await fetch('https://api.cloudinary.com/v1_1/dtzl420mq/upload', { method: 'POST', body: form }).then(readResponse);
            if (!uploaded.secure_url) throw new Error('No se recibió el archivo subido. Tu texto sigue guardado.');
            payload.media = uploaded.secure_url;
            payload.mediaType = file.type;
        }
        const saved = await fetch(url, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        }).then(readResponse);
        if (!saved.id) throw new Error('El servidor no confirmó la publicación.');
        lastMessageContentByContext.set(context, content);
        // No borrar texto ni archivos que el usuario cambió durante la petición.
        if (input.value.trim() === content) input.value = '';
        if (selectedFile === file) {
            selectedFile = null;
            document.getElementById('postMedia').value = '';
            updatePostMediaButton();
        }
        if (sensitiveInput.checked === sensitive) sensitiveInput.checked = false;
        notify(isPost ? 'Tu post se publicó correctamente.' : 'Mensaje enviado.', 'success');
        if (sensitive && !showSensitiveContent) notify('El contenido sensible está oculto por el filtro actual.');
        // Recargar explícitamente: la publicación no depende de Socket.IO.
        if (isPost && document.getElementById('postList').style.display === 'block') await loadposts(loadAll);
        if (kind === 'forum' && activeForum === contextId) await loadForumPosts(contextId, loadAll);
        if (kind === 'chat' && activeChat === contextId) await loadChatMessages(contextId, loadAll);
        if (kind === 'group' && activeGroup === contextId) await loadGroupMessages(contextId, loadAll);
    } catch (error) {
        notify(error.message || 'No se pudo publicar. Intentá nuevamente.', 'error');
    } finally {
        publishing = false;
        document.getElementById('loading').style.display = 'none';
        if (sendButton) { sendButton.disabled = false; sendButton.textContent = 'Cebar'; }
    }
}

function sendForumMessage(id) { return publishContent('forum', id); }
function sendChatMessage(id) { return publishContent('chat', id); }
function sendGroupMessage(id) { return publishContent('group', id); }
function postpost() { return publishContent('post'); }`);
section('function buttonsState()', '// Función para alternar la configuración de contenido sensible', `function buttonsState() {
    if (document.getElementById('profileList').style.display === 'block') return viewProfile(currentProfileUsername);
    if (document.getElementById('forumList').style.display === 'block') return loadForumPosts(activeForum, loadAll);
    if (document.getElementById('messageList').style.display === 'block') return loadChatMessages(activeChat, loadAll);
    if (document.getElementById('groupMessageList').style.display === 'block') return loadGroupMessages(activeGroup, loadAll);
    return loadposts(loadAll);
}`);
section('function loadposts(', 'function createOrLoadChat(', `let feedRequest = 0;

async function loadFeed(url, listId, all, messages = false) {
    const request = ++feedRequest;
    const list = document.getElementById(listId);
    showOnlyMenu(listId);
    list.setAttribute('aria-busy', 'true');
    try {
        let rows = await fetch(url).then(readResponse);
        if (!Array.isArray(rows)) throw new Error('El servidor devolvió una lista inválida.');
        if (request !== feedRequest) return;
        // Filtrar antes de limitar, para no perder posts visibles por los sensibles.
        rows = rows.filter(row => showSensitiveContent || !row.sensitive);
        rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const totals = ordenarReacciones ? await cargarTotalesDeReacciones() : {};
        if (request !== feedRequest) return;
        if (ordenarReacciones) rows.sort((a, b) =>
            Number(totals['Matesito_post-' + (b.postId ?? b.id)] || 0) - Number(totals['Matesito_post-' + (a.postId ?? a.id)] || 0));
        if (!all) rows = rows.slice(0, 12);
        if (invertirOrden) rows.reverse();
        list.replaceChildren();
        rows.forEach(row => addpostToList(row.content, row.media,
            messages ? row.media_type : row.mediaType, row.username,
            messages ? row.image : row.profilePicture, row.sensitive, row.created_at,
            messages ? row.sender_id : row.userId, messages ? row.id : row.postId, listId));
        if (!rows.length) {
            const empty = document.createElement('li');
            empty.className = 'feed-state';
            empty.textContent = 'No hay publicaciones para mostrar con estos filtros.';
            list.appendChild(empty);
        }
    } catch (error) {
        if (request !== feedRequest) return;
        notify('No se pudieron cargar las publicaciones: ' + error.message, 'error');
        if (!list.children.length) {
            const state = document.createElement('li');
            state.className = 'feed-state';
            state.textContent = 'No pudimos cargar el contenido. ';
            const retry = document.createElement('button');
            retry.textContent = 'Reintentar';
            retry.addEventListener('click', buttonsState);
            state.appendChild(retry);
            list.appendChild(state);
        }
    } finally {
        if (request === feedRequest) list.setAttribute('aria-busy', 'false');
    }
}

function loadposts(all) {
    activeForum = 0; activeChat = ''; activeGroup = '';
    document.getElementById('profileHeader').style.display = 'none';
    document.getElementById('postBox').style.display = 'block';
    return loadFeed('/posts', 'postList', all);
}`);
section('function loadChatMessages(', 'function toggleOrden(', `function loadChatMessages(id, all) {
    activeForum = 0; activeGroup = ''; activeChat = id;
    document.getElementById('profileHeader').style.display = 'none';
    document.getElementById('postBox').style.display = 'block';
    return loadFeed('/chat/messages/' + id, 'messageList', all, true);
}

function loadGroupMessages(id, all) {
    if (!users[activeUser]?.id) return showUserSelectOverlay();
    activeForum = 0; activeChat = ''; activeGroup = id;
    document.getElementById('profileHeader').style.display = 'none';
    document.getElementById('postBox').style.display = 'block';
    return loadFeed('/group/messages/' + id + '/' + users[activeUser].id, 'groupMessageList', all, true);
}

function loadForumPosts(id, all) {
    activeChat = ''; activeGroup = ''; activeForum = id;
    document.getElementById('profileHeader').style.display = 'none';
    document.getElementById('postBox').style.display = 'block';
    return loadFeed('/mensajes/' + id, 'forumList', all, true);
}`);
s = s.replace('return await response.json();', 'return await readResponse(response);');
s = s.replace('async function addpostToList(', 'function addpostToList(');
s = s.replace("    const rememberMe = document.getElementById('rememberMe');\n    if (rememberMe) rememberMe.checked = false;\n", '');
section('    postsArray.push({ postElement: newpost, postId });', 'function toggleReactions(', `    postList.appendChild(newpost);
}`);
section('function viewProfile(', '// Función para volver a las publicaciones', `async function viewProfile(username) {
    currentProfileUsername = String(username || '');
    activeForum = 0; activeChat = ''; activeGroup = '';
    document.getElementById('postBox').style.display = 'none';
    document.getElementById('profileHeader').style.display = 'block';
    showOnlyMenu('profileList');
    const feed = loadFeed('/posts/user/' + encodeURIComponent(username), 'profileList', loadAll);
    const request = feedRequest;
    try {
        const user = await fetch('/getUserDetails', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username })
        }).then(readResponse);
        if (request !== feedRequest) return;
        document.getElementById('profileImage').src = user.profileImage || '/resources/SVG/default-avatar.svg';
        document.getElementById('profileUsername').textContent = user.username;
        document.getElementById('profileDescription').textContent = user.description || 'Sin descripción';
    } catch (error) { if (request === feedRequest) notify(error.message, 'error'); }
    await feed;
}`);
s = s.replace('function leaveGroup(', 'async function leaveGroup(').replace("!confirm('¿Estás seguro de que deseas salir del grupo?')", "!await confirmAction('¿Estás seguro de que deseas salir del grupo?')");
s = s.replace('function deleteForum(', 'async function deleteForum(').replace("const confirmDelete = confirm(", "const confirmDelete = await confirmAction(");
s = s.replace('function deleteGroup(groupId) {', "async function deleteGroup(groupId) {\nif (!await confirmAction('¿Eliminar este grupo y sus mensajes?')) return;");
s = s.replaceAll('/default-profile.png', '/resources/SVG/default-avatar.svg').replaceAll('/default-avatar.png', '/resources/SVG/default-avatar.svg');
s = s.replace(/\balert\(/g, 'notify(');
// Check HTTP status consistently instead of interpreting error JSON as success.
s = s.replaceAll('.then(response => response.json())', '.then(readResponse)');
s = s.replaceAll("document.getElementById('passwordInput').value.trim()", "document.getElementById('passwordInput').value");
s = s.replace('const password = passwordInput.value.trim();', 'const password = passwordInput.value;');
s = s.replace(/window.onload = function\(\) \{[\s\S]*?\n\}/, '');
section('function wait(ms)', 'function scrollPosts()', `async function init() {
    checkRememberedUser();
    HideOverlays();
    try {
        const response = await fetch('/session');
        if (response.status === 401) { showUserSelectOverlay(); return; }
        const session = await readResponse(response);
        await activateUser(session.username);
    } catch (error) {
        notify('No se pudo recuperar la sesión: ' + error.message, 'error');
        showUserSelectOverlay();
    }
}`);
s = s.replace('checkRememberedUser();\ninit();', 'init();');
// Avoid crashing if the CAPTCHA provider has not loaded yet.
s = s.replace("    if (loginWidgetId === null) {", "    if (typeof turnstile === 'undefined') return notify('La verificación de seguridad todavía no cargó. Intentá nuevamente.', 'error');\n    if (loginWidgetId === null) {");
s = s.replace("    if (registerWidgetId === null) {", "    if (typeof turnstile === 'undefined') return notify('La verificación de seguridad todavía no cargó. Intentá nuevamente.', 'error');\n    if (registerWidgetId === null) {");
s = s.replace('const token = turnstile.getResponse(loginWidgetId);', "const token = typeof turnstile !== 'undefined' && loginWidgetId !== null ? turnstile.getResponse(loginWidgetId) : '';" );
s = s.replace('const token = turnstile.getResponse(registerWidgetId);', "const token = typeof turnstile !== 'undefined' && registerWidgetId !== null ? turnstile.getResponse(registerWidgetId) : '';" );
write('public/scripts.js', s);
for (const file of ['public/utils.js', 'public/scripts c.js', 'public/McRcScripts.js']) {
    let text = read(file).replace(/\balert\(/g, 'notify(').replaceAll('.then(response => response.json())', '.then(readResponse)');
    if (file.endsWith('scripts c.js')) {
        text = text.replace(/(document\.getElementById\('(currentPassword|newPassword|passwordInput1)'\)\.value)\.trim\(\)/g, '$1');
        text = text.replace("            activeUser = newUsername;", "            users[newUsername] = users[activeUser];\n            delete users[activeUser];\n            activeUser = newUsername;\n            document.cookie = 'username=' + encodeURIComponent(newUsername) + '; path=/; SameSite=Lax';\n            updateUserButton();");
        text = text.replaceAll('data.message ||', 'data.error || data.message ||');
    }
    write(file, text);
}
for (const file of fs.readdirSync('public').filter(name => name.endsWith('.html'))) {
    let text = read('public/' + file);
    if (/scripts\.js|scripts c\.js|utils\.js|McRcScripts\.js/.test(text)) {
        text = text.replace('</head>', '    <link rel="stylesheet" href="/feedback.css">\n    <script src="/feedback.js" defer></script>\n</head>');
    }
    write('public/' + file, text);
}
