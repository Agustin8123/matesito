let users = Object.create(null);
let activeUser = '';
let loginWidgetId;
const accountRequests = new Set();

async function accountUpdate(path, body, onSuccess) {
    if (accountRequests.has(path)) return;
    accountRequests.add(path);
    try {
        const result = await fetch(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(readResponse);
        onSuccess?.(result);
        notify(result.message || 'Cambios guardados.', 'success');
    } catch (error) { notify(error.message, 'error'); }
    finally { accountRequests.delete(path); }
}

function updateUsername() {
    const newUsername = document.getElementById('newUsername').value.trim();
    if (!newUsername || newUsername.length > 25) return notify('Usá un nombre de entre 1 y 25 caracteres.', 'error');
    return accountUpdate('/updateUsername', { currentUsername: activeUser, newUsername }, () => {
        users[newUsername] = users[activeUser]; delete users[activeUser]; activeUser = newUsername;
        document.cookie = 'username=' + encodeURIComponent(newUsername) + '; path=/; SameSite=Lax';
        document.getElementById('newUsername').value = '';
        updateUserButton();
    });
}
function updatePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    if (!currentPassword || !newPassword.trim() || newPassword.length > 128) return notify('Completá ambas contraseñas (hasta 128 caracteres).', 'error');
    return accountUpdate('/updatePassword', { username: activeUser, currentPassword, newPassword }, () => {
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
    });
}
function updateDescription() {
    const description = document.getElementById('userDescription').value.trim();
    if (description.length > 1000) return notify('La descripción puede tener hasta 1.000 caracteres.', 'error');
    return accountUpdate('/updateDescription', { username: activeUser, description }, () => { users[activeUser].description = description; });
}
async function updateProfileImage() {
    const file = document.getElementById('profileImage').files[0];
    if (!file || !file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) return notify('Seleccioná una imagen de hasta 10 MB.', 'error');
    if (accountRequests.has('upload')) return;
    accountRequests.add('upload');
    try {
        const form = new FormData(); form.append('file', file); form.append('upload_preset', 'matesito');
        const uploaded = await fetch('https://api.cloudinary.com/v1_1/dtzl420mq/upload', { method: 'POST', body: form }).then(readResponse);
        if (!uploaded.secure_url) throw new Error('No se pudo subir la imagen.');
        await accountUpdate('/updateProfileImage', { username: activeUser, profileImage: uploaded.secure_url }, () => {
            users[activeUser].profileImage = uploaded.secure_url;
            document.getElementById('profileImage').value = '';
            updateUserButton();
        });
    } catch (error) { notify(error.message, 'error'); }
    finally { accountRequests.delete('upload'); }
}
function togglePassword() { togglePasswordInput('currentPassword', 'togglePasswordButton'); }
function togglePassword1() { togglePasswordInput('newPassword', 'togglePasswordButton'); }
function togglePassword2() { togglePasswordInput('passwordInput1', 'toggleBotonPassword'); }

async function loginUser() {
    const username = document.getElementById('usernameInput').value.trim();
    const password = document.getElementById('passwordInput1').value;
    const token = typeof turnstile !== 'undefined' && loginWidgetId !== undefined ? turnstile.getResponse(loginWidgetId) : '';
    if (!token) return notify('Completá la verificación de seguridad.', 'error');
    if (accountRequests.has('login')) return;
    accountRequests.add('login');
    try {
        const user = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password, token }) }).then(readResponse);
        await activateUser(user.username);
        document.getElementById('passwordInput1').value = '';
    } catch (error) { notify(error.message, 'error'); }
    finally { accountRequests.delete('login'); turnstile.reset(loginWidgetId); }
}
function Acept1() {
    if (typeof turnstile === 'undefined') return notify('La verificación de seguridad todavía no cargó. Intentá de nuevo.', 'error');
    if (loginWidgetId === undefined) loginWidgetId = turnstile.render('#turnstileLogin', { sitekey: '0x4AAAAAACXaLFPU3wAuzN1y' });
    else turnstile.reset(loginWidgetId);
    hideMenus('AvisoOverlay');
    document.getElementById('usernameOverlay').style.display = 'flex';
}
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/session');
        if (response.status === 401) return;
        const user = await readResponse(response);
        await activateUser(user.username);
    } catch (error) { notify(error.message, 'error'); }
});
