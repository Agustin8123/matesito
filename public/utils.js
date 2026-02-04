function toggleVisibility(elementId, displayType = 'block') {
  const element = document.getElementById(elementId);
  if (!element) return;
  const current = element.style.display;
  element.style.display = (current === 'none' || current === '') ? displayType : 'none';
}

function hideMenus(...menuIds) {
  menuIds.forEach(menuId => {
    const el = document.getElementById(menuId);
    if (el) el.style.display = 'none';
  });
}

function toggleMenuExtras() {
            const navMenu = document.getElementById('navMenu');
            navMenu.classList.toggle('open');
        }



function updateUserButton() {
const userButton = document.querySelector('#userButton');

// Usar la imagen del usuario activo, o una predeterminada si no existe
const userImage = users[activeUser] && users[activeUser].profileImage
    ? users[activeUser].profileImage
    : 'resources/SVG/default-avatar.svg'; // Imagen predeterminada

// Configurar el botón con la imagen y el nombre del usuario
userButton.innerHTML = `<img src="${userImage}" alt="${activeUser}" class="profile-pic-img">`;
}


function Acept() {
  const initial = document.getElementById('initialOverlay');
  const aviso = document.getElementById('AvisoOverlay');
  const usernameOverlay = document.getElementById('usernameOverlay');

  if (initial) initial.style.display = 'flex';
  if (aviso) aviso.style.display = 'none';
  if (usernameOverlay) usernameOverlay.style.display = 'flex'; // Ensure username overlay is shown
  
}

// Alterna la visibilidad de un input de contraseña y actualiza el icono del botón
function togglePasswordInput(inputId, toggleButtonId, openIcon = 'resources/PNG/eyeOpen.png', closeIcon = 'resources/PNG/eyeClose.png') {
  const passwordInput = document.getElementById(inputId);
  const toggleButton = document.getElementById(toggleButtonId);
  if (!passwordInput || !toggleButton) return;

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    toggleButton.innerHTML = `<img src="${openIcon}" alt="Ocultar Contraseña">`;
  } else {
    passwordInput.type = 'password';
    toggleButton.innerHTML = `<img src="${closeIcon}" alt="Ver Contraseña">`;
  }
}

// Realiza el POST a /login y devuelve la respuesta JSON
function performLoginCommon(username, password, loginPath = '/login') {
  return fetch(loginPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  }).then(resp => resp.json());
}

function setActiveUser(username) {
    // Usar la función común definida en utils.js
    activateUser(username).catch(error => {
        console.error('Error al activar usuario:', error);
        alert('Error al obtener los detalles del usuario.');
    });
}

// Obtiene detalles del usuario y activa la sesión en la UI
function activateUser(username) {
  return fetch('/getUserDetails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  })
  .then(response => response.json())
  .then(data => {
    if (!data || !data.id) throw new Error('Usuario no encontrado');

    // Guardar detalles del usuario activo
    activeUser = username;
    if (!users[username]) users[username] = {};
    users[username].id = data.id;
    users[username].profileImage = data.profileImage || 'resources/SVG/default-avatar.svg';
    users[username].description = data.description || '';

    // Actualizar UI si los elementos existen
    const userDescriptionEl = document.getElementById('userDescription');
    if (userDescriptionEl) userDescriptionEl.value = users[username].description;

    document.cookie = `userID=${data.id}; path=/;`;

    const appContainer = document.getElementById('appContainer');
    if (appContainer) appContainer.style.display = 'block';

    if (typeof updateUserButton === 'function') updateUserButton();
    if (typeof HideOverlays === 'function') HideOverlays();
    if (typeof loadposts === 'function') loadposts(loadAll);
    if (typeof obtenerNotificaciones === 'function') obtenerNotificaciones();

    return data;
  });
}
document.addEventListener("DOMContentLoaded", function() {
updateUserButton(); 
const profileImageInput = document.getElementById('profileImage');
    const userButton = document.getElementById('userButton');

    if (!profileImageInput || !userButton) return;

    profileImageInput.addEventListener('change', () => {
        const file = profileImageInput.files[0];
        if (!file) return;

        const previewURL = URL.createObjectURL(file);

        userButton.innerHTML = `
            <img src="${previewURL}" alt="${activeUser}" class="profile-pic-img">
        `;
    });
});