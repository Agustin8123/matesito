const fs = require('node:fs');
const { JSDOM } = require('jsdom');
const dom = new JSDOM(fs.readFileSync('public/index.html', 'utf8'));
const d = dom.window.document;
const html = (tag, markup) => { const el = d.createElement(tag); el.innerHTML = markup; return el; };
for (const href of ['/index.css', '/modern.css']) {
    const link = d.createElement('link'); link.rel = 'stylesheet'; link.href = href; d.head.appendChild(link);
}
d.title = 'Matesito · Tu comunidad';
d.documentElement.setAttribute('data-theme', 'dark');
const dialog = html('dialog', '<div class="panel-heading"><h2 id="panelTitle">Explorar</h2><button type="button" onclick="closePanel()" aria-label="Cerrar panel">×</button></div><div id="panelContent"></div>');
dialog.id = 'navigationPanel'; dialog.className = 'navigation-panel'; dialog.setAttribute('aria-labelledby', 'panelTitle');
d.body.appendChild(dialog);
const menuStore = d.createElement('div'); menuStore.id = 'menuStore'; menuStore.hidden = true;
d.body.appendChild(menuStore);
for (const id of ['rightMenu', 'SearchMenu', 'dropdownMenu']) menuStore.appendChild(d.getElementById(id));
const header = d.querySelector('.header');
header.innerHTML = `<button class="mobile-menu" type="button" onclick="toggleSidebar()" aria-label="Abrir navegación" aria-expanded="false">☰</button>
    <h1 id="pageTitle">Inicio</h1>
    <div class="header-actions"><button type="button" onclick="toggleSearch()" aria-label="Buscar usuarios y foros">Buscar</button><button id="userButton" type="button" onclick="toggleMenu()" aria-label="Mi cuenta"></button></div>
    <div class="loader-container" id="loading" style="display:none" role="status" aria-label="Publicando"><div class="loader"></div></div>`;
const sidebar = html('aside', `<a class="brand" href="/" aria-label="Matesito, inicio"><img class="logo" src="/res/logo-dark.svg" alt="">matesito</a>
    <nav class="sidebar-nav" aria-label="Navegación principal">
        <button class="sidebar-nav-element active" onclick="navigateHome()"><img class="nav-ic" src="/res/sidebar-icons/home.svg" alt=""><span class="nav-text">Inicio</span></button>
        <button class="sidebar-nav-element" onclick="toggleUserMenu()"><img class="nav-ic" src="/res/sidebar-icons/followers.svg" alt=""><span class="nav-text">Siguiendo</span></button>
        <button class="sidebar-nav-element" onclick="toggleGruposMenu()"><img class="nav-ic" src="/res/sidebar-icons/chats.svg" alt=""><span class="nav-text">Chats y grupos</span></button>
        <button class="sidebar-nav-element" onclick="toggleBell()" id="puntoNotificacion"><img class="nav-ic" src="/res/sidebar-icons/notifications.svg" alt="" id="iconoNotificacion"><span class="nav-text">Notificaciones</span></button>
        <button class="sidebar-nav-element" onclick="toggleForumMenu()"><img class="nav-ic" src="/res/sidebar-icons/foros.svg" alt=""><span class="nav-text">Foros</span></button>
    </nav>
    <div class="sidebar-bottom"><button class="sidebar-nav-element theme-toggle" onclick="toggleTheme()"><span class="nav-ic" aria-hidden="true">◐</span><span class="nav-text">Modo claro</span></button>
    <div class="sidebar-footer"><a href="/informacion">Acerca de</a><a href="/Ayuda">Ayuda</a><a href="/Terminos">Términos</a><a href="/app">App Android</a><br>Hecho para compartir un buen mate.</div></div>`);
sidebar.className = 'sidebar'; sidebar.id = 'sidebar'; d.body.prepend(sidebar);
const app = d.getElementById('appContainer'); app.classList.add('right-side');
app.insertAdjacentHTML('afterbegin', '<div class="page-intro"><h2>La ronda está abierta.</h2><p>Compartí lo que pensás. Siempre hay lugar para uno más.</p></div>');
const postBox = d.getElementById('postBox'); postBox.classList.add('dialogPostContainer');
postBox.insertAdjacentHTML('afterbegin', '<div class="authorContainer"><img class="avatarPost" id="composerAvatar" src="/res/default-avatar.svg" alt="Tu avatar"><div><span class="authorName" id="composerName">Tu próximo mate</span><span class="composer-hint" id="composerContext">Compartí con la comunidad</span></div></div>');
const content = d.getElementById('postContent'); content.placeholder = '¿Qué vas a cebar?'; content.maxLength = 10000; content.setAttribute('aria-label', 'Texto de la publicación');
postBox.querySelector('.contenedorBotones').classList.add('composer-actions', 'buttonsSec');
postBox.querySelector('label').className = 'sensitive-check';
const send = postBox.querySelector('button[onclick="wherePost()"]'); send.id = 'publishButton'; send.className = 'post-button post-button-send'; send.textContent = 'Cebar';
const media = d.getElementById('postMediaButton'); media.className = 'post-button'; media.insertAdjacentHTML('afterbegin', '<img src="/res/image.svg" alt="">');
const filters = html('details', '<summary>Personalizar publicaciones</summary>'); filters.className = 'feed-filters';
for (const child of [...app.children]) if (child.classList.contains('contenedorBotones')) filters.appendChild(child);
app.insertBefore(filters, d.getElementById('postList'));
d.getElementById('AvisoOverlay').style.display = 'none';
const welcome = d.querySelector('#initialOverlay > div'); welcome.className = 'initial-box welcome-card';
welcome.innerHTML = `<img class="welcome-image" src="/res/login.png" alt="Un espacio para compartir"><div class="welcome-copy"><h2>Un mate.<br>Mil conversaciones.</h2><p>Sumate a la comunidad. Compartí tus ideas, encontrá tu foro y quedate a charlar.</p><button class="primary" onclick="useExistingUser()">Tengo una cuenta</button> <button onclick="createNewUser()">Crear cuenta</button><small>Matesito sigue creciendo. Si encontrás un problema, <a href="mailto:matesito.soporte@gmail.com">escribinos</a>.</small></div>`;
for (const [id, title] of [['usernameOverlay', 'Qué bueno verte de nuevo.'], ['userSelectOverlay', 'Hacete un lugar en la ronda.']]) {
    d.querySelector('#' + id + ' > div').insertAdjacentHTML('afterbegin', '<h2>' + title + '</h2>');
}
for (const [id, title] of [['usernameInput', 'Nombre de usuario'], ['passwordInput', 'Contraseña'], ['newUsernameInput', 'Nuevo nombre de usuario'], ['newPasswordInput', 'Nueva contraseña']]) {
    const el = d.getElementById(id); el.setAttribute('aria-label', title);
    el.autocomplete = id.includes('Password') ? 'new-password' : id === 'passwordInput' ? 'current-password' : 'username';
}
d.querySelector('script[src*="cdn.socket.io"]').src = '/socket.io/socket.io.js';
const inline = [...d.scripts].find(el => el.textContent.includes('const socket = io()'));
inline.textContent = inline.textContent.replace('loadposts(loadAll);', "if (document.getElementById('postList').style.display === 'block') loadposts(loadAll);");
const modernScript = d.createElement('script'); modernScript.src = '/modern.js'; d.body.appendChild(modernScript);
fs.writeFileSync('public/index.html', '<!DOCTYPE html>\n' + d.documentElement.outerHTML + '\n');
