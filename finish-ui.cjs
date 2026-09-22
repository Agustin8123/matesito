const fs = require('node:fs');
const { JSDOM } = require('jsdom');
let s = fs.readFileSync('public/scripts.js', 'utf8');
function section(start, end, code) { const a = s.indexOf(start), b = s.indexOf(end, a + start.length); if (a < 0 || b < 0) throw Error(start); s = s.slice(0, a) + code + '\n\n' + s.slice(b); }
section('function loginUser()', '// Obtener cookies', `let authPending = false;
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
}`);
section('function addNewUser()', 'function createForum()', `async function addNewUser() {
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
        let profileImage = '/resources/SVG/default-avatar.svg';
        const file = fileInput.files[0];
        if (file) {
            if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) throw new Error('Elegí una imagen de hasta 10 MB.');
            const form = new FormData(); form.append('file', file); form.append('upload_preset', 'matesito');
            const upload = await fetch('https://api.cloudinary.com/v1_1/dtzl420mq/upload', { method: 'POST', body: form }).then(readResponse);
            if (!upload.secure_url) throw new Error('No se pudo subir la imagen.');
            profileImage = upload.secure_url;
        }
        const user = await fetch('/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, profileImage, token }) }).then(readResponse);
        if (!user.id) throw new Error('No se pudo confirmar la creación de la cuenta.');
        usernameInput.value = ''; passwordInput.value = ''; fileInput.value = '';
        await activateUser(user.username);
        notify('Tu cuenta está lista. ¡Bienvenido a la ronda!', 'success');
    } catch (error) { notify(error.message, 'error'); }
    finally { authPending = false; button.disabled = !document.getElementById('acceptTermsCheckbox').checked; turnstile.reset(registerWidgetId); }
}`);
s = s.replace(/,\n            callback: function\(token\) \{[\s\S]*?\n            }\n        }\);/, '\n        });');
s = s.replace('let users = {};', 'let users = Object.create(null);').replace('        users = {};', '        users = Object.create(null);');
s = s.replace("        document.getElementById('usernameInput').value = decodeURIComponent(username);", "        try { document.getElementById('usernameInput').value = decodeURIComponent(username); } catch { return; }");
fs.writeFileSync('public/scripts.js', s);

// Make all static menu choices keyboard-accessible buttons instead of hidden radios.
const dom = new JSDOM(fs.readFileSync('public/index.html', 'utf8'));
const d = dom.window.document;
for (const label of [...d.querySelectorAll('#menuStore label')]) {
    const input = label.htmlFor ? d.getElementById(label.htmlFor) : null;
    const handler = input?.getAttribute('onclick') || label.getAttribute('onclick');
    if (!handler) continue;
    const button = d.createElement('button');
    button.type = 'button'; button.className = label.className; button.textContent = label.textContent;
    button.setAttribute('onclick', /closeSesion/.test(handler) ? 'closePanel(); closeSesion();' : /Cerrar|Volver/.test(label.textContent) ? 'closePanel()' : handler);
    label.replaceWith(button);
    if (input?.type === 'radio') input.remove();
}
const obsoleteSocket = [...d.scripts].find(el => el.textContent.includes("socket.on('reloadMr'"));
obsoleteSocket.textContent = obsoleteSocket.textContent.replace(/    socket.on\('reloadMr',[\s\S]*?    }\);/, '');
// Defer the client-dependent initializer; a failed socket download is harmless.
obsoleteSocket.textContent = 'if (typeof io === "function") {\n' + obsoleteSocket.textContent + '\n}';
fs.writeFileSync('public/index.html', '<!DOCTYPE html>\n' + d.documentElement.outerHTML + '\n');

const manifest = JSON.parse(fs.readFileSync('public/manifest.json', 'utf8'));
manifest.icons[0] = { src: '/resources/PNG/favicon192.jpg', sizes: '192x192', type: 'image/jpeg' };
fs.writeFileSync('public/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
fs.writeFileSync('public/manifest.webmanifest', JSON.stringify(manifest, null, 2) + '\n');
// Preserve untouched files byte-for-byte (the first conversion normalized line endings).
const cp = require('node:child_process');
for (const name of fs.readdirSync('public').filter(name => name.endsWith('.html'))) {
    const file = 'public/' + name;
    const original = cp.execFileSync('git', ['show', 'HEAD:' + file]);
    if (original.toString().replace(/\r\n/g, '\n') === fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')) fs.writeFileSync(file, original);
}
