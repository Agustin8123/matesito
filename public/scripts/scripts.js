let users = Object.create(null);  // Objeto para almacenar los usuarios y contrase
let activeUser = '';  // Variable para el usuario activo
let activeForum = 0;
let activeChat = '';
let activeGroup = '';
let activeMenuId = '';
let currentProfileUsername = '';

const forumList = 'forumList';
const postList = 'postList';
const messageList = 'messageList';
const groupMessageList = 'groupMessageList';
const profileList = 'profileList';
const unicPostList = 'unicPostList';

let mantenimiento = false;

let selectedFile = null;
let loadAll = false;
let invertirOrden = false;
let ordenarReacciones = false;


let loginWidgetId = null;
let registerWidgetId = null;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

async function closeSesion() {
    try {
        const response = await fetch('/logout', { method: 'POST' });
        if (!response.ok) throw new Error('No se pudo cerrar la sesión.');
        users = Object.create(null);
        activeUser = '';
        document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
        clearCommunityMenus();
        clearComposerDrafts();
        feedObserver?.disconnect();
        feedState?.controller?.abort();
        feedState = null;
        ++feedRequest;
        ++notificationRequest;
        window.communitySocket?.disconnect().connect();
        closePanel();
        for (const id of ['postList', 'profileList', 'forumList', 'messageList', 'groupMessageList', 'renderNotif']) document.getElementById(id)?.replaceChildren();
        lastMessageContentByContext.clear();
        publicationKeys.clear();
        for (const name of ['username', 'userID']) document.cookie = name + '=; Max-Age=0; path=/;';
        try { localStorage.removeItem('userID'); } catch { /* Storage can be disabled. */ }
        updateUserButton();
        document.getElementById('appContainer').style.display = 'block';
        await loadposts(loadAll);
        document.getElementById('initialOverlay').style.display = 'flex';
    } catch (error) { notify(error.message, 'error'); }
}

// Función para ocultar múltiples menús


function showOnlyMenu(activeId) {
    // Obtener todos los contenedores
    const containers = [
        'postList',
        'profileList',
        'unicPostList',
        'forumList',
        'messageList',
        'groupMessageList'
    ];

    // Ocultar todos excepto el activo
    containers.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = id === activeId ? 'block' : 'none';
        }
    });
}



const forbiddenWords = ['⣿', 'droga', 'droja', 'dr0ga', 'drogu3', 'drogaa', 'merca', 'falopa', 'cocaína', 'kok4', 'c0ca', 'cocaína', 'marihuana', 'weed', 'hierba', 'porro', 'mota', 'cannabis', '4:20', 'maría', '420', 'hachís', 'thc', 'éxtasis', 'éxt4sis', 'xtc', 'mdma', 'éxtasis', 'lsd', 'ácido', 'trips', 'lsd', 'd.r.o.g.a', 'dro@g@', 'DrOgA', 'dRoJA'];

document.addEventListener("DOMContentLoaded", function() {
document.getElementById('initialOverlay').style.display = 'none';
updateUserButton();
});

function reloadPosts(){
    buttonsState();
}

function reloadFG() {
    // Only refresh visible panels, not every hidden list on every community event.
    const panel = document.getElementById('navigationPanel');
    if (!panel?.open) return;
    const selected = panel.querySelector('[role="tab"][aria-selected="true"]');
    if (selected) {
        const section = selected.getAttribute('aria-controls');
        const group = section.startsWith('forum') ? 'forums' : 'chats';
        selectPanelTab(group, section);
    } else if (panel.querySelector('#userSubMenu')) loadFollowedUsers();
}

document.getElementById('acceptTermsCheckbox').addEventListener('change', function() {
const createButton = document.getElementById('createUserButton');
if (this.checked) {
    createButton.disabled = false; // Habilitar el botón si está marcado
} else {
    createButton.disabled = true; // Deshabilitar el botón si no está marcado
}
});

function verMant(valor) {
if (valor === true) {
    window.location.href = 'mantenimiento';
}
}

function useExistingUser() {
    document.getElementById('initialOverlay').style.display = 'none';
    document.getElementById('usernameOverlay').style.display = 'flex';

    if (typeof turnstile === 'undefined') return notify('La verificación de seguridad todavía no cargó. Intentá nuevamente.', 'error');
    if (loginWidgetId === null) {
        loginWidgetId = turnstile.render('#turnstileLogin', {
            sitekey: '0x4AAAAAACXaLFPU3wAuzN1y'
        });
    } else if (typeof turnstile !== 'undefined') {
        turnstile.reset(loginWidgetId);
    }
}

function createNewUser() {
    document.getElementById('initialOverlay').style.display = 'none';
    document.getElementById('userSelectOverlay').style.display = 'flex';

    if (typeof turnstile === 'undefined') return notify('La verificación de seguridad todavía no cargó. Intentá nuevamente.', 'error');
    if (registerWidgetId === null) {
        registerWidgetId = turnstile.render('#turnstileRegister', {
            sitekey: '0x4AAAAAACXaLFPU3wAuzN1y'
        });
    } else if (typeof turnstile !== 'undefined') {
        turnstile.reset(registerWidgetId);
    }
}


