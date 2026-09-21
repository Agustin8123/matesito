let users = {};  // Objeto para almacenar los usuarios y contrase
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

let isSortingInProgress = false;
let postsArray = []; // Guardará los posts temporalmente

let loginWidgetId = null;
let registerWidgetId = null;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

function ToggleVisibility(elementId) {
    const element = document.getElementById(elementId);
    element.style.display = 'block';
}

async function closeSesion() {
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
}

// Función para ocultar múltiples menús
function HideMenus(...menuIds) {
    menuIds.forEach(menuId => {
        const menu = document.getElementById(menuId);
        if (menu && menu.style.display !== 'none') {
            menu.style.display = 'none';
        }
    });
}

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

function updateUserButton() {
const userButton = document.querySelector('#userButton');
if (!userButton) return;

// Usar la imagen del usuario activo, o una predeterminada si no existe
const userImage = users[activeUser] && users[activeUser].profileImage
    ? users[activeUser].profileImage
    : 'resources/SVG/default-avatar.svg'; // Imagen predeterminada

// Configurar el botón con la imagen y el nombre del usuario
userButton.replaceChildren();
const image = document.createElement('img');
image.src = userImage;
image.alt = activeUser || 'Usuario';
image.className = 'profile-pic-img';
userButton.appendChild(image);
}

let lastpostContent = "";
const forbiddenWords = ['⣿', 'droga', 'droja', 'dr0ga', 'drogu3', 'drogaa', 'merca', 'falopa', 'cocaína', 'kok4', 'c0ca', 'cocaína', 'marihuana', 'weed', 'hierba', 'porro', 'mota', 'cannabis', '4:20', 'maría', '420', 'hachís', 'thc', 'éxtasis', 'éxt4sis', 'xtc', 'mdma', 'éxtasis', 'lsd', 'ácido', 'trips', 'lsd', 'd.r.o.g.a', 'dro@g@', 'DrOgA', 'dRoJA'];

document.addEventListener("DOMContentLoaded", function() {
document.getElementById('initialOverlay').style.display = 'none';
updateUserButton(); 
});

function reloadPosts(){
    buttonsState();
} 

function reloadFG(){
    loadCreatedGroups();
    loadUserCreatedForums();
    loadUserForums();
    loadUserGroups();
    loadForos();
    loadFollowedUsers();
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
            sitekey: '0x4AAAAAACXaLFPU3wAuzN1y',
            callback: function(token) {
                const rememberMe = document.getElementById('rememberMe').checked;

                if (rememberMe) {
                    loginUser();
                }
            }
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
function loginUser() {
const username = document.getElementById('usernameInput').value.trim();
const password = document.getElementById('passwordInput').value;
const rememberMe = document.getElementById('rememberMe').checked;
const token = typeof turnstile !== 'undefined' && loginWidgetId !== null ? turnstile.getResponse(loginWidgetId) : '';

if (!token) {
    notify("Completa la verificación de seguridad.");
    return;
}

fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, token })
})
.then(readResponse)
.then(data => {
    if (data.username) {
        setActiveUser(data.username); // Función para actualizar el usuario activo
        saveSession(username, rememberMe); // El servidor mantiene el token en una cookie HttpOnly
        document.getElementById('usernameOverlay').style.display = 'none';
        document.getElementById('initialOverlay').style.display = 'none';
    } else {
        notify('Error al iniciar sesión');
        
    }
    if (loginWidgetId !== null) turnstile.reset(loginWidgetId);
})
.catch(error => {
    notify('Error de conexión');
    if (loginWidgetId !== null) turnstile.reset(loginWidgetId);
});
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
        document.getElementById('usernameInput').value = decodeURIComponent(username);
        document.getElementById('rememberMe').checked = true;
    }
}

function showUserSelectOverlay() {
document.getElementById('initialOverlay').style.display = 'flex';
}

function hideUserSelectOverlay() {
document.getElementById('userSelectOverlay').style.display = 'none';
document.querySelector('.header button').style.display = 'block';
}

function addNewUser() {
const usernameInput = document.getElementById('newUsernameInput');
const passwordInput = document.getElementById('newPasswordInput');
const profileImageInput = document.getElementById('newProfileImage');
const username = usernameInput.value.trim();
const password = passwordInput.value;
const token = typeof turnstile !== 'undefined' && registerWidgetId !== null ? turnstile.getResponse(registerWidgetId) : '';

if (!token) {
    notify("Completa la verificación de seguridad.");
    return;
}

// Validar longitud del nombre de usuario
if (username.length > 25) {
    notify('El nombre de usuario no puede tener más de 25 caracteres.');
    return;
}

if (!username || !password) {
    notify('Por favor, introduce un nombre o apodo y contraseña válidos.');
    return;
}

if (!document.getElementById('acceptTermsCheckbox').checked) {
    notify('Debes aceptar los términos y condiciones para continuar.');
    return;
}

let profileImageURL = 'resources/SVG/default-avatar.svg'; // Imagen predeterminada

if (profileImageInput.files && profileImageInput.files[0]) {
    const formData = new FormData();
    formData.append('file', profileImageInput.files[0]);
    formData.append('upload_preset', 'matesito'); // Cambia esto por tu preset en Cloudinary

    fetch('https://api.cloudinary.com/v1_1/dtzl420mq/upload', {
        method: 'POST',
        body: formData,
    })
    .then(readResponse)
    .then(data => {
        profileImageURL = data.secure_url; // URL de la imagen subida
        createUserInDatabase(username, password, profileImageURL, "No hay descripción todavia.", token);
    })
    .catch(error => {
        console.error('Error al subir la imagen:', error);
        notify('No se pudo subir la imagen de perfil. Inténtalo de nuevo.');
    });
} else {
    createUserInDatabase(username, password, profileImageURL, "No hay descripción todavia.", token);
}

usernameInput.value = '';
passwordInput.value = '';
profileImageInput.value = '';
const descriptionInput = document.getElementById('descriptionInput');
if (descriptionInput) descriptionInput.value = '';
}


function createUserInDatabase(username, password, profileImageURL, description, token) {
 const userData = {
        username,
        password,
        profileImage: profileImageURL,
        description: description || null,
        token
    };

    fetch('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
    })
    .then(readResponse)
    .then(data => {
        if (data.id) {
            setActiveUser(username);
        } else {
            notify('error al crear el usuario');
            
        }
        if (registerWidgetId !== null) turnstile.reset(registerWidgetId);

    })
    .catch(error => {
        console.error('Error al crear el usuario:', error);
        notify('Hubo un error al crear el usuario.');
        if (registerWidgetId !== null) turnstile.reset(registerWidgetId);
    });
}


function createForum() {
const forumName = document.getElementById('forumName').value.trim();
const forumDescription = document.getElementById('forumDescription').value.trim();
const ownerId = users[activeUser].id;

if (forumName.length > 30) {
    notify('El nombre del foro no puede tener más de 30 caracteres.');
    return;
}

if (!forumName || !forumDescription || !ownerId) {
    notify("Por favor, completa todos los campos.");
    return;
}

const forumData = {
    name: forumName,
    description: forumDescription,
    ownerId: parseInt(ownerId),
};

fetch('/foros', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(forumData),
})
.then(readResponse)
.then(data => {
    if (data.error) {
        notify(`Error: ${data.error}`); // Manejar error si el foro ya existe
    } else {
        notify(`Foro creado exitosamente: ${data.name}`);
        createForumMenu();
    }
})
.catch(error => {
    notify(`Error: ${error.message}`);
});
}

function createGroup() {
const groupName = document.getElementById('groupName').value.trim();
const groupDescription = document.getElementById('groupDescription').value.trim();
const ownerId = users[activeUser].id;

// Validar longitud del nombre del grupo
if (groupName.length > 30) {
    notify('El nombre del grupo no puede tener más de 30 caracteres.');
    return;
}

// Validar que todos los campos estén completos
if (!groupName || !groupDescription || !ownerId) {
    notify("Por favor, completa todos los campos.");
    return;
}

// Crear el objeto de datos para enviar al backend
const groupData = {
    name: groupName,
    description: groupDescription,
    ownerId: parseInt(ownerId),
};

// Enviar la solicitud al backend
fetch('/grupos', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(groupData),
})
.then(response => {
    if (!response.ok) {
        throw new Error('Error al crear el grupo');
    }
    return response.json();
})
.then(data => {
    // Mostrar un mensaje de éxito y limpiar los campos
    notify(`Grupo creado exitosamente: ${data.name} con código de invitación: ${data.invite_code}`);
    document.getElementById('groupName').value = '';
    document.getElementById('groupDescription').value = '';
    document.getElementById('inviteCode').value = `${data.invite_code}`;
    joinGroup();
    createGroupMenu();
})
.catch(error => {
    notify(`Error: ${error.message}`);
});
}