function saveSession(username, rememberMe) {
if (rememberMe) {
    let expirationDate = new Date();
    expirationDate.setTime(expirationDate.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 días

    document.cookie = `username=${encodeURIComponent(username)}; expires=${expirationDate.toUTCString()}; path=/; SameSite=Lax`;
} else {
    document.cookie = `username=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}
}

// Función de login
let authPending = false;
async function loginUser() {
    if (authPending) return;
    const username = document.getElementById('usernameInput').value.trim();
    const password = document.getElementById('passwordInput').value;
    const token = typeof turnstile !== 'undefined' && loginWidgetId !== null ? turnstile.getResponse(loginWidgetId) : '';
    if (!username || !password) return notify('Completá usuario y contraseña.', 'error');
    if (!token) return notify('Completá la verificación de seguridad.', 'error');
    authPending = true;
    try {
        const data = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, token }) }).then(readResponse);
        await activateUser(data.username);
        saveSession(data.username, document.getElementById('rememberMe').checked);
        document.getElementById('passwordInput').value = '';
    } catch (error) { notify(error.message, 'error'); }
    finally { authPending = false; turnstile.reset(loginWidgetId); }
}

// Obtener cookies
function getCookie(name) {
const value = `; ${document.cookie}`;
const parts = value.split(`; ${name}=`);
if (parts.length === 2) return parts.pop().split(';').shift();
}

function checkRememberedUser() {
    const username = getCookie('username');
    if (username) {
        try { document.getElementById('usernameInput').value = decodeURIComponent(username); } catch { return; }
        document.getElementById('rememberMe').checked = true;
    }
}

let welcomeDismissed = false;
async function browseAsGuest() {
    welcomeDismissed = true;
    document.getElementById('appContainer').style.display = 'block';
    hideMenus('initialOverlay', 'usernameOverlay', 'userSelectOverlay');
    if (!feedState) await loadposts(loadAll);
    if (typeof openRequestedPanel === 'function') openRequestedPanel();
    document.querySelector('.header-search')?.focus();
}

function showUserSelectOverlay() {
if (typeof closePanel === 'function') closePanel();
document.getElementById('initialOverlay').style.display = 'flex';
}

async function addNewUser() {
    if (authPending) return;
    const usernameInput = document.getElementById('newUsernameInput');
    const passwordInput = document.getElementById('newPasswordInput');
    const fileInput = document.getElementById('newProfileImage');
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    const token = typeof turnstile !== 'undefined' && registerWidgetId !== null ? turnstile.getResponse(registerWidgetId) : '';
    if (!username || username.length > 25 || !password.trim() || password.length > 128) return notify('Revisá el usuario (hasta 25 caracteres) y la contraseña (hasta 128).', 'error');
    if (!document.getElementById('acceptTermsCheckbox').checked) return notify('Debés aceptar los términos para crear tu cuenta.', 'error');
    if (!token) return notify('Completá la verificación de seguridad.', 'error');
    authPending = true;
    const button = document.getElementById('createUserButton'); button.disabled = true;
    try {
        const file = fileInput.files[0];
        if (file && (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024)) throw new Error('Elegí una imagen de hasta 10 MB.');
        const user = await fetch('/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, token }) }).then(readResponse);
        if (!user.id) throw new Error('No se pudo confirmar la creación de la cuenta.');
        if (file) {
            try {
                const uploaded = await uploadMedia(file);
                await fetch('/updateProfileImage', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user.username, profileImage: uploaded.url }) }).then(readResponse);
            } catch (error) { notify('Tu cuenta se creó, pero no se guardó la foto. Podés reintentar desde Mi cuenta. ' + error.message, 'error'); }
        }
        usernameInput.value = ''; passwordInput.value = ''; fileInput.value = '';
        await activateUser(user.username);
        notify('Tu cuenta está lista. ¡Bienvenido a la ronda!', 'success');
    } catch (error) { notify(error.message, 'error'); }
    finally { authPending = false; button.disabled = !document.getElementById('acceptTermsCheckbox').checked; turnstile.reset(registerWidgetId); }
}

const communityRequests = new Set();
async function submitCommunity(kind) {
    if (communityRequests.has(kind)) return;
    const joining = kind === 'join';
    const id = joining ? 'joinGrupoMenu' : kind === 'forum' ? 'createForumOverlay' : 'createGroupOverlay';
    const form = document.getElementById(id);
    const ownerId = users[activeUser]?.id;
    if (!ownerId) return notify('Iniciá sesión para continuar.', 'error');
    const nameInput = document.getElementById(kind === 'forum' ? 'forumName' : 'groupName');
    const descriptionInput = document.getElementById(kind === 'forum' ? 'forumDescription' : 'groupDescription');
    const inviteInput = document.getElementById('inviteCode');
    const name = joining ? '' : nameInput.value.trim();
    const description = joining ? '' : descriptionInput.value.trim();
    const inviteCode = inviteInput.value.trim();
    if (joining ? !inviteCode : !name || !description) return notify('Completá todos los campos.', 'error');
    if (!joining && (name.length > 30 || description.length > 2000)) return notify('Usá hasta 30 caracteres para el nombre y 2000 para la descripción.', 'error');
    communityRequests.add(kind);
    const controls = [...form.querySelectorAll('input, textarea, button')];
    controls.forEach(control => control.disabled = true);
    form.setAttribute('aria-busy', 'true');
    try {
        await fetch(joining ? '/unir-grupo' : kind === 'forum' ? '/foros' : '/grupos', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(joining ? { inviteCode, userId: ownerId } : { name, description, ownerId })
        }).then(readResponse);
        if (joining) inviteInput.value = '';
        else { nameInput.value = ''; descriptionInput.value = ''; }
        if (form.style.display !== 'none') await closeCommunityForm(id);
        notify(joining ? 'Ya sos parte del grupo.' : kind === 'forum' ? 'Foro creado correctamente.' : 'Grupo creado. Encontrá su código en Invitar al grupo.');
    } catch (error) { notify(error.message, 'error'); }
    finally { controls.forEach(control => control.disabled = false); communityRequests.delete(kind); form.removeAttribute('aria-busy'); }
}
function createForum() { return submitCommunity('forum'); }
function createGroup() { return submitCommunity('group'); }
function joinGroup() { return submitCommunity('join'); }

async function leaveGroup(groupId) {
const userId = users[activeUser]?.id;
if (!await confirmAction('¿Estás seguro de que deseas salir del grupo?')) {
    return; // Si el usuario cancela, no hacemos nada
}

fetch('/salir-grupo', {
    method: 'DELETE',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, groupId }),
})
.then(response => {
    if (!response.ok) {
        return response.json().then(data => { throw new Error(data.error); });
    }
    return response.json();
})
.then(data => {
    notify(data.message);
    reloadFG();
})
.catch(error => {
    notify(`Error: ${error.message}`);
});
}

async function fetchMenuPage(url, offset, request) {
    const response = await fetch(url + (url.includes('?') ? '&' : '?') + 'offset=' + offset, { signal: request.controller.signal });
    request.next = response.headers.get('X-Next-Offset');
    return readResponse(response);
}
function addMenuContinuation(container, request, load) {
    container.querySelector('.menu-more')?.remove();
    if (request.next === null) return;
    const button = menuButton('Cargar más', () => { button.disabled = true; load(Number(request.next)); });
    button.className = 'menu-more'; container.append(button);
}
// Cada lista conserva únicamente su solicitud más reciente.
const menuRequests = new Map();
function beginMenuRequest(container) {
    menuRequests.get(container)?.controller.abort();
    const controller = new AbortController();
    const owner = users[activeUser]?.id;
    const request = {
        controller,
        current: () => menuRequests.get(container) === request && !controller.signal.aborted && users[activeUser]?.id === owner,
        finish: () => { if (menuRequests.get(container) === request) menuRequests.delete(container); }
    };
    menuRequests.set(container, request);
    return request;
}
function clearCommunityMenus() {
    for (const request of menuRequests.values()) request.controller.abort();
    menuRequests.clear();
    for (const id of ['forosContainer', 'forosContainer2', 'createdForosContainer', 'usersContainer', 'createdGroupsContainer', 'joinedGruposContainer', 'privateChats']) {
        const container = document.getElementById(id);
        container?.replaceChildren();
        container?.removeAttribute('aria-busy');
    }
}

async function loadForumMenu(kind, offset = 0) {
    const userId = users[activeUser]?.id;
    if (kind !== 'all' && !userId) return;
    const container = document.getElementById(kind === 'all' ? 'forosContainer' : kind === 'followed' ? 'forosContainer2' : 'createdForosContainer');
    const url = kind === 'all' ? '/foros' : kind === 'followed' ? '/userForums/' + userId : '/userCreatedForums/' + userId;
    if (!container) return;
    const request = beginMenuRequest(container);
    try {
        const forums = await fetchMenuPage(url, offset, request);
        if (!request.current()) return;
        if (!offset) container.replaceChildren();
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
        addMenuContinuation(container, request, next => loadForumMenu(kind, next));
    } catch (error) { if (!request.current()) return; container.replaceChildren(); const message = document.createElement('p'); message.textContent = error.message; container.append(message, menuButton('Reintentar', () => loadForumMenu(kind))); } finally { request.finish(); }
}
function loadForos() { return loadForumMenu('all'); }

function joinForum(forumId) {
if (!users[activeUser]?.id) return showUserSelectOverlay();
// Asegúrate de que 'users.id' esté correctamente definido en tu aplicación
const data = {
    userId: users[activeUser]?.id, // ID del usuario activo
    forumId: forumId  // ID del foro que se pasa como parámetro
};

fetch('/joinForum', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
})
.then(readResponse)
.then(data => {
    if (data.message) {
        notify(data.message); // Muestra el mensaje recibido desde el backend
    } else {
        notify('Error desconocido al procesar la solicitud'); // Mensaje por defecto si no hay mensaje
    }
})
.catch((error) => {
    console.error('Error:', error);
    notify('Error al procesar la solicitud'); // Mensaje de error general
});
}

function leaveForum(forumId) {
// Asegúrate de que 'users.id' esté correctamente definido en tu aplicación
const data = {
    userId: users[activeUser]?.id, // ID del usuario activo
    forumId: forumId  // ID del foro que se pasa como parámetro
};

fetch('/leaveForum', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
})
.then(readResponse)
.then(data => {
    if (data.message) {
        notify(data.message); // Muestra el mensaje recibido desde el backend
    } else {
        notify('Error desconocido al procesar la solicitud'); // Mensaje por defecto si no hay mensaje
    }
})
.catch((error) => {
    console.error('Error:', error);
    notify('Error al procesar la solicitud'); // Mensaje de error general
});
}


function loadUserCreatedForums() { return loadForumMenu('created'); }

async function deleteForum(forumId) {
const userId = users[activeUser]?.id; // ID del usuario activo

// Confirmar la eliminación
const confirmDelete = await confirmAction('¿Estás seguro de que deseas eliminar este foro?');
if (!confirmDelete) {
    return;
}

fetch(` /foros/${forumId}`, {
    method: 'DELETE',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId }),
})
.then(response => {
    if (!response.ok) {
        return response.json().then(data => {
            throw new Error(data || 'Error al eliminar el foro');
        });
    }
    return response.json();
})
.then(data => {
    notify(data); // Mensaje de éxito del backend
    loadUserCreatedForums(); // Actualiza la lista de foros creados
})
.catch(error => {
    console.error('Error al eliminar el foro:', error);
    notify(error.message || 'Error al eliminar el foro');
});
}

function containsForbiddenWords(message) {
    return forbiddenWords.some(word => message.toLowerCase().includes(word.toLowerCase()));
}

function updatePostMediaButton(fileName = '') {
    const button = document.getElementById('postMediaButton');
    if (!button) return;
    const label = button.querySelector('span');
    if (label) { label.textContent = fileName || 'Seleccionar archivo'; label.classList.toggle('visually-hidden', !fileName); }
    const remove = document.getElementById('removeMediaButton'); if (remove) remove.hidden = !fileName;
    button.title = fileName || 'Seleccionar archivo';
    if (typeof previewAttachment === 'function') previewAttachment();
}

  function handleFileSelect(event) {
    selectedFile = event.target.files[0]; // Guardar el archivo seleccionado
    if (selectedFile) {
        const fileType = selectedFile.type;
        const fileSize = selectedFile.size;

        // Validar tipo de archivo
        const validFileTypes = ['image', 'audio', 'video'];
        const fileCategory = fileType.split('/')[0];

        if (!validFileTypes.includes(fileCategory)) {
            notify("Por favor, selecciona un archivo de tipo imagen, audio o video.");
            selectedFile = null;
            event.target.value = ''; // Restablecer la selección
            updatePostMediaButton();
            return;
        }

        // Validar tamaño de archivo
        if (
            (fileCategory === 'image' || fileCategory === 'audio') && fileSize > 10 * 1024 * 1024 ||
            fileCategory === 'video' && fileSize > 20 * 1024 * 1024
        ) {
            notify("El archivo seleccionado excede el tamaño máximo permitido.");
            selectedFile = null;
            event.target.value = ''; // Restablecer la selección
            updatePostMediaButton();
            return;
        }
        updatePostMediaButton(selectedFile.name);
    } else {
        updatePostMediaButton();
    }
}

  function wherePost() {
    const messageList = document.getElementById('messageList');
    const groupMessageList = document.getElementById('groupMessageList');
    const postList = document.getElementById('postList');
    const forumList = document.getElementById('forumList');

    if (postList.style.display === 'block') {
        postpost();
    } else if (forumList.style.display === 'block') {
        sendForumMessage(activeForum);
    } else if (messageList.style.display === 'block') {
        sendChatMessage(activeChat);
    } else if (groupMessageList.style.display === 'block') {
        sendGroupMessage(activeGroup);
    } else {
        notify("No puedes publicar un mensaje aquí");
    }
}


const lastMessageContentByContext = new Map();

let publishing = false;
const publicationKeys = new Map();

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
    if ((!content && !file) || content.length > 10000) return notify('Escribí un texto o adjuntá una imagen, audio o video. El texto admite hasta 10.000 caracteres.', 'error');
    if (containsForbiddenWords(content)) return notify('Revisá el contenido: puede infringir los términos y condiciones.', 'error');
    const context = kind + ':' + (contextId || activeUser);
    if (!file && lastMessageContentByContext.get(context) === content) return notify('No podés enviar el mismo texto dos veces seguidas.', 'error');
    const isPost = kind === 'post';
    const payload = isPost ? { username: activeUser, content, sensitive }
        : { content, sensitive, sender_id: users[activeUser]?.id, is_private: kind === 'chat' };
    const previousSend = publicationKeys.get(context);
    const sameSend = previousSend && previousSend.content === content && previousSend.file === file && previousSend.sensitive === sensitive;
    const requestId = sameSend ? previousSend.id : crypto.randomUUID();
    const pendingSend = sameSend ? previousSend : { id: requestId, content, file, sensitive };
    publicationKeys.set(context, pendingSend);
    payload.requestId = requestId;
    const url = isPost ? '/posts' : kind === 'group' ? '/group/messages/' + contextId : '/mensajes/' + contextId;
    publishing = true;
    const owner = users[activeUser]?.id;
    const draftKey = composerKey;
    const controller = publishController = new AbortController();
    const sendButton = document.getElementById('publishButton');
    if (sendButton) { sendButton.disabled = true; sendButton.querySelector('span').textContent = 'Publicando…'; }
    document.getElementById('loading').style.display = 'block';
    try {
        if (file) {
            setUploadProgress(0);
            const uploaded = pendingSend.uploaded || await uploadMedia(file, { signal: controller.signal, onProgress: setUploadProgress });
            if (controller.signal.aborted || users[activeUser]?.id !== owner) throw new DOMException('Envío cancelado', 'AbortError');
            if (!uploaded?.url) throw new Error('No se pudo confirmar la subida del archivo.');
            pendingSend.uploaded = uploaded;
            payload.media = uploaded.url;
            payload.mediaType = uploaded.mediaType;
        }
        document.getElementById('uploadStatus').hidden = true;
        if (controller.signal.aborted || users[activeUser]?.id !== owner) throw new DOMException('Envío cancelado', 'AbortError');
        const saved = await fetch(url, {
            signal: controller.signal, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        }).then(readResponse);
        if (!saved.id) throw new Error('El servidor no confirmó la publicación.');
        if (users[activeUser]?.id !== owner) return;
        publicationKeys.delete(context);
        lastMessageContentByContext.set(context, content);
        if (composerKey === draftKey) {
        // No borrar texto ni archivos que el usuario cambió durante la petición.
        if (input.value.trim() === content) input.value = '';
        if (selectedFile === file) {
            selectedFile = null;
            document.getElementById('postMedia').value = '';
            updatePostMediaButton();
        }
        if (sensitiveInput.checked === sensitive) sensitiveInput.checked = false;
        saveComposerDraft();
        } else {
            const draft = composerDrafts.get(draftKey);
            if (draft?.text.trim() === content && draft.file === file && draft.sensitive === sensitive) composerDrafts.delete(draftKey);
        }
        notify(isPost ? 'Tu post se publicó correctamente.' : 'Mensaje enviado.', 'success');
        if (sensitive && !showSensitiveContent) notify('El contenido sensible está oculto por el filtro actual.');
        await queueFeedUpdate({ id: saved.id });
    } catch (error) {
        if (users[activeUser]?.id === owner) notify(error.name === 'AbortError' ? 'Subida cancelada. Conservamos tu borrador.' : error.message || 'No se pudo publicar. Intentá nuevamente.', error.name === 'AbortError' ? 'info' : 'error');
    } finally {
        publishing = false;
        publishController = null;
        document.getElementById('uploadStatus').hidden = true;
        document.getElementById('loading').style.display = 'none';
        if (sendButton) { sendButton.disabled = false; sendButton.querySelector('span').textContent = 'Cebar'; }
    }
}

function sendForumMessage(id) { return publishContent('forum', id); }
function sendChatMessage(id) { return publishContent('chat', id); }
function sendGroupMessage(id) { return publishContent('group', id); }
function postpost() { return publishContent('post'); }

function goBackToInitial() {
document.getElementById('usernameOverlay').style.display = 'none';
document.getElementById('userSelectOverlay').style.display = 'none';

document.getElementById('initialOverlay').style.display = 'flex';
if (registerWidgetId !== null) turnstile.reset(registerWidgetId);
if (loginWidgetId !== null) turnstile.reset(loginWidgetId);
}

let showSensitiveContent = false;

function buttonsState() {
    if (document.getElementById('profileList').style.display === 'block') return viewProfile(currentProfileUsername);
    if (document.getElementById('forumList').style.display === 'block') return loadForumPosts(activeForum, loadAll);
    if (document.getElementById('messageList').style.display === 'block') return loadChatMessages(activeChat, loadAll);
    if (document.getElementById('groupMessageList').style.display === 'block') return loadGroupMessages(activeGroup, loadAll);
    return loadposts(loadAll);
}

// Función para alternar la configuración de contenido sensible
function toggleSensitiveContent() {
showSensitiveContent = !showSensitiveContent;

const toggleButton = document.getElementById('toggleButton');

// Actualiza el texto del botón
toggleButton.textContent = showSensitiveContent
    ? 'Ocultar contenido sensible'
    : 'Mostrar contenido sensible';

// Llamar a buttonsState para recargar los posts según el estado actual
buttonsState();
}

let feedRequest = 0;

let feedState = null;
let feedObserver = null;
async function loadFeed(url, listId, all, messages = false) {
    document.getElementById('appContainer').style.display = 'block';
    feedObserver?.disconnect();
    feedState?.controller?.abort();
    const request = ++feedRequest;
    switchComposerDraft(url);
    const list = document.getElementById(listId);
    showOnlyMenu(listId);
    list.replaceChildren();
    document.querySelectorAll('.feed-update').forEach(el => el.remove());
    feedState = { request, url, listId, messages, cursor: null, pending: false, ended: false, seen: new Set(), updates: new Set(), controller: new AbortController() };
    return loadNextPage();
}
async function loadNextPage() {
    const state = feedState;
    if (!state || state.pending || state.ended) return;
    state.pending = true;
    const list = document.getElementById(state.listId);
    list.setAttribute('aria-busy', 'true');
    list.querySelector('.feed-pagination')?.remove();
    feedObserver?.disconnect();
    const query = new URLSearchParams({ limit: '12', sensitive: showSensitiveContent ? 'show' : 'hide', order: ordenarReacciones ? (invertirOrden ? 'reactions-asc' : 'reactions') : invertirOrden ? 'oldest' : 'newest' });
    if (state.cursor) query.set('cursor', state.cursor);
    let failed = false;
    try {
        const payload = await fetch(state.url + (state.url.includes('?') ? '&' : '?') + query, { signal: state.controller.signal }).then(readResponse);
        if (state !== feedState) return;
        let rows = Array.isArray(payload) ? payload : payload.items;
        if (!Array.isArray(rows)) throw new Error('El servidor devolvió una lista inválida.');
        // Compatibility with older API clients; the current API filters and orders in SQL.
        if (Array.isArray(payload)) {
            rows = rows.filter(row => showSensitiveContent || !row.sensitive);
            rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            if (invertirOrden) rows.reverse();
            rows = rows.slice(0, 12);
        }
        for (const row of rows) {
            const key = String(row.postId ?? row.id);
            if (state.seen.has(key)) continue;
            state.seen.add(key);
            const card = addpostToList(row.content, row.media, state.messages ? row.media_type : row.mediaType, row.username,
                state.messages ? row.image : row.profilePicture, row.sensitive, row.created_at,
                state.messages ? row.sender_id : row.userId, state.messages ? row.id : row.postId, state.listId);
            card.dataset.score = String(row.reactionTotal ?? row.reaction_total ?? 0);
            positionFeedCard(list, card);
        }
        state.cursor = payload.nextCursor || null;
        state.ended = !state.cursor;
        if (!state.seen.size) {
            const empty = document.createElement('li'); empty.className = 'feed-state';
            empty.textContent = 'No hay publicaciones para mostrar con estos filtros.'; list.append(empty);
        }
    } catch (error) {
        if (state !== feedState || error.name === 'AbortError') return;
        failed = true;
        notify('No se pudieron cargar las publicaciones: ' + error.message, 'error');
    } finally {
        state.pending = false;
        if (state === feedState) {
            list.setAttribute('aria-busy', 'false');
            if (!state.ended || failed) {
                const footer = document.createElement('li'); footer.className = 'feed-pagination';
                const button = menuButton(failed ? 'Reintentar carga' : 'Cargar 12 más', loadNextPage);
                footer.append(button); list.append(footer);
                if (!failed && typeof IntersectionObserver === 'function') {
                    feedObserver = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) loadNextPage(); }, { rootMargin: '250px' });
                    feedObserver.observe(footer);
                }
            }
        }
    }
}
async function queueFeedUpdate(data) {
    const state = feedState;
    if (!state || !data?.id || state.seen.has(String(data.id))) return;
    if (state.messages !== /^[CFG]-/.test(String(data.id))) return;
    const updateId = String(data.id);
    if (state.updates.has(updateId)) return;
    state.updates.add(updateId);
    // Fetch through the current feed: its membership, author and sensitive filters still apply.
    const query = new URLSearchParams({ limit: '12', item: String(data.id), sensitive: showSensitiveContent ? 'show' : 'hide', order: ordenarReacciones ? (invertirOrden ? 'reactions-asc' : 'reactions') : invertirOrden ? 'oldest' : 'newest' });
    try {
        const payload = await fetch(state.url + (state.url.includes('?') ? '&' : '?') + query, { signal: state.controller.signal }).then(readResponse);
        if (state !== feedState) return;
        const list = document.getElementById(state.listId);
        insertFeedRows(state, payload.items || []);
    } catch (error) {
        if (state !== feedState) return;
        // A retry loads only this item; it never replaces the existing feed.
        const retry = menuButton('Reintentar cargar la publicación nueva', () => { retry.remove(); queueFeedUpdate(data); });
        retry.className = 'feed-update';
        document.getElementById(state.listId).before(retry);
    } finally { state.updates.delete(updateId); }
}

function positionFeedCard(list, added) {
    const ascending = invertirOrden;
    const compare = other => {
        let delta = ordenarReacciones ? Number(added.dataset.score || 0) - Number(other.dataset.score || 0) : 0;
        if (!delta) delta = new Date(added.dataset.createdAt) - new Date(other.dataset.createdAt);
        if (!delta) {
            const left = BigInt(added.dataset.postId.replace(/^[CFG]-/, '')), right = BigInt(other.dataset.postId.replace(/^[CFG]-/, ''));
            delta = left < right ? -1 : left > right ? 1 : 0;
        }
        return ascending ? delta : -delta;
    };
    const before = [...list.children].find(other => other !== added && other.classList.contains('post') && compare(other) < 0);
    list.insertBefore(added, before || list.querySelector('.feed-pagination'));
}
function insertFeedRows(state, rows) {
    const list = document.getElementById(state.listId);
        for (const row of rows) {
            const key = String(row.postId ?? row.id);
            if (state.seen.has(key)) continue;
            const anchor = [...list.children].find(el => el.classList.contains('post') && el.getBoundingClientRect().bottom > 0);
            const offset = anchor?.getBoundingClientRect().top;
            const keepPosition = anchor && window.scrollY > 100;
            state.seen.add(key);
            list.querySelector('.feed-state')?.remove();
            addpostToList(row.content, row.media, state.messages ? row.media_type : row.mediaType, row.username,
                state.messages ? row.image : row.profilePicture, row.sensitive, row.created_at,
                state.messages ? row.sender_id : row.userId, row.postId ?? row.id, state.listId);
            const added = list.lastElementChild;
            added.dataset.score = String(row.reactionTotal ?? row.reaction_total ?? 0);
            positionFeedCard(list, added);
            if (keepPosition) window.scrollBy(0, anchor.getBoundingClientRect().top - offset);
        }
}
let reconnectJob = null;
async function reconcileFeed() {
    if (reconnectJob) return reconnectJob;
    const state = feedState; if (!state) return;
    reconnectJob = (async () => {
        let cursor = null, reached = false;
        do {
            const query = new URLSearchParams({ limit: '12', order: 'newest', sensitive: showSensitiveContent ? 'show' : 'hide' });
            if (cursor) query.set('cursor', cursor);
            const payload = await fetch(state.url + (state.url.includes('?') ? '&' : '?') + query, { signal: state.controller.signal }).then(readResponse);
            if (state !== feedState) return;
            reached = payload.items.some(row => state.seen.has(String(row.postId ?? row.id)));
            if (ordenarReacciones) for (const row of payload.items) await queueFeedUpdate({ id: row.postId ?? row.id });
            else insertFeedRows(state, payload.items);
            cursor = payload.nextCursor;
        } while (cursor && !reached);
        if (users[activeUser]?.id) await obtenerNotificaciones();
    })().catch(error => { if (error.name !== 'AbortError') notify('No se pudieron recuperar todas las novedades. Reintentá recargando.', 'error'); }).finally(() => { reconnectJob = null; });
    return reconnectJob;
}
function loadposts(all) {
    activeForum = 0; activeChat = ''; activeGroup = '';
    document.getElementById('profileHeader').style.display = 'none';
    document.getElementById('postBox').style.display = 'block';
    return loadFeed('/posts', 'postList', all);
}

function createOrLoadChat(user2Id) {
    document.getElementById('profileHeader').style.display = 'none';
    document.getElementById('postBox').style.display = 'block';
const user1Id = users[activeUser]?.id;

if (!user1Id || !user2Id) {
    notify('IDs de usuario incompletos');
    return;
}

fetch('/createOrLoadPrivateChat', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user1Id, user2Id }),
})
    .then(response => {
        if (!response.ok) {
            return response.json().then(errorData => {
                throw new Error(errorData.error || 'Error desconocido');
            });
        }
        return response.json();
    })
    .then(data => {
        const { chatId } = data;
        if (!chatId) {
            throw new Error('No se recibió un chatId válido del servidor');
        }

        // Llamar a la función de cargar mensajes
        loadChatMessages(chatId, loadAll);
        activeChat = chatId;
    })
    .catch(error => {
        console.error('Error en createOrLoadChat:', error);
        notify(`Error: ${error.message}`);
    });
}

function loadChatMessages(id, all) {
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
    return loadFeed('/group/messages/' + id + '/' + users[activeUser]?.id, 'groupMessageList', all, true);
}

function loadForumPosts(id, all) {
    activeChat = ''; activeGroup = ''; activeForum = id;
    document.getElementById('profileHeader').style.display = 'none';
    document.getElementById('postBox').style.display = 'block';
    return loadFeed('/mensajes/' + id, 'forumList', all, true);
}

function updateOrderButton(button) {
    const label = (ordenarReacciones ? 'Más reacciones' : 'Más nuevos') + (invertirOrden ? ' abajo' : ' arriba');
    button.textContent = '';
    button.dataset.direction = invertirOrden ? 'down' : 'up';
    button.title = label;
    button.setAttribute('aria-label', label);
}

function toggleOrden(button) {
    invertirOrden = !invertirOrden;

    updateOrderButton(button);

    reloadPosts(); // Recargar los posts con la nueva configuración
}

function toggleOrdenR(button) {
    ordenarReacciones = !ordenarReacciones; // Alternar el estado de ordenar por reacciones

    // Si se activa ordenar por reacciones, asegurarse de que se mantiene el orden coherente
    if (ordenarReacciones) {
        invertirOrden = false; // Poner por defecto "Más reacciones arriba"
    }

    // Actualizar el texto del botón principal
    const ordenButton = document.getElementById('bto');
    if (ordenButton) updateOrderButton(ordenButton);

    // Actualizar el texto del botón que alterna ordenar por reacciones
    button.textContent = ordenarReacciones ? 'Ordenado por reacciones' : 'Ordenar por reacciones';

    reloadPosts(); // Volver a cargar los posts aplicando la nueva configuración
}

function addpostToList(content, media, mediaType, username, profilePicture, sensitive, created_at, userId, postId, listId, invertirOrden, esUltimoPost) {
    const postList = document.getElementById(listId);
    if (!postList) {
        console.error(`No se encontró el contenedor con id "${listId}".`);
        return;
    }

    const newpost = document.createElement('li');
    newpost.dataset.postId = String(postId);
    newpost.className = 'post postContainer';
    if (created_at) newpost.dataset.createdAt = created_at;

    // Convertir fecha a hora local
    const localTime = safeDate(created_at);

    // Imagen del perfil
    const profilePicHTML = profilePicture
        ? `<img src="${escapeHTML(profilePicture)}" alt="Foto de perfil de ${escapeHTML(username)}" class="profile-picture">`
        : `<img src="/resources/SVG/default-avatar.svg" alt="Foto de perfil por defecto" class="profile-picture">`;

    // Media del post
    let mediaHTML = '';
    if (media && mediaType) {
        if (mediaType.startsWith('image/')) {
            mediaHTML = `
            <div class="media-container">
                <img src="${escapeHTML(media)}" ${/^\/uploads\/[0-9a-f-]+\.(png|jpg|webp|avif)$/.test(media) ? `srcset="${escapeHTML(media)}?width=384 384w, ${escapeHTML(media)}?width=960 960w" sizes="(max-width:768px) 90vw, 650px"` : ''} loading="lazy" decoding="async" alt="Imagen subida por ${escapeHTML(username)}" class="preview-media clickable">
                <button class="fullscreen-btn" onclick="openFullscreen(this.previousElementSibling)">⛶</button>
            </div>`;
        } else if (mediaType.startsWith('video/')) {
            mediaHTML = `<div>
                            <video preload="none" controls class="preview-media clickable">
                                <source src="${escapeHTML(media)}" type="${escapeHTML(mediaType)}">
                                Tu navegador no soporta la reproducción de video.
                            </video>
                        </div>`;
        } else if (mediaType.startsWith('audio/')) {
            mediaHTML = `<div>
                            <audio preload="none" controls class="preview-media clickable">
                                <source src="${escapeHTML(media)}" type="${escapeHTML(mediaType)}">
                                Tu navegador no soporta la reproducción de audio.
                            </audio>
                        </div>`;
        }
    }

    // Contenido sensible
    let contentHTML = sensitive
        ? `<div class="sensitive-content">
                <p>⚠ Este contenido ha sido marcado como sensible</p>
                <button onclick="this.nextElementSibling.style.display='block'; this.style.display='none';">Mostrar contenido</button>
                <div class="hidden-content clickable" style="display:none;">
                    ${linkifyPost(content)}
                    ${mediaHTML}
                </div>
            </div>`
            : `<div class="post-content clickable">
            <div class="post-text">${linkifyPost(content)}</div>
            ${mediaHTML}
        </div>`;

    const uniqueId = `userProfileBox_${userId}_${Math.random().toString(36).substr(2, 9)}`;
    const microReactId = `post-${postId}`;

    // HTML del post
     newpost.innerHTML = `
        <div class="post-header">
            <div class="post-user-info">
                <button type="button" class="username profile-trigger" onclick="toggleUserProfileBox('${uniqueId}')" aria-controls="${uniqueId}" aria-expanded="false">
                ${profilePicHTML}
                <span class="username-text">${escapeHTML(username)}</span>
            </button>
                <span class="post-time">${localTime}</span>
            </div>
        </div>
        <div class="user-profile-box" id="${uniqueId}" style="display:none; margin-bottom: 8px">
          <div role="group" aria-label="Acciones del perfil">
            <button onclick="viewProfile(${escapeHTML(JSON.stringify(String(username)))})">Ver perfil</button>
            <button onclick="followUser(${userId})">Seguir</button>${Number(userId) !== Number(users[activeUser]?.id) ? `<button onclick="blockUser(${userId})">Bloquear</button>` : ''}
          </div>
        </div>
        ${contentHTML}
        <button id="toggle-reactions-${microReactId}" class="toggle-reactions icon-button" aria-controls="reactions-${microReactId}" aria-expanded="false" aria-label="Mostrar u ocultar reacciones" title="Reacciones" onclick="toggleReactions('${microReactId}')"><img src="/res/react.svg" alt=""></button>
        <div id="reactions-${microReactId}"
            style="opacity: 0; display: none; width: 100%; align-items: center; justify-content: center; margin-top: 10px;">
            <mate-reactions data-id="Matesito_${microReactId}"></mate-reactions>
        </div>
    `;

    if (/^(?:F-)?[1-9]\d*$/.test(String(postId))) {
        const share = document.createElement('button');
        share.type = 'button'; share.className = 'share-post-button icon-button';
        share.setAttribute('aria-label', 'Compartir publicación');
        const icon = document.createElement('img'); icon.src = '/res/share.svg'; icon.alt = ''; share.append(icon);
        share.title = 'Copiar enlace de esta publicación';
        share.addEventListener('click', () => sharePost(postId));
        const reactions = newpost.querySelector('.toggle-reactions');
        const actions = document.createElement('div'); actions.className = 'post-actions';
        reactions.before(actions); actions.append(reactions, share);
    }
    addPublicationTools(newpost, postId, userId, content, sensitive);
    postList.appendChild(newpost);
    return newpost;
}

function toggleReactions(postId) {
    const reactionsContainer = document.getElementById(`reactions-${postId}`);
    if (reactionsContainer) {
        const open = reactionsContainer.style.display === 'none';
        reactionsContainer.style.display = open ? 'flex' : 'none';
        if (open) reactionsContainer.querySelector('mate-reactions')?.activate();
        reactionsContainer.style.opacity = open ? '1' : '0';
        document.getElementById(`toggle-reactions-${postId}`)?.setAttribute('aria-expanded', String(open));
    }
}

// Mostrar u ocultar el cuadro de perfil cuando se hace clic en el nombre de usuario
function toggleUserProfileBox(uniqueId) {
    document.querySelectorAll('.publication-tools[open]').forEach(menu => { menu.open = false; });
    document.querySelectorAll('.profile-trigger').forEach(button => button.setAttribute('aria-expanded', String(button.getAttribute('aria-controls') === uniqueId && activeMenuId !== uniqueId)));
    const userProfileBox = document.getElementById(uniqueId);

    if (activeMenuId === uniqueId) {
        // Si el mismo menú está abierto, se cierra
        userProfileBox.style.display = 'none';
        activeMenuId = null;
    } else {
        // Cierra todos los menús abiertos antes de abrir el nuevo
        document.querySelectorAll('.user-profile-box').forEach(box => {
            box.style.display = 'none';
        });

        // Abre el nuevo menú
        userProfileBox.style.display = 'block';
        activeMenuId = uniqueId;
    }
}

// Función para ver el perfil del usuario (puedes redirigir a una página de perfil)
async function viewProfile(username) {
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
}

// Función para volver a las publicaciones
function backToPosts() {
    // Ocultar sección de perfil
    document.getElementById('profileHeader').style.display = 'none';

    // Mostrar caja de publicaciones
    document.getElementById('postBox').style.display = 'block';
    document.getElementById('postList').style.display = 'block';

    // Volver a cargar los posts principales
    loadposts(loadAll);
}

// Función para seguir al usuaris
function followUser(userId) {
const followerId = users[activeUser]?.id; // El ID del usuario que está siguiendo

if (!followerId) {
    showUserSelectOverlay();
    return;
}

if (followerId === userId) {
    notify('No puedes seguirte ti mismo');
    return;
}

fetch('/followUser', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ followerId, followedId: userId })
})
.then(response => {
    return response.json().then(data => {
        if (!response.ok) {
            throw new Error(data.message || 'Error desconocido');
        }
        return data;
    });
})
.then(data => {
    notify(data.message); // Mensaje del backend
})
.catch(error => {
    console.error('Error al seguir al usuario:', error);
    notify(error.message || 'Error al seguir al usuario');
});
}

function unfollowUser(followerId, followedId) {
fetch('/unfollowUser', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ followerId, followedId })
})
.then(readResponse)
.then(data => {
    if (data.message === 'Has dejado de seguir a este usuario') {
        notify('Has dejado de seguir a este usuario');
    } else {
        notify(data.message);
    reloadFG();
    }
})
.catch(error => {
    console.error('Error al dejar de seguir:', error);
    notify('Error al dejar de seguir al usuario');
});
}

function menuButton(text, action) {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = text; button.addEventListener('click', action);
    return button;
}
async function loadFollowedUsers(offset = 0) {
    const userId = users[activeUser]?.id;
    if (!userId) return;
    const container = document.getElementById('usersContainer');
    if (!container) return;
    const request = beginMenuRequest(container);
    try {
        const following = await fetchMenuPage('/followedUsers/' + userId, offset, request);
        if (!request.current()) return;
        if (!offset) container.replaceChildren();
        if (!following.length) container.textContent = 'Todavía no seguís a nadie. Buscá usuarios para sumarte a su ronda.';
        for (const user of following) {
            const card = document.createElement('div'); card.className = 'user-item';
            const name = document.createElement('h3'); name.textContent = user.username;
            card.append(name, menuButton('Ver perfil', () => viewProfile(user.username)),
                menuButton('Chat privado', () => createOrLoadChat(user.id)),
                menuButton('Dejar de seguir', () => unfollowUser(userId, user.id)));
            container.appendChild(card);
        }
        addMenuContinuation(container, request, loadFollowedUsers);
    } catch (error) { if (!request.current()) return; container.replaceChildren(); const message = document.createElement('p'); message.textContent = error.message; container.append(message, menuButton('Reintentar', () => loadFollowedUsers())); } finally { request.finish(); }
}
async function loadGroups(created, offset = 0) {
    const userId = users[activeUser]?.id;
    if (!userId) return;
    const container = document.getElementById(created ? 'createdGroupsContainer' : 'joinedGruposContainer');
    if (!container) return;
    const request = beginMenuRequest(container);
    try {
        const groups = await fetchMenuPage((created ? '/grupos-creados/' : '/grupos-usuario/') + userId, offset, request);
        if (!request.current()) return;
        if (!offset) container.replaceChildren();
        if (!groups.length) container.textContent = created ? 'Todavía no creaste grupos.' : 'Todavía no pertenecés a un grupo.';
        for (const group of groups) {
            const card = document.createElement('div'); card.className = 'group-item';
            const name = document.createElement('h3'); name.textContent = group.name;
            const description = document.createElement('p'); description.textContent = group.description;
            const invite = document.createElement('details'); invite.className = 'invite-details';
            const summary = document.createElement('summary'); summary.textContent = 'Invitar al grupo';
            const code = document.createElement('code'); code.textContent = group.invite_code || 'Código no disponible';
            invite.append(summary, code);
            if (group.invite_code) invite.appendChild(menuButton('Copiar código', async () => { try { await navigator.clipboard.writeText(group.invite_code); notify('Código copiado'); } catch { notify('No se pudo copiar. Seleccioná el código para copiarlo manualmente.', 'error'); } }));
            card.append(name, description, invite, menuButton('Entrar al chat', () => loadGroupMessages(group.id, loadAll)),
                menuButton(created ? 'Eliminar grupo' : 'Salir del grupo', () => created ? deleteGroup(group.id) : leaveGroup(group.id)));
            container.appendChild(card);
        }
        addMenuContinuation(container, request, next => loadGroups(created, next));
    } catch (error) { if (!request.current()) return; container.replaceChildren(); const message = document.createElement('p'); message.textContent = error.message; container.append(message, menuButton('Reintentar', () => loadGroups(created))); } finally { request.finish(); }
}
function loadUserGroups() { return loadGroups(false); }
function loadCreatedGroups() { return loadGroups(true); }

async function deleteGroup(groupId) {
if (!await confirmAction('¿Eliminar este grupo y sus mensajes?')) return;
const userId = users[activeUser]?.id; // ID del suario activo

fetch(` /grupo/${groupId}/${userId}`, {
    method: 'DELETE',
})
    .then(readResponse)
    .then(data => {
        if (data.message) {
            notify(data.message); // Mostrar mensaje de éxito
            loadCreatedGroups(); // Volver a cargar los grupos creados
        } else {
            notify(data.error); // Mostrar mensaje de error
        }
    })
    .catch(error => {
        console.error('Error al eliminar el grupo:', error);
        notify('Error al eliminar el grupo');
    });
}


let notificationRequest = 0;
async function obtenerNotificaciones() {
const request = ++notificationRequest;
const user = users[activeUser];
const contenedor = document.getElementById('renderNotif');
if (!user || !user.id || !contenedor) return;
const userId = user.id;

try {
    const response = await fetch(`/notificaciones/${userId}`, { credentials: 'same-origin' });
    const payload = await response.json();
    if (request !== notificationRequest || users[activeUser]?.id !== userId) return;
    if (!response.ok) {
        if (response.status === 401 || response.status === 403) return;
        throw new Error(payload.error || 'No se pudieron obtener las notificaciones');
    }
    const notificaciones = Array.isArray(payload) ? payload : [];

    renderizarNotificaciones(notificaciones);
    actualizarIndicadorNotificaciones(notificaciones.length > 0);
} catch (error) {
    if (request !== notificationRequest) return;
    console.error('Error al obtener notificaciones:', error);
    contenedor.textContent = 'No se pudieron cargar las notificaciones.';
    contenedor.appendChild(menuButton('Reintentar', obtenerNotificaciones));
}
}

function renderizarNotificaciones(notificaciones) {
const user = users[activeUser];
const contenedor = document.getElementById('renderNotif');
if (!user || !user.id || !contenedor) return;
const userId = user.id;
contenedor.innerHTML = '';

if (!Array.isArray(notificaciones) || notificaciones.length === 0) {
    contenedor.innerHTML = '<p>No tienes notificaciones nuevas.</p>';
    actualizarIndicadorNotificaciones(false);
    return;
}

notificaciones.forEach(noti => {
    const notiElemento = document.createElement('button');
    notiElemento.type = 'button';
    notiElemento.classList.add('Nboton');

    let mensaje = '';
    let idNotificacionLeida = false;

    // Verificar si el chat_or_group_id corresponde a alguno de los activos
    if (noti.chat_or_group_id === `F-${activeForum}` || noti.chat_or_group_id === `C-${activeChat}` || noti.chat_or_group_id === `G-${activeGroup}`) {
        idNotificacionLeida = [...document.querySelectorAll('.post[data-post-id]')].some(post =>
            post.dataset.postId === String(noti.referencia_id) && post.parentElement.style.display === 'block');
    }

    const nombre = noti.nombre;
    notiElemento.addEventListener('click', () => hideMenus('notifMenu'));
    const chat_or_group_id = Number(String(noti.chat_or_group_id).replace(/^[CFG]-/, ''));

    if (noti.tipo === 'reaccion') {
        idNotificacionLeida = false;
        const reactionNames = { 1: 'me gusta', 2: 'me encanta', 3: 'me divierte', 4: 'me sorprende', 5: 'me entristece' };
        mensaje = (noti.actor || 'Alguien') + ' reaccionó con ' + (reactionNames[noti.reaction_id] || 'una reacción') + ' a tu publicación.';
        notiElemento.addEventListener('click', () => {
            if (/^(?:F-)?[1-9]\d*$/.test(String(noti.referencia_id))) location.href = '/p/' + noti.referencia_id;
            else if (String(noti.chat_or_group_id).startsWith('C-')) loadChatMessages(chat_or_group_id, loadAll);
            else if (String(noti.chat_or_group_id).startsWith('G-')) loadGroupMessages(chat_or_group_id, loadAll);
        });
    } else if (noti.tipo === 'mensaje') {
        mensaje = `Tienes un nuevo mensaje de ${nombre}`;
        notiElemento.addEventListener('click', () => {
            if (Number.isSafeInteger(chat_or_group_id)) loadChatMessages(chat_or_group_id, loadAll);
        });
    } else if (noti.tipo === 'grupo') {
        mensaje = `Tienes nuevos mensajes del grupo ${nombre}`;
        notiElemento.addEventListener('click', () => loadGroupMessages(chat_or_group_id, loadAll));
    } else if (noti.tipo === 'foro') {
        mensaje = `Hay una nueva publicación en el foro ${nombre}`;
        notiElemento.addEventListener('click', () => loadForumPosts(chat_or_group_id, loadAll));
    } else {
        mensaje = 'Tenés una nueva notificación.';
    }

    notiElemento.textContent = mensaje;
    notiElemento.dataset.id = noti.id;

    // Si la notificación debe ser marcada como leída automáticamente
    if (idNotificacionLeida) {
        marcarComoLeida(userId, noti.id, notiElemento);
    } else {
        // Marcar la notificación como leída al hacer clic
        notiElemento.addEventListener('click', async () => {
            await marcarComoLeida(userId, noti.id, notiElemento);
        });
    }

    contenedor.appendChild(notiElemento);
});

// Mueve la actualización del indicador fuera del forEach
actualizarIndicadorNotificaciones(notificaciones.length > 0);
}

async function marcarComoLeida(userId, notiId, elemento) {
try {
    const response = await fetch(`/notificaciones/${userId}/leer`, {
        method: 'PUT',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notiId }) // Ahora envía el ID correcto
    });

    if (!response.ok) throw new Error('No se pudo marcar la notificación');
    elemento.remove();

    // Verificar si quedan notificaciones en pantalla
    const contenedor = document.getElementById('renderNotif');
    if (contenedor.children.length === 0) {
        contenedor.innerHTML = '<p>No tienes notificaciones nuevas.</p>';
        actualizarIndicadorNotificaciones(false);
    }
} catch (error) {
    console.error('Error al eliminar notificación:', error);
}
}


function actualizarIndicadorNotificaciones(hayNotificaciones) {
const punto = document.getElementById('iconoNotificacion');
if (!punto) return;
// Usa visibility en lugar de display/opacity para evitar problemas con el label
if (hayNotificaciones){
    punto.src = "resources/SVG/notifications_new.svg";
}else{
    punto.src = "resources/SVG/notifications.svg";
}
}


let searchRequest = 0;
let searchTimer;
let searchController;
function searchMotor() {
    ++searchRequest;
    clearTimeout(searchTimer);
    searchController?.abort();
    searchTimer = setTimeout(runSearch, 200);
}
function runSearch(offset = 0) {
const request = ++searchRequest;
const searchInput = document.getElementById('searchInput');
const searchContainer = document.getElementById('searchconteiner');
if (!searchInput || !searchContainer) return;
const query = searchInput.value;

// Si el campo está vacío, limpiar y salir
if (query.trim().length < 1) {
    searchContainer.innerHTML = '<p>Escribí un nombre para empezar.</p>';
    return; // Detener la ejecución
}

searchController = new AbortController();
fetch(`/search?query=${encodeURIComponent(query.trim())}&offset=${offset}`, { signal: searchController.signal })
    .then(readResponse)
    .then(data => {
        if (request !== searchRequest) return;
        if (!offset) searchContainer.innerHTML = '';
        searchContainer.querySelector('.search-more')?.remove();

        if (data.foros.length === 0 && data.usuarios.length === 0) {
            searchContainer.innerHTML = '<p>No se encontraron resultados.</p>';
        }

        if (data.nextOffset !== null && data.nextOffset !== undefined) {
            const more = menuButton('Cargar más resultados', () => runSearch(data.nextOffset)); more.className = 'search-more'; searchContainer.append(more);
        }
        // Mostrar foros
        data.foros.forEach(foro => {
            const foroElement = document.createElement('button');
            foroElement.type = 'button';
            foroElement.classList.add('SearchContainer', 'forum-item'); // Agregar clases
            const foroLabel = document.createElement('p');
            const foroStrong = document.createElement('strong');
            foroStrong.textContent = 'Foro:';
            foroLabel.append(foroStrong, ` ${foro.name || ''}`);
            foroElement.appendChild(foroLabel);
            // Agregar manejador de clic para el foro
            foroElement.addEventListener('click', () => {
                loadForumPosts(foro.id, loadAll); // Llamar a la función con el ID del foro
            });
            searchContainer.appendChild(foroElement);
        });

        // Mostrar usuarios
        data.usuarios.forEach(user => {
            const userElement = document.createElement('button');
            userElement.type = 'button';
            userElement.classList.add('SearchContainer'); // Agregar clase
            const userItem = document.createElement('div');
            userItem.className = 'SearchContainer user-item';
            userItem.style.cssText = 'margin-top: 5px; margin-bottom: 5px;';
            const image = document.createElement('img');
            image.src = user.profilePicture || '/resources/SVG/default-avatar.svg';
            image.alt = user.username || 'Usuario';
            image.className = 'profile-picture';
            const name = document.createElement('span');
            name.className = 'username';
            name.textContent = user.username || '';
            userItem.append(image, name);
            userElement.appendChild(userItem);
            // Agregar manejador de clic para el usuario
            userElement.addEventListener('click', () => {
                viewProfile(user.username); // Llamar a la función con el nombre de usuario
            });
            searchContainer.appendChild(userElement);
        });
    })
    .catch(error => {
        if (request !== searchRequest || error.name === 'AbortError') return;
        searchContainer.textContent = 'No se pudo completar la búsqueda. Volvé a intentar.';
        console.error('Error al buscar:', error);
        notify('Error al procesar la búsqueda');
    });
}

async function init() {
    checkRememberedUser();
    HideOverlays();
    loadposts(loadAll);
    try {
        const response = await fetch('/session');
        if (response.status === 401) { if (!welcomeDismissed) showUserSelectOverlay(); return; }
        const session = await readResponse(response);
        await activateUser(session.username);
        if (typeof openRequestedPanel === 'function') openRequestedPanel();
    } catch (error) {
        notify('No se pudo recuperar la sesión: ' + error.message, 'error');
        if (!welcomeDismissed) showUserSelectOverlay();
    }
}

//al cargar página
function startCommunity() {
    verMant(mantenimiento);
    init();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startCommunity, { once: true });
else startCommunity();