function joinGroup() {
const inviteCode = document.getElementById('inviteCode').value.trim();
const userId = users[activeUser].id;

if (!inviteCode) {
    notify('Por favor, ingresa un código de invitación.');
    return;
}

fetch('/unir-grupo', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inviteCode, userId }),
})
.then(response => {
    if (!response.ok) {
        return response.json().then(data => { throw new Error(data.error); });
    }
    return response.json();
})
.then(data => {
    notify(data.message);
    // Opcional: redirigir o actualizar la interfaz
})
.catch(error => {
    notify(`Error: ${error.message}`);
});
}

async function leaveGroup(groupId) {
const userId = users[activeUser].id;
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
})
.catch(error => {
    notify(`Error: ${error.message}`);
});
}

function loadForos() {
fetch('/foros')
    .then(readResponse)
    .then(foros => {
        const container = document.getElementById('forosContainer');
        container.innerHTML = '';

        if (foros.length === 0) {
            const noForosMessage = document.createElement('p');
            noForosMessage.textContent = 'No hay nada aquí';
            noForosMessage.style.textAlign = 'center';
            noForosMessage.style.color = 'gray';
            container.appendChild(noForosMessage);
        } else {
            foros.forEach((foro, index) => {
                const uniqueId = `${foro.id}-${index}-${Date.now()}`;
                const foroElement = document.createElement('div');
                foroElement.classList.add('user');

                foroElement.innerHTML = `
                    <label for="label-${uniqueId}" class="boton">${foro.name}</label>
                    <input type="radio" id="label-${uniqueId}" name="nav" style="display:none;" onclick="toggle_ForumMenu('menu-${uniqueId}')">
                    <div id="menu-${uniqueId}" class="dropdown-menu" style="position: absolute; left: 190px; top: -20px;">
                        <h2 style="margin-top: -5px;">${foro.name}</h2>
                        <p style="margin-top: -10px;">${foro.description}</p>
                        <p style="font-size: 0.9em; color: gray;">Creado por: <strong>${foro.ownerName}</strong></p>
                        <label for="view-${uniqueId}" class="boton">Ver Foro</label>
                        <input type="radio" id="view-${uniqueId}" name="nav" style="display:none;" onclick="loadForumPosts(${foro.id})">
                        <label for="follow-${uniqueId}" class="boton">Seguir foro</label>
                        <input type="radio" id="follow-${uniqueId}" name="nav" style="display:none;" onclick="joinForum(${foro.id})">
                        <label for="back-${uniqueId}" class="botonV">Volver</label>
                        <input type="radio" id="back-${uniqueId}" name="nav" style="display:none;" onclick="toggle_ForumMenu('menu-${uniqueId}')">
                    </div>
                `;

                container.appendChild(foroElement);
            });
        }
    })
    .catch(error => {
        console.error('Error al cargar los foros:', error);
        notify("Error al cargar los foros");
    });
}

function joinForum(forumId) {
// Asegúrate de que 'users.id' esté correctamente definido en tu aplicación
const data = {
    userId: users[activeUser].id, // ID del usuario activo
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
    userId: users[activeUser].id, // ID del usuario activo
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

function loadUserForums() {
const userId = users[activeUser].id;

fetch(` /userForums/${userId}`)
    .then(readResponse)
    .then(forums => {
        const container = document.getElementById('forosContainer2');
        container.innerHTML = ''; // Limpiamos el contenedor

        if (forums.length === 0) {
            const noForumsMessage = document.createElement('p');
            noForumsMessage.textContent = 'No hay foros a los que estés unido';
            noForumsMessage.style.textAlign = 'center';
            noForumsMessage.style.color = 'gray';
            container.appendChild(noForumsMessage);
        } else {
            forums.forEach((foro, index) => {
                const uniqueId = `${foro.id}-${index}-${Date.now()}`; // ID único
                const forumElement = document.createElement('div');
                forumElement.classList.add('user');

                forumElement.innerHTML = `
                    <label for="label-${uniqueId}" class="boton">${foro.name}</label>
                    <input type="radio" id="label-${uniqueId}" name="nav" style="display:none;" onclick="toggle_ForumMenu('menu-${uniqueId}')">
                    <div id="menu-${uniqueId}" class="dropdown-menu" style="position: absolute; left: 188px; top: -20px;">
                        <h2 style="margin-top: -5px;">${foro.name}</h2>
                        <p style="margin-top: -10px;">${foro.description}</p>
                        <p style="font-size: 0.9em; color: gray;">Creado por: <strong>${foro.owner_name}</strong></p>
                        <label for="view-${uniqueId}" class="boton">Ver Foro</label>
                        <input type="radio" id="view-${uniqueId}" name="nav" style="display:none;" onclick="loadForumPosts(${foro.id})">
                        <label for="follow-${uniqueId}" class="boton">Dejar foro</label>
                        <input type="radio" id="follow-${uniqueId}" name="nav" style="display:none;" onclick="leaveForum(${foro.id})">
                        <label for="back-${uniqueId}" class="botonV">Volver</label>
                        <input type="radio" id="back-${uniqueId}" name="nav" style="display:none;" onclick="toggle_ForumMenu('menu-${uniqueId}')">
                    </div>
                `;

                container.appendChild(forumElement);
            });
        }
    })
    .catch(error => {
        console.error('Error al cargar los foros del usuario:', error);
        notify('Error al cargar los foros del usuario');
    });
}

function loadUserCreatedForums() {
const userId = users[activeUser].id; // ID del usuario activo

fetch(` /userCreatedForums/${userId}`)
    .then(readResponse)
    .then(forums => {
        const container = document.getElementById('createdForosContainer');
        container.innerHTML = ''; // Limpiamos el contenedor

        if (forums.length === 0) {
            const noForumsMessage = document.createElement('p');
            noForumsMessage.textContent = 'No has creado ningún foro';
            noForumsMessage.style.textAlign = 'center';
            noForumsMessage.style.color = 'gray';
            container.appendChild(noForumsMessage);
        } else {
            forums.forEach((foro, index) => {
                const uniqueId = `${foro.id}-${index}-${Date.now()}`; // ID único
                const forumElement = document.createElement('div');
                forumElement.classList.add('user');

                forumElement.innerHTML = `
                    <label for="label-${uniqueId}" class="boton">${foro.name}</label>
                    <input type="radio" id="label-${uniqueId}" name="nav" style="display:none;" onclick="toggle_ForumMenu('menu-${uniqueId}')">
                    <div id="menu-${uniqueId}" class="dropdown-menu" style="position: absolute; left: 188px; top: -20px;">
                        <h2 style="margin-top: -5px;">${foro.name}</h2>
                        <p style="margin-top: -10px;">${foro.description}</p>
                        <label for="view-${uniqueId}" class="boton">Ver Foro</label>
                        <input type="radio" id="view-${uniqueId}" name="nav" style="display:none;" onclick="loadForumPosts(${foro.id})">
                        <label for="delete-${uniqueId}" class="boton">Eliminar Foro</label>
                        <input type="radio" id="delete-${uniqueId}" name="nav" style="display:none;" onclick="deleteForum(${foro.id})">
                        <label for="back-${uniqueId}" class="botonV">Volver</label>
                        <input type="radio" id="back-${uniqueId}" name="nav" style="display:none;" onclick="toggle_ForumMenu('menu-${uniqueId}')">
                    </div>
                `;

                container.appendChild(forumElement);
            });
        }
    })
    .catch(error => {
        console.error('Error al cargar los foros creados por el usuario:', error);
        notify('Error al cargar los foros creados por el usuario');
    });
}
async function deleteForum(forumId) {
const userId = users[activeUser].id; // ID del usuario activo

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
    if (label) label.textContent = fileName || 'Seleccionar archivo';
    button.title = fileName || 'Seleccionar archivo';
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
function postpost() { return publishContent('post'); }

function goBackToInitial() {
document.getElementById('usernameOverlay').style.display = 'none';
document.getElementById('userSelectOverlay').style.display = 'none';

document.getElementById('initialOverlay').style.display = 'flex';
if (registerWidgetId !== null) turnstile.reset(registerWidgetId);
if (loginWidgetId !== null) turnstile.reset(loginWidgetId);
}

let showSensitiveContent = false;

function reloadFPosts() {
    if (activeForum != '') {
        loadForumPosts(activeForum, loadAll);
    }
}

function reloadGPosts() {
    if (activeGroup != '') {
        loadGroupMessages(activeGroup, loadAll);
    }
}

function reloadCPosts() {
    if (activeChat != '') {
        loadChatMessages(activeChat, loadAll);
    }
}

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

function togglePostLoad() {
loadAll = !loadAll; // Alternar estado
const button = document.getElementById('loadAllPostsButton');

// Cambiar texto del botón basado en el estado
button.textContent = loadAll ? 'últimos 12 posts' : 'Todos los posts';

// Llamar a buttonsState para recargar los posts según el estado actual
buttonsState();
}

let feedRequest = 0;

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
}

function createOrLoadChat(user2Id) {
    document.getElementById('profileHeader').style.display = 'none';
    document.getElementById('postBox').style.display = 'block';
const user1Id = users[activeUser].id;

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
    return loadFeed('/group/messages/' + id + '/' + users[activeUser].id, 'groupMessageList', all, true);
}

function loadForumPosts(id, all) {
    activeChat = ''; activeGroup = ''; activeForum = id;
    document.getElementById('profileHeader').style.display = 'none';
    document.getElementById('postBox').style.display = 'block';
    return loadFeed('/mensajes/' + id, 'forumList', all, true);
}

function toggleOrden(button) {
    invertirOrden = !invertirOrden;

    if (ordenarReacciones) {
        button.textContent = invertirOrden ? 'Más reacciones abajo' : 'Más reacciones arriba';
    } else {
        button.textContent = invertirOrden ? 'Más nuevos abajo' : 'Más nuevos arriba';
    }

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
    if (ordenButton) {
        ordenButton.textContent = ordenarReacciones
            ? (invertirOrden ? 'Más reacciones abajo' : 'Más reacciones arriba')
            : (invertirOrden ? 'Más nuevos abajo' : 'Más nuevos arriba');
    }

    // Actualizar el texto del botón que alterna ordenar por reacciones
    button.textContent = ordenarReacciones ? 'Ordenado por reacciones' : 'Ordenar por reacciones';

    reloadPosts(); // Volver a cargar los posts aplicando la nueva configuración
}

async function cargarTotalesDeReacciones() {
    try {
        const response = await fetch('/api/reactions/totals');
        return await readResponse(response);
    } catch (error) {
        console.error('Error al cargar los totales de reacciones:', error);
        return {};
    }
}

function addpostToList(content, media, mediaType, username, profilePicture, sensitive, created_at, userId, postId, listId, invertirOrden, esUltimoPost) {
    const postList = document.getElementById(listId);
    if (!postList) {
        console.error(`No se encontró el contenedor con id "${listId}".`);
        return;
    }

    const newpost = document.createElement('li');
    newpost.className = 'post';
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
                <img src="${escapeHTML(media)}" alt="Imagen subida por ${escapeHTML(username)}" class="preview-media clickable">
                <button class="fullscreen-btn" onclick="openFullscreen(this.previousElementSibling)">⛶</button>
            </div>`; 
        } else if (mediaType.startsWith('video/')) {
            mediaHTML = `<div>
                            <video controls class="preview-media clickable">
                                <source src="${escapeHTML(media)}" type="${escapeHTML(mediaType)}">
                                Tu navegador no soporta la reproducción de video.
                            </video>
                        </div>`;
        } else if (mediaType.startsWith('audio/')) {
            mediaHTML = `<div>
                            <audio controls class="preview-media clickable">
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
                    ${escapeHTML(content)}
                    ${mediaHTML}
                </div>
            </div>`
            : `<div class="post-content clickable">
            <div class="post-text">${escapeHTML(content)}</div>
            ${mediaHTML}
        </div>`;

    const uniqueId = `userProfileBox_${userId}_${Math.random().toString(36).substr(2, 9)}`;
    const microReactId = `post-${postId}`;

    // HTML del post
     newpost.innerHTML = `
        <div class="post-header">
            <div class="post-user-info">
                <span class="username" onclick="toggleUserProfileBox('${uniqueId}')">
                ${profilePicHTML}
                <span class="username-text">${escapeHTML(username)}</span>
            </span>
                <span class="post-time">${localTime}</span>
            </div>
        </div>
        <div class="user-profile-box" id="${uniqueId}" style="display:none; margin-bottom: 8px">
            <button onclick="viewProfile(${escapeHTML(JSON.stringify(String(username)))})">Ver perfil</button>
            <button onclick="followUser(${userId})">Seguir</button>
        </div>
        ${contentHTML}
        <button class="toggle-reactions" onclick="toggleReactions('${microReactId}')">💬 Reacciones</button>
        <div id="reactions-${microReactId}" 
            style="opacity: 0; display: none; transition: opacity 0.3s ease; width: 100%; align-items: center; justify-content: center; margin-top: 10px;"
            data-loaded="false">
            <iframe 
                src="/microReact.html?id=Matesito_${microReactId}" 
                style="width: 275px; height: 100px; border: none;" 
                frameborder="0" 
                loading="lazy" 
                title="Deja una reacción">
            </iframe>
        </div>
    `;

    postList.appendChild(newpost);
}

function toggleReactions(postId) {
    const reactionsContainer = document.getElementById(`reactions-${postId}`);

    if (reactionsContainer) {
        if (reactionsContainer.dataset.loaded === "false") {
            // Primera vez que se muestra
            reactionsContainer.style.display = "flex"; // Se hace visible
            setTimeout(() => {
                reactionsContainer.style.opacity = "1"; // Se muestra suavemente
            }, 50);
            reactionsContainer.dataset.loaded = "true"; // Marcamos como cargado
        } else {
            // Alternar visibilidad
            if (reactionsContainer.style.opacity === "0") {
                reactionsContainer.style.display = "flex"; 
                setTimeout(() => {
                    reactionsContainer.style.opacity = "1";
                }, 50);
            } else {
                reactionsContainer.style.opacity = "0";
                setTimeout(() => {
                    reactionsContainer.style.display = "none";
                }, 300); // Esperamos la transición antes de ocultarlo
            }
        }
    }
}

// Mostrar u ocultar el cuadro de perfil cuando se hace clic en el nombre de usuario
function toggleUserProfileBox(uniqueId) {
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
const followerId = users[activeUser].id; // El ID del usuario que está siguiendo

if (!followerId) {
    notify('Error: Usuario activo no encontrado');
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
    }
})
.catch(error => {
    console.error('Error al dejar de seguir:', error);
    notify('Error al dejar de seguir al usuario');
});
}

function loadFollowedUsers() {
const followerId = users[activeUser]?.id; // ID del usuario activo

fetch(` /followedUsers/${followerId}`)
    .then(readResponse)
    .then(users => {
        const container = document.getElementById('usersContainer');
        container.innerHTML = ''; // Limpiamos el contenedor

        if (users.length === 0) {
            // Si no hay usuarios seguidos, mostramos un mensaje
            const noUsersMessage = document.createElement('p');
            noUsersMessage.textContent = 'No sigues a ningún usuario';
            noUsersMessage.style.textAlign = 'center';
            noUsersMessage.style.color = 'gray';
            container.appendChild(noUsersMessage);
        } else {
            // Renderizamos los usuarios seguidos
            users.forEach(user => {
                const userElement = document.createElement('div');
                userElement.classList.add('user');

                const Id = user.id;
                const username = user.username;

                userElement.innerHTML = `
                <label for="${username}" class="boton">${user.username}</label>
                <input type="radio" id="${username}" name="nav" style="display:none;" onclick="toggle_UserMenu(${Id})">
                <div id="${Id}" class="dropdown-menu" style="position: absolute; left: 188px; top: -20px;">
                    <label for="${username}${Id}" class="boton">Ver perfil</label>
                    <input type="radio" id="${username}${Id}" name="nav" style="display:none;" onclick="viewProfile('${username}')">
                    <label for="${Id}${username}${Id}" class="boton">Dejar de seguir</label>
                    <input type="radio" id="${Id}${username}${Id}" name="nav" style="display:none;" onclick="unfollowUser(${followerId}, ${Id})">
                    <label for="${Id}${Id}" class="boton">Chat privado</label>
                    <input type="radio" id="${Id}${Id}" name="nav" style="display:none;" onclick="createOrLoadChat(${Id})">
                    

                    <label for="${Id}${username}" class="botonV">Volver</label>
                    <input type="radio" id="${Id}${username}" name="nav" style="display:none;" onclick="toggle_UserMenu(${Id})">
                </div>
                `;

                container.appendChild(userElement);
            });
        }
    })
    .catch(error => {
        console.error('Error al cargar los usuarios seguidos:', error);
        notify('Error al cargar los usuarios seguidos');
    });
}

function loadUserGroups() {
const userId = users[activeUser]?.id; // ID del usuario activo

fetch(` /grupos-usuario/${userId}`)
.then(readResponse)
.then(groups => {
    const container = document.getElementById('joinedGruposContainer');
    const container1 = document.getElementById('createdGroupsContainer');
    container.innerHTML = ''; // Limpiamos el contenedor
    container1.innerHTML = '';

    if (groups.length === 0) {
        const noGroupsMessage = document.createElement('p');
        noGroupsMessage.textContent = 'No perteneces a ningún grupo';
        noGroupsMessage.style.textAlign = 'center';
        noGroupsMessage.style.color = 'gray';
        container.appendChild(noGroupsMessage);
    } else {
        groups.forEach(group => {
            const groupElement = document.createElement('div');
            groupElement.classList.add('group');

            const groupId = group.id;
            const groupName = group.name;
            const ownerName = group.owner_name; // Aquí tomamos el nombre del dueño que ya viene del backend

            groupElement.innerHTML = `
            <label for="radio-${groupId}" class="boton">${groupName}</label>
            <input type="radio" id="radio-${groupId}" name="nav" style="display:none;" onclick="toggle_GroupMenu('menu-${groupId}')">

            <div id="menu-${groupId}" class="dropdown-menu" style="position: absolute; left: 188px; top: -20px; display: none;">
                <label for="dDetailS-${groupId}" class="boton">Ver detalles</label>
                <input type="radio" id="dDetailS-${groupId}" name="nav" style="display:none;" onclick="toggleDetails('details-${groupId}', ${groupId})">
                
                <div id="details-${groupId}" style="display: none;">
                    <div id="GroupDetailsContainer-${groupId}">
                        
                    </div>
                </div>

                <label for="enter-${groupId}" class="boton">Entrar al chat</label>
                <input type="radio" id="enter-${groupId}" name="nav" style="display:none;" onclick="loadGroupMessages(${groupId})">

                <label for="leave-${groupId}" class="boton">Salir del grupo</label>
                <input type="radio" id="leave-${groupId}" name="nav" style="display:none;" onclick="leaveGroup(${groupId})">

                <p style="font-size: 12px; color: gray;">Creado por: ${ownerName}</p>
                <label for="close-${groupId}" class="botonV">Volver</label>
                <input type="radio" id="close-${groupId}" name="nav" style="display:none;" onclick="toggle_GroupMenu('menu-${groupId}')">
            </div>
            `;

            container.appendChild(groupElement);
        });
    }
})
.catch(error => {
    console.error('Error al cargar los grupos del usuario:', error);
    notify('Error al cargar los grupos del usuario');
});
}

function loadCreatedGroups() {
const userId = users[activeUser]?.id; // ID del usuario activo

fetch(` /grupos-creados/${userId}`)
    .then(readResponse)
    .then(groups => {
        const container = document.getElementById('createdGroupsContainer');
        const container1 = document.getElementById('joinedGruposContainer');
        container.innerHTML = ''; // Limpiamos el contenedor
        container1.innerHTML = '';

        if (groups.length === 0) {
            const noGroupsMessage = document.createElement('p');
            noGroupsMessage.textContent = 'No has creado ningún grupo';
            noGroupsMessage.style.textAlign = 'center';
            noGroupsMessage.style.color = 'gray';
            container.appendChild(noGroupsMessage);
        } else {
            groups.forEach(group => {
                const groupElement = document.createElement('div');
                groupElement.classList.add('group');

                const groupId = group.id;

                groupElement.innerHTML = `
                <label for="radio-${groupId}" class="boton">${group.name}</label>
                <input type="radio" id="radio-${groupId}" name="nav" style="display:none;" onclick="toggle_GroupMenu('menu-${groupId}')">

                <div id="menu-${groupId}" class="dropdown-menu" style="position: absolute; left: 188px; top: -20px; display: none;">
                    <label for="details-${groupId}b" class="boton">Ver detalles</label>
                    <input type="radio" id="details-${groupId}b" name="nav" style="display:none;" onclick="toggleDetails('detailss-${groupId}', ${groupId})">
                    
                    <div id="detailss-${groupId}" style="display: none;">
                        <div id="GroupDetailsContainer-${groupId}">
                            <!-- Los detalles del grupo se cargarán aquí -->
                        </div>
                    </div>

                    <label for="enter-${groupId}" class="boton">Entrar al chat</label>
                    <input type="radio" id="enter-${groupId}" name="nav" style="display:none;" onclick="loadGroupMessages(${groupId})">

                    <label for="delete-${groupId}" class="boton">Eliminar grupo</label>
                    <input type="radio" id="delete-${groupId}" name="nav" style="display:none;" onclick="deleteGroup(${groupId})">

                    <label for="close-${groupId}" class="botonV">Volver</label>
                    <input type="radio" id="close-${groupId}" name="nav" style="display:none;" onclick="toggle_GroupMenu('menu-${groupId}')">
                </div>
                `;

                container.appendChild(groupElement);
            });
        }
    })
    .catch(error => {
        console.error('Error al cargar los grupos creados:', error);
        notify('Error al cargar los grupos creados');
    });
}

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


async function obtenerNotificaciones() {
const user = users[activeUser];
const contenedor = document.getElementById('renderNotif');
if (!user || !user.id || !contenedor) return;
const userId = user.id;

try {
    const response = await fetch(`/notificaciones/${userId}`, { credentials: 'same-origin' });
    const payload = await response.json();
    if (!response.ok) {
        if (response.status === 401 || response.status === 403) return;
        throw new Error(payload.error || 'No se pudieron obtener las notificaciones');
    }
    const notificaciones = Array.isArray(payload) ? payload : [];

    renderizarNotificaciones(notificaciones);
    actualizarIndicadorNotificaciones(notificaciones.length > 0);
} catch (error) {
    console.error('Error al obtener notificaciones:', error);
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
    const notiElemento = document.createElement('div');
    notiElemento.classList.add('Nboton');

    let mensaje = '';
    let idNotificacionLeida = false;

    // Verificar si el chat_or_group_id corresponde a alguno de los activos
    if (noti.chat_or_group_id === activeForum || noti.chat_or_group_id === activeChat || noti.chat_or_group_id === activeGroup) {
        idNotificacionLeida = true; // Marcar como leída automáticamente
    }

    const nombre = noti.nombre;
    const chat_or_group_id = noti.chat_or_group_id;

    if (noti.tipo === 'mensaje') {
        mensaje = `Tienes un nuevo mensaje de ${nombre}`;
        notiElemento.addEventListener('click', () => {
            const numericId = parseInt(String(chat_or_group_id).split('-')[1], 10);
            if (Number.isFinite(numericId)) createOrLoadChat(numericId);
        });
    } else if (noti.tipo === 'grupo') {
        mensaje = `Tienes nuevos mensajes del grupo ${nombre}`;
        notiElemento.addEventListener('click', () => loadGroupMessages(chat_or_group_id, loadAll));
    } else if (noti.tipo === 'foro') {
        mensaje = `Hay una nueva publicación en el foro ${nombre}`;
        notiElemento.addEventListener('click', () => loadForumPosts(chat_or_group_id, loadAll));
    } else {
        mensaje = `Tienes un notiicación que no existe, felicidades`;
    }

    notiElemento.textContent = mensaje;
    notiElemento.dataset.id = noti.referencia_id;

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


function searchMotor() {
const searchInput = document.getElementById('searchInput');
const searchContainer = document.getElementById('searchconteiner');
if (!searchInput || !searchContainer) return;
const query = searchInput.value;

// Si el campo está vacío, limpiar y salir
if (query.trim().length < 1) { 
    searchContainer.innerHTML = ''; // Limpiar resultados
    return; // Detener la ejecución
}

fetch(`/search?query=${encodeURIComponent(query.trim())}`)
    .then(readResponse)
    .then(data => {
        searchContainer.innerHTML = ''; // Limpiar resultados previos

        if (data.foros.length === 0 && data.usuarios.length === 0) {
            searchContainer.innerHTML = '<p>No se encontraron resultados.</p>';
        }

        // Mostrar foros
        data.foros.forEach(foro => {
            const foroElement = document.createElement('div');
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
            const userElement = document.createElement('div');
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
        console.error('Error al buscar:', error);
        notify('Error al procesar la búsqueda');
    });
}

async function init() {
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
}

function scrollPosts() {
    let containers = document.querySelectorAll(".posts");
    containers.forEach(container => {
        container.scrollTop = invertirOrden ? container.scrollHeight : 0;
    });
}

//al cargar página
window.onload = function() {
verMant(mantenimiento);
init();
};
