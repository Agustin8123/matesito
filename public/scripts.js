
let users = {};  // Objeto para almacenar los usuarios y contrase
let activeUser = '';  // Variable para el usuario activo
let activeForum = '';
let activeChat = '';
let activeGroup = '';

const forumList = 'forumList';
const postList = 'postList';
const messageList = 'messageList';
const groupMessageList = 'groupMessageList';
const profileList = 'profileList';
const unicPostList = 'unicPostList';  

let mantenimiento = false;

let selectedFile = null;
let loadAll = false;
let invertirOrden = true;
let ordenarReacciones = false;
let postsArray = []; // Guardará los posts temporalmente

function ToggleVisibility(elementId) {
    const element = document.getElementById(elementId);
    element.style.display = 'block';
}

function closeSesion() {
    users = {};
    activeUser = '';

    updateUserButton();
    document.cookie = `username=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    document.cookie = `password=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
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

function toggleVisibility(elementId, displayType = 'block') {
    const element = document.getElementById(elementId);
    if (element) {
        // Alternar entre 'block' y 'none'
        element.style.display = (element.style.display === displayType) ? 'none' : displayType;
    } else {
        console.error(`No se encontró el elemento con id "${elementId}".`);
    }
}

function hideMenus(...menuIds) {
    menuIds.forEach(menuId => {
        const menu = document.getElementById(menuId);
        if (menu && menu.style.display !== 'none') {
            menu.style.display = 'none';
        }
    });
}

  function showOnlyMenu(menuIdToShow, ...allMenuIds) {
    HideMenus(...allMenuIds);
    ToggleVisibility(menuIdToShow, 'block');
}


let lastpostContent = "";
const forbiddenWords = ['⣿', 'droga', 'droja', 'dr0ga', 'drogu3', 'drogaa', 'merca', 'falopa', 'cocaína', 'kok4', 'c0ca', 'cocaína', 'marihuana', 'weed', 'hierba', 'porro', 'mota', 'cannabis', '4:20', 'maría', '420', 'hachís', 'thc', 'éxtasis', 'éxt4sis', 'xtc', 'mdma', 'éxtasis', 'lsd', 'ácido', 'trips', 'lsd', 'd.r.o.g.a', 'dro@g@', 'DrOgA', 'dRoJA'];

document.addEventListener("DOMContentLoaded", function() {
updateUserButton();  // Llama a la función para cargar la imagen por defecto cuando la página se haya cargado
document.getElementById('initialOverlay').style.display = 'none';
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

window.onload = function() {
document.getElementById('initialOverlay').style.display = 'none';
document.getElementById('AvisoOverlay').style.display = 'flex';
document.getElementById('appContainer').style.display = 'none';
document.getElementById('usernameOverlay').style.display = 'none';
}

function verMant(valor) {
if (valor === true) {
    window.location.href = 'mantenimiento.html';
}
}

  function togglePassword() {
    const passwordInput = document.getElementById('newPasswordInput');
    const toggleButton = document.getElementById('togglePasswordButton');

    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        toggleButton.innerHTML = '<img src="eyeOpen.png" alt="Ocultar Contraseña">';
    } else {
        passwordInput.type = "password";
        toggleButton.innerHTML = '<img src="eyeClose.png" alt="Ver Contraseña">';
    }
}

  function togglePassword1() {
    const passwordInput = document.getElementById('passwordInput');
    const toggleButton = document.getElementById('togglePasswordBoton');

    if (passwordInput.type === "password") {
        passwordInput.type = "text";
        toggleButton.innerHTML = '<img src="eyeOpen.png" alt="Ocultar Contraseña">';
    } else {
        passwordInput.type = "password";
        toggleButton.innerHTML = '<img src="eyeClose.png" alt="Ver Contraseña">';
    }
}

function useExistingUser() {
document.getElementById('initialOverlay').style.display = 'none';
document.getElementById('usernameOverlay').style.display = 'flex';
}

function createNewUser() {
document.getElementById('initialOverlay').style.display = 'none';
document.getElementById('userSelectOverlay').style.display = 'flex';
document.querySelector('.header button').style.display = 'none'; // Ocultar el botón de selección de usuario
}

function encodePassword(password) {
return btoa(password); // Convierte a Base64
}

// Función para decodificar la contraseña de Base64
function decodePassword(encodedPassword) {
return atob(encodedPassword);
}

function saveSession(username, password, rememberMe) {
if (rememberMe) {
    let expirationDate = new Date();
    expirationDate.setTime(expirationDate.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 días

    document.cookie = `username=${username}; expires=${expirationDate.toUTCString()}; path=/; SameSite=Lax`;
    document.cookie = `password=${encodePassword(password)}; expires=${expirationDate.toUTCString()}; path=/; SameSite=Lax`;
} else {
    document.cookie = `username=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    document.cookie = `password=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}
}

// Función de login
function loginUser() {
const username = document.getElementById('usernameInput').value.trim();
const password = document.getElementById('passwordInput').value.trim();
const rememberMe = document.getElementById('rememberMe').checked;

fetch(' /login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
})
.then(response => response.json())
.then(data => {
    if (data.username) {
        setActiveUser(data.username); // Función para actualizar el usuario activo
        saveSession(username, password, rememberMe); // Guardar sesión si "Recordar mi sesión" está marcado
    } else {
        alert('Error al iniciar sesión');
    }
})
.catch(error => {
    alert('Error de conexión');
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
const encodedPassword = getCookie('password');

if (username && encodedPassword) {
    document.getElementById('usernameInput').value = username;
    document.getElementById('passwordInput').value = decodePassword(encodedPassword);
    document.getElementById('rememberMe').checked = true;

    loginUser();
    document.getElementById('AvisoOverlay').style.display = 'none';

    document.getElementById('initialOverlay').style.display = 'none';
}
}

function HideOverlays(){
document.getElementById('initialOverlay').style.display = 'none';
document.getElementById('userSelectOverlay').style.display = 'none';
document.getElementById('usernameOverlay').style.display = 'none'; 
}

function updateUserButton() {
const userButton = document.querySelector('#userButton');

// Usar la imagen del usuario activo, o una predeterminada si no existe
const userImage = users[activeUser] && users[activeUser].profileImage
    ? users[activeUser].profileImage
    : 'default-avatar.png'; // Imagen predeterminada

// Configurar el botón con la imagen y el nombre del usuario
userButton.innerHTML = `<img src="${userImage}" alt="${activeUser}" class="profile-pic-img">`;
}


function setActiveUser(username) {
fetch(' /getUserDetails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
})
.then(response => response.json())
.then(data => {
    if (data.id) {
        // Guardar detalles del usuario activo
        activeUser = username;
        if (!users[username]) {
            users[username] = {}; // Asegurarse de que el usuario exista en la estructura
        }

        // Guardar el ID del usuario
        users[username].id = data.id;

        // Guardar la imagen de perfil (o usar una por defecto)
        users[username].profileImage = data.profileImage || 'default-avatar.png'; 

        // Actualizar la UI
        hideUserSelectOverlay();
        document.getElementById('appContainer').style.display = 'block';
        updateUserButton();
        HideOverlays();
        loadposts(loadAll);
        obtenerNotificaciones();
    } else {
        alert("Usuario no encontrado.");
    }
})
.catch(error => {
    console.error("Error al obtener los detalles del usuario:", error);
    alert("Error al obtener los detalles del usuario.");
});
}



function showUserSelectOverlay() {
document.getElementById('initialOverlay').style.display = 'flex';
}

function hideUserSelectOverlay() {
document.getElementById('userSelectOverlay').style.display = 'none';
document.querySelector('.header button').style.display = 'block'; // Mostrar el botón de selección de usuario nuevamente
}

function addNewUser() {
const usernameInput = document.getElementById('newUsernameInput');
const passwordInput = document.getElementById('newPasswordInput');
const profileImageInput = document.getElementById('newProfileImage');
const username = usernameInput.value.trim();
const password = passwordInput.value.trim();

// Validar longitud del nombre de usuario
if (username.length > 25) {
    alert('El nombre de usuario no puede tener más de 30 caracteres.');
    return;
}

if (!username || !password) {
    alert('Por favor, introduce un nombre o apodo y contraseña válidos.');
    return;
}

if (!document.getElementById('acceptTermsCheckbox').checked) {
    alert('Debes aceptar los términos y condiciones para continuar.');
    return;
}

let profileImageURL = 'default-avatar.png'; // Imagen predeterminada

if (profileImageInput.files && profileImageInput.files[0]) {
    const formData = new FormData();
    formData.append('file', profileImageInput.files[0]);
    formData.append('upload_preset', 'matesito'); // Cambia esto por tu preset en Cloudinary

    fetch('https://api.cloudinary.com/v1_1/dtzl420mq/upload', {
        method: 'POST',
        body: formData,
    })
    .then(response => response.json())
    .then(data => {
        profileImageURL = data.secure_url; // URL de la imagen subida
        createUserInDatabase(username, password, profileImageURL);
    })
    .catch(error => {
        console.error('Error al subir la imagen:', error);
        alert('No se pudo subir la imagen de perfil. Inténtalo de nuevo.');
    });
} else {
    createUserInDatabase(username, password, profileImageURL);
}

usernameInput.value = '';
passwordInput.value = '';
profileImageInput.value = ''; // Deseleccionar el archivo
}


function createUserInDatabase(username, password, profileImageURL) {
const userData = {
    username,
    password,
    profileImage: profileImageURL,
};

fetch(' /users', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
})
.then(response => response.json())
.then(data => {
    if (data.id) {
        setActiveUser(username); // Establecer al nuevo usuario como activo
    } else {
        alert('error al crear el usuario');
    }
})
.catch(error => {
    console.error('Error al crear el usuario:', error);
    alert('Hubo un error al crear el usuario.');
});
}

function createForum() {
const forumName = document.getElementById('forumName').value.trim();
const forumDescription = document.getElementById('forumDescription').value.trim();
const ownerId = users[activeUser].id;

if (forumName.length > 30) {
    alert('El nombre del foro no puede tener más de 30 caracteres.');
    return;
}

if (!forumName || !forumDescription || !ownerId) {
    alert("Por favor, completa todos los campos.");
    return;
}

const forumData = {
    name: forumName,
    description: forumDescription,
    ownerId: parseInt(ownerId),
};

fetch(' /foros', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(forumData),
})
.then(response => response.json())
.then(data => {
    if (data.error) {
        alert(`Error: ${data.error}`); // Manejar error si el foro ya existe
    } else {
        alert(`Foro creado exitosamente: ${data.name}`);
        createForumMenu();
    }
})
.catch(error => {
    alert(`Error: ${error.message}`);
});
}

function createGroup() {
const groupName = document.getElementById('groupName').value.trim();
const groupDescription = document.getElementById('groupDescription').value.trim();
const ownerId = users[activeUser].id;

// Validar longitud del nombre del grupo
if (groupName.length > 30) {
    alert('El nombre del grupo no puede tener más de 30 caracteres.');
    return;
}

// Validar que todos los campos estén completos
if (!groupName || !groupDescription || !ownerId) {
    alert("Por favor, completa todos los campos.");
    return;
}

// Crear el objeto de datos para enviar al backend
const groupData = {
    name: groupName,
    description: groupDescription,
    ownerId: parseInt(ownerId),
};

// Enviar la solicitud al backend
fetch(' /grupos', {
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
    alert(`Grupo creado exitosamente: ${data.name} con código de invitación: ${data.invite_code}`);
    document.getElementById('groupName').value = '';
    document.getElementById('groupDescription').value = '';
    document.getElementById('inviteCode').value = `${data.invite_code}`;
    joinGroup();
    createGroupMenu();
})
.catch(error => {
    alert(`Error: ${error.message}`);
});
}

function joinGroup() {
const inviteCode = document.getElementById('inviteCode').value.trim();
const userId = users[activeUser].id;

if (!inviteCode) {
    alert('Por favor, ingresa un código de invitación.');
    return;
}

fetch(' /unir-grupo', {
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
    alert(data.message);
    // Opcional: redirigir o actualizar la interfaz
})
.catch(error => {
    alert(`Error: ${error.message}`);
});
}

function leaveGroup(groupId) {
const userId = users[activeUser].id;
if (!confirm('¿Estás seguro de que deseas salir del grupo?')) {
    return; // Si el usuario cancela, no hacemos nada
}

fetch(' /salir-grupo', {
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
    alert(data.message);
})
.catch(error => {
    alert(`Error: ${error.message}`);
});
}

function loadForos() {
fetch('/foros')
    .then(response => response.json())
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
        alert("Error al cargar los foros");
    });
}

function joinForum(forumId) {
// Asegúrate de que 'users.id' esté correctamente definido en tu aplicación
const data = {
    userId: users[activeUser].id, // ID del usuario activo
    forumId: forumId  // ID del foro que se pasa como parámetro
};

fetch(' /joinForum', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
})
.then(response => response.json())
.then(data => {
    if (data.message) {
        alert(data.message); // Muestra el mensaje recibido desde el backend
    } else {
        alert('Error desconocido al procesar la solicitud'); // Mensaje por defecto si no hay mensaje
    }
})
.catch((error) => {
    console.error('Error:', error);
    alert('Error al procesar la solicitud'); // Mensaje de error general
});
}

function leaveForum(forumId) {
// Asegúrate de que 'users.id' esté correctamente definido en tu aplicación
const data = {
    userId: users[activeUser].id, // ID del usuario activo
    forumId: forumId  // ID del foro que se pasa como parámetro
};

fetch(' /leaveForum', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
})
.then(response => response.json())
.then(data => {
    if (data.message) {
        alert(data.message); // Muestra el mensaje recibido desde el backend
    } else {
        alert('Error desconocido al procesar la solicitud'); // Mensaje por defecto si no hay mensaje
    }
})
.catch((error) => {
    console.error('Error:', error);
    alert('Error al procesar la solicitud'); // Mensaje de error general
});
}

function loadUserForums() {
const userId = users[activeUser].id;

fetch(` /userForums/${userId}`)
    .then(response => response.json())
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
        alert('Error al cargar los foros del usuario');
    });
}

function loadUserCreatedForums() {
const userId = users[activeUser].id; // ID del usuario activo

fetch(` /userCreatedForums/${userId}`)
    .then(response => response.json())
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
        alert('Error al cargar los foros creados por el usuario');
    });
}
function deleteForum(forumId) {
const userId = users[activeUser].id; // ID del usuario activo

// Confirmar la eliminación
const confirmDelete = confirm('¿Estás seguro de que deseas eliminar este foro?');
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
    alert(data); // Mensaje de éxito del backend
    loadUserCreatedForums(); // Actualiza la lista de foros creados
})
.catch(error => {
    console.error('Error al eliminar el foro:', error);
    alert(error.message || 'Error al eliminar el foro');
});
}

function containsForbiddenWords(message) {
    return forbiddenWords.some(word => message.toLowerCase().includes(word.toLowerCase()));
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
            alert("Por favor, selecciona un archivo de tipo imagen, audio o video.");
            selectedFile = null;
            event.target.value = ''; // Restablecer la selección
            return;
        }

        // Validar tamaño de archivo
        if (
            (fileCategory === 'image' || fileCategory === 'audio') && fileSize > 10 * 1024 * 1024 ||
            fileCategory === 'video' && fileSize > 20 * 1024 * 1024
        ) {
            alert("El archivo seleccionado excede el tamaño máximo permitido.");
            selectedFile = null;
            event.target.value = ''; // Restablecer la selección
            return;
        }
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
        alert("No puedes publicar un mensaje aquí");
    }
}


let lastMessageContent = '';  // Definir una variable global fuera de la función para almacenar el contenido del último mensaje

async function sendForumMessage(forumId) {
    const content = document.getElementById('postContent').value;
    const isSensitive = document.getElementById('sensitiveContentCheckbox')?.checked || false;
    const fileInput = document.getElementById('postMedia');
    const file = fileInput?.files?.[0];

    // Validar contenido prohibido
    if (containsForbiddenWords(content)) {
        alert("Creemos que tu mensaje infringe nuestros términos y condiciones. Si crees que es un error, contacta con soporte.");
        return;
    }

    // Verificar si el contenido es igual al último enviado
    if (content === lastMessageContent) {
        alert("No puedes enviar un mensaje igual al anterior.");
        return;
    }

    // Preparar los datos del mensaje
    const messageData = {
        content,
        sensitive: isSensitive ? 1 : 0,
        sender_id: users[activeUser].id,
        createdAt: new Date().toISOString(),
        chat_or_group_id: forumId,
        is_private: false,
    };

    let media = null;
    let mediaType = null;

    if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "matesito"); // Agregado para Cloudinary

        try {
            // Subir el archivo a Cloudinary u otro servicio
            const uploadResponse = await fetch('https://api.cloudinary.com/v1_1/dtzl420mq/upload', {
                method: 'POST',
                body: formData,
            });

            document.getElementById('loading').style.display = 'block';

            const uploadData = await uploadResponse.json();
            media = uploadData.secure_url;
            mediaType = file.type;

            // Añadir los datos de media al mensaje
            messageData.media = media;
            messageData.mediaType = mediaType;
            console.log(media);
        } catch (error) {
            console.error('Error al subir el archivo:', error);
            alert('Error al subir el archivo.');
            return;
        }
    }

    document.getElementById('loading').style.display = 'block';

    try {
        // Enviar el mensaje al servidor
        const response = await fetch(` /mensajes/${forumId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageData),
        });

        if (response.ok) {
            const responseData = await response.json();
            lastMessageContent = responseData.content;  // Actualizar la variable global
            document.getElementById('postContent').value = '';
            fileInput.value = ''; // Limpiar input de archivos
            document.getElementById('loading').style.display = 'none';
            alert('Mensaje enviado con éxito');
        } else {
            document.getElementById('loading').style.display = 'none';
            alert('Error al enviar el mensaje');
        }
    } catch (error) {
        document.getElementById('loading').style.display = 'none';
        console.error('Error al enviar el mensaje:', error);
        alert('Error al enviar el mensaje.');
    }
}    

async function sendChatMessage(chatId) {
    const content = document.getElementById('postContent').value;
    const isSensitive = document.getElementById('sensitiveContentCheckbox')?.checked || false;
    const fileInput = document.getElementById('postMedia');
    const file = fileInput?.files?.[0];

    // Validar contenido prohibido
    if (containsForbiddenWords(content)) {
        alert("Creemos que tu mensaje infringe nuestros términos y condiciones. Si crees que es un error, contacta con soporte.");
        return;
    }

    // Verificar si el contenido es igual al último enviado
    if (content === lastMessageContent) {
        alert("No puedes enviar un mensaje igual al anterior.");
        return;
    }

    // Preparar los datos del mensaje
    const messageData = {
        content,
        sensitive: isSensitive ? 1 : 0,
        sender_id: users[activeUser].id,
        createdAt: new Date().toISOString(),
        chat_or_group_id: chatId,
        is_private: true,
    };

    let media = null;
    let mediaType = null;

    if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "matesito"); // Agregado para Cloudinary

        document.getElementById('loading').style.display = 'block';

        try {
            const uploadResponse = await fetch('https://api.cloudinary.com/v1_1/dtzl420mq/upload', {
                method: 'POST',
                body: formData,
            });
            const uploadData = await uploadResponse.json();
            media = uploadData.secure_url;
            mediaType = file.type;

            messageData.media = media;
            messageData.mediaType = mediaType;
        } catch (error) {
            console.error('Error al subir el archivo:', error);
            alert('Error al subir el archivo.');
            return;
        }
    }

    document.getElementById('loading').style.display = 'block';

    try {
        const response = await fetch(` /mensajes/${chatId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageData),
        });

        if (response.ok) {
            const responseData = await response.json();
            lastMessageContent = responseData.content;
            document.getElementById('postContent').value = '';
            if (fileInput) fileInput.value = '';
            document.getElementById('loading').style.display = 'none';
            alert('Mensaje enviado con éxito');
        } else {
            document.getElementById('loading').style.display = 'none';
            alert('Error al enviar el mensaje');
        }
    } catch (error) {
        document.getElementById('loading').style.display = 'none';
        console.error('Error al enviar el mensaje:', error);
        alert('Error al enviar el mensaje.');
    }
}

async function sendGroupMessage(groupId) {
    const content = document.getElementById('postContent').value;
    const isSensitive = document.getElementById('sensitiveContentCheckbox')?.checked || false;
    const fileInput = document.getElementById('postMedia');
    const file = fileInput?.files?.[0];

    // Validar contenido prohibido
    if (containsForbiddenWords(content)) {
        alert("Tu mensaje puede infringir las políticas. Por favor revisa su contenido.");
        return;
    }

    let media = null;
    let mediaType = null;

    if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", "matesito"); // Agregado para Cloudinary

        document.getElementById('loading').style.display = 'block';

        try {
            const uploadResponse = await fetch('https://api.cloudinary.com/v1_1/dtzl420mq/upload', {
                method: 'POST',
                body: formData,
            });
            const uploadData = await uploadResponse.json();
            media = uploadData.secure_url;
            mediaType = file.type;
        } catch (error) {
            console.error('Error al subir el archivo:', error);
            alert('Error al subir el archivo.');
            return;
        }
    }

    // Crear datos del mensaje
    const messageData = {
        content,
        sensitive: isSensitive ? 1 : 0,
        sender_id: users[activeUser].id,
        media,
        mediaType,
    };

    document.getElementById('loading').style.display = 'block';

    try {
        const response = await fetch(` /group/messages/${groupId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(messageData),
        });

        if (response.ok) {
            const responseData = await response.json();
            document.getElementById('postContent').value = '';
            if (fileInput) fileInput.value = '';
            alert('Mensaje enviado con éxito');
            document.getElementById('loading').style.display = 'none';
        } else {
            document.getElementById('loading').style.display = 'none';
            alert('Error al enviar el mensaje');
        }
    } catch (error) {
        console.error('Error al enviar el mensaje:', error);
        alert('Error al enviar el mensaje.');
        document.getElementById('loading').style.display = 'none';
    }
    
}


  function postpost() {
    const postContent = document.getElementById('postContent').value;
    const isSensitive = document.getElementById('sensitiveContentCheckbox').checked;

    if (containsForbiddenWords(postContent)) {
        alert("Creemos que tu post infringe nuestros términos y condiciones. Si crees que es un error, contacta con soporte.");
        return;
    }

    if (postContent === lastpostContent) {
        alert("No puedes enviar un post igual al anterior.");
        return;
    }

    const postData = {
        username: activeUser,
        content: postContent,
        sensitive: isSensitive ? 1 : 0,
        createdAt: new Date().toISOString(), // Hora en formato UTC
    };

    // Mostrar el símbolo de carga
    document.getElementById('loading').style.display = 'block';

    if (selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("upload_preset", "matesito");

        fetch('https://api.cloudinary.com/v1_1/dtzl420mq/upload', {
            method: 'POST',
            body: formData,
        })
        .then(response => response.json())
        .then(data => {
            postData.media = data.secure_url;
            postData.mediaType = selectedFile.type;

            return fetch(' /posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(postData),
            });
        })
        .then(response => response.json())
        .then(data => {
            lastpostContent = data.content;
            document.getElementById('postMedia').value = '';
            selectedFile = null;
            document.getElementById('loading').style.display = 'none';
            alert('Tu post se ha enviado correctamente');
            ;togglePosts();
        })
        .catch(error => {
            console.error('Error al subir el archivo o enviar el post:', error);
            alert('Error al subir el archivo o enviar el post');
        })

    } else {
        fetch(' /posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postData),
        })
        .then(response => response.json())
        .then(data => {
            lastpostContent = data.content;
            document.getElementById('postContent').value = '';
            selectedFile = null;
            alert('Tu post se ha enviado correctamente');
            ;togglePosts();
        })
        .catch(error => {
            console.error('Error al enviar el post:', error);
            alert('Error al enviar el post');
        })
        .finally(() => {
            // Ocultar el símbolo de carga
            document.getElementById('loading').style.display = 'none';
        });
    }
}    

function goBackToInitial() {
document.getElementById('usernameOverlay').style.display = 'none';
document.getElementById('userSelectOverlay').style.display = 'none';

document.getElementById('initialOverlay').style.display = 'flex';
}

let showSensitiveContent = false;

function buttonsState() {
// Obtener referencias a los contenedores directamente dentro de la función
const profileList = document.getElementById('profileList');
const unicPostList = document.getElementById('unicPostList');
const forumList = document.getElementById('forumList');
const messageList = document.getElementById('messageList');
const groupMessageList = document.getElementById('groupMessageList');
const postList = document.getElementById('postList');

if (profileList.style.display === 'block') {
    const username = document.getElementById('currentProfileUsername').value;
    profileList.innerHTML = '';
    unicPostList.innerHTML = '';
    viewProfile(username, loadAll); 

} else if (postList.style.display === 'block') {
    loadposts(loadAll); 
    postList.innerHTML = '';
    unicPostList.innerHTML = '';
} else if (forumList.style.display === 'block') {
    loadForumPosts(activeForum, loadAll);
    forumList.innerHTML = '';
    unicPostList.innerHTML = '';
}else if (messageList.style.display === 'block') {
    loadChatMessages(activeChat, loadAll);
    messageList.innerHTML = '';
    unicPostList.innerHTML = '';
} else if (groupMessageList.style.display === 'block') {
    unicPostList.innerHTML = '';
    loadGroupMessages(activeGroup, loadAll);
    groupMessageList.innerHTML = '';
}

obtenerNotificaciones();
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
button.textContent = loadAll ? 'Mostrar solo los últimos 12 posts' : 'Cargar todos los posts';

// Llamar a buttonsState para recargar los posts según el estado actual
buttonsState();
}

function loadposts(loadAll) {
const unicPostList = document.getElementById('unicPostList');
unicPostList.style.display = 'none';


activeForum = '';
activeChat = '';
activeGroup = '';

showOnlyMenu(postList, forumList, postList, messageList, groupMessageList, profileList);

document.getElementById('postList').innerHTML = '';

fetch(' /posts')
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error al cargar los posts: ${response.status}`);
        }
        return response.json();
    })
    .then(posts => {
        const reversedPosts = posts;

        // Determinar cuántos posts renderizar
        const postsToRender = loadAll ? reversedPosts : reversedPosts.slice(0, 12);
        postsToRender.forEach(post => {
            const { content, media, mediaType, username, profilePicture, sensitive, createdAt, userId, postId } = post;

            // Filtrar contenido sensible correctamente
            if (!showSensitiveContent && sensitive === true) return;

            if (content && username) {
                // Ahora estamos pasando postId a la función
                addpostToList(content, media, mediaType, username, profilePicture, sensitive, createdAt, userId, postId, 'postList', invertirOrden);
            } else {
                console.warn('Post inválido omitido:', post);
            }
        });
    })
    .catch(error => {
        console.error('Error al cargar los posts:', error);
    });
}

function createOrLoadChat(user2Id) {
const user1Id = users[activeUser].id;
console.log("cargando chat con id:", user2Id);

if (!user1Id || !user2Id) {
    alert('IDs de usuario incompletos');
    return;
}

fetch(' /createOrLoadPrivateChat', {
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
        alert(`Error: ${error.message}`);
    });
}

function loadChatMessages(chatId, loadAll) {
showOnlyMenu(messageList, forumList, postList, messageList, groupMessageList, profileList);
activeForum = '';
activeGroup = '';

document.getElementById('messageList').innerHTML = ''; // Limpiar lista de mensajes
const unicPostList = document.getElementById('unicPostList'); unicPostList.style.display = 'none';

fetch(` /chat/messages/${chatId}`)
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error al cargar los mensajes: ${response.status}`);
        }
        return response.json();
    })
    .then(messages => {
        const reversedMessages = messages.reverse(); // Ordenar los mensajes de más antiguos a más recientes

        const messagesToRender = loadAll ? reversedMessages : reversedMessages.slice(0, 12);

        messagesToRender.forEach(message => {
            const {
                content,
                media,
                media_type: mediaType,
                sensitive,
                created_at: createdAt,
                sender_id: userId,
                username,
                image: profilePicture,
                id: messageId // Asegurarse de que se obtenga el ID del mensaje
            } = message;

            // Filtrar contenido sensible si es necesario
            if (!showSensitiveContent && sensitive === true) return;

            // Agregar mensaje a la lista
            addpostToList(
                content,
                media || null,
                mediaType || null,
                username || `Usuario ${userId}`,
                profilePicture || '/default-profile.png',
                sensitive,
                createdAt,
                userId,
                messageId,
                'messageList', 
                invertirOrden
            );
        });
    })
    .catch(error => {
        console.error('Error al cargar los mensajes:', error);
    });
}

function loadGroupMessages(groupId, loadAll) {
showOnlyMenu(groupMessageList, forumList, postList, messageList, groupMessageList, profileList);
const unicPostList = document.getElementById('unicPostList'); unicPostList.style.display = 'none';

activeForum = '';
activeChat = '';

activeGroup = groupId;

const activeUserId = users[activeUser].id;

document.getElementById('groupMessageList').innerHTML = ''; // Limpiar lista de mensajes

fetch(` /group/messages/${groupId}/${activeUserId}`)
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error al cargar los mensajes: ${response.status}`);
        }
        return response.json();
    })
    .then(messages => {
        const reversedMessages = messages.reverse(); // Ordenar los mensajes de más antiguos a más recientes

        const messagesToRender = loadAll ? reversedMessages : reversedMessages.slice(0, 12);

        messagesToRender.forEach(message => {
            const {
                content,
                media,
                media_type: mediaType,
                sensitive,
                created_at: createdAt,
                sender_id: userId,
                username,
                image: profilePicture,
                id: messageId // Asegurarse de que se obtenga el ID del mensaje
            } = message;

            // Filtrar contenido sensible si es necesario
            if (!showSensitiveContent && sensitive === true) return;

            // Agregar mensaje a la lista
            addpostToList(
                content,
                media || null,
                mediaType || null,
                username || `Usuario ${userId}`,
                profilePicture || '/default-profile.png',
                sensitive,
                createdAt,
                userId,
                messageId,
                'groupMessageList', 
                invertirOrden
            );
        });
    })
    .catch(error => {
        console.error('Error al cargar los mensajes del grupo:', error);
    });
}

function loadForumPosts(forumId, loadAll) {
showOnlyMenu(forumList, forumList, postList, messageList, groupMessageList, profileList);

document.getElementById('forumList').innerHTML = ''; // Limpiar lista de posts
const unicPostList = document.getElementById('unicPostList'); unicPostList.style.display = 'none';

activeChat = '';
activeGroup = '';
activeForum = forumId;

fetch(` /mensajes/${forumId}`)
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error al cargar los mensajes: ${response.status}`);
        }
        return response.json();
    })
    .then(messages => {

        const reversedMessages = messages.reverse();

        const messagesToRender = loadAll ? reversedMessages : reversedMessages.slice(0, 12);

        messagesToRender.forEach(message => {
            const {
                content,
                media,
                media_type: mediaType,
                sensitive,
                created_at: createdAt,
                sender_id: userId,
                username,
                image: profilePicture,
                id: postId // Asegurarse de que se obtenga el ID del mensaje
            } = message;

            // Filtrar contenido sensible si es necesario
            if (!showSensitiveContent && sensitive === true) return;

            // Agregar mensaje a la lista
            addpostToList(
                content,
                media || null,
                mediaType || null,
                username || `Usuario ${userId}`,
                profilePicture || '/default-profile.png',
                sensitive,
                createdAt,
                userId,
                postId,
                'forumList', 
                invertirOrden
            );
        });
    })
    .catch(error => {
        console.error('Error al cargar los mensajes:', error);
    });
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

    // Actualizar el texto del botón principal
    const ordenButton = document.getElementById('orden-button');
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
        return await response.json();
    } catch (error) {
        console.error('Error al cargar los totales de reacciones:', error);
        return {};
    }
}

async function addpostToList(content, media, mediaType, username, profilePicture, sensitive, createdAt, userId, postId, listId, invertirOrden) {
    const postList = document.getElementById(listId);
    if (!postList) {
        console.error(`No se encontró el contenedor con id "${listId}".`);
        return;
    }

    const newpost = document.createElement('li');
    newpost.className = 'post';

    // Convertir fecha a hora local
    const localTime = createdAt ? new Date(createdAt).toLocaleString() : '';

    // Imagen del perfil
    const profilePicHTML = profilePicture
        ? `<img src="${profilePicture}" alt="Foto de perfil de ${username}" class="profile-picture">`
        : `<img src="/default-profile.png" alt="Foto de perfil por defecto" class="profile-picture">`;

    // Media del post (imagen/video/audio)
    let mediaHTML = '';
    if (media && mediaType) {
        if (mediaType.startsWith('image/')) {
            mediaHTML = `<div><img src="${media}" alt="Imagen subida por ${username}" class="preview-media clickable"></div>`;
        } else if (mediaType.startsWith('video/')) {
            mediaHTML = `<div>
                            <video controls class="preview-media clickable">
                                <source src="${media}" type="${mediaType}">
                                Tu navegador no soporta la reproducción de video.
                            </video>
                        </div>`;
        } else if (mediaType.startsWith('audio/')) {
            mediaHTML = `<div>
                            <audio controls class="preview-media clickable">
                                <source src="${media}" type="${mediaType}">
                                Tu navegador no soporta la reproducción de audio.
                            </audio>
                        </div>`;
        }
    }

    // Contenido sensible
    let contentHTML = sensitive === true
        ? `<div class="sensitive-content">
                <p>⚠ Este contenido ha sido marcado como sensible</p>
                <button onclick="this.nextElementSibling.style.display='block'; this.style.display='none';">Mostrar contenido</button>
                <div class="hidden-content clickable" style="display:none;">
                    ${content}
                    ${mediaHTML}
                </div>
            </div>`
        : `<div class="post-content clickable">${content}${mediaHTML}</div>`;

    // Crear un id único para la caja de usuario y para el widget de MicroReact
    const uniqueId = `userProfileBox_${userId}_${Math.random().toString(36).substr(2, 9)}`;
    const microReactId = `post-${postId}`;

    // HTML del post
    newpost.innerHTML = `
        <div class="post-header">
            ${profilePicHTML}
            <div class="post-user-info">
                <span class="username" onclick="toggleUserProfileBox('${uniqueId}')">${username}:</span>
                <span class="post-time">${localTime}</span>
            </div>
        </div>
        <div class="user-profile-box" id="${uniqueId}" style="display:none; margin-bottom: 8px">
            <button onclick="viewProfile('${username}')">Ver perfil</button>
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

    if (ordenarReacciones) {
        // Guardar en el array temporal sin renderizar
        postsArray.push({ postElement: newpost, postId });
    } else {
        // Agregar directamente si no hay ordenamiento
        if (invertirOrden) {
            postList.insertBefore(newpost, postList.firstChild);
        } else {
            postList.appendChild(newpost);
        }
    }

    scrollToBottom();
    renderPostsOrdenados(listId, invertirOrden)
}

// Función para renderizar posts ordenados
async function renderPostsOrdenados(listId, invertirOrden) {
    if (!ordenarReacciones || postsArray.length === 0) return;

    const postList = document.getElementById(listId);
    if (!postList) {
        console.error(`No se encontró el contenedor con id "${listId}".`);
        return;
    }

    try {
        const totals = await cargarTotalesDeReacciones();
        
        // Ordenar posts por reacciones (mayor a menor)
        postsArray.sort((a, b) => (totals[b.postId] || 0) - (totals[a.postId] || 0));
        
        // Limpiar contenedor
        postList.innerHTML = '';
        
        // Insertar posts ordenados
        postsArray.forEach(({ postElement }) => {
            if (invertirOrden) {
                postList.insertBefore(postElement, postList.firstChild);
            } else {
                postList.appendChild(postElement);
            }
        });
        
        postsArray = []; // Resetear array
    } catch (error) {
        console.error('Error al renderizar posts ordenados:', error);
    }
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
// Ocultar todas las cajas de perfil
const allProfileBoxes = document.querySelectorAll('.user-profile-box');
allProfileBoxes.forEach(box => box.style.display = 'none');

// Mostrar u ocultar la caja correspondiente
const userProfileBox = document.getElementById(uniqueId);
if (userProfileBox) {
    userProfileBox.style.display = userProfileBox.style.display === 'none' ? 'block' : 'none';
}
}

// Función para ver el perfil del usuario (puedes redirigir a una página de perfil)
function viewProfile(username, loadAll) {
// Obtener referencias a los contenedores
const profileList = document.getElementById('profileList');
const unicPostList = document.getElementById('unicPostList'); unicPostList.style.display = 'none';

// Guardar el username actual en un input oculto
let currentProfileUsername = document.getElementById('currentProfileUsername');
if (!currentProfileUsername) {
    currentProfileUsername = document.createElement('input');
    currentProfileUsername.type = 'hidden';
    currentProfileUsername.id = 'currentProfileUsername';
    document.body.appendChild(currentProfileUsername);
}


currentProfileUsername.value = username;

// Limpiar el contenido de la lista de perfil
profileList.innerHTML = '';

// Mostrar el contenedor de perfil y ocultar el de publicaciones
showOnlyMenu('profileList', forumList, postList, messageList, groupMessageList, profileList);
activeForum = '';
activeGroup = '';
activeChat = '';

// Cargar los posts del usuario
fetch(` /posts/user/${username}`)
    .then(response => {
        if (!response.ok) {
            throw new Error(`Error al cargar los posts del usuario ${username}`);
        }
        return response.json();
    })
    .then(posts => {
        const postsToRender = loadAll ? posts : posts.slice(0, 12);

        postsToRender.forEach(post => {
            const { content, media, mediaType, username, profilePicture, sensitive, createdAt, userId, postId } = post;
            // Filtrar contenido sensible si es necesario
            if (!showSensitiveContent && sensitive === true) return;
            if (content && username) {
                addpostToList(content, media, mediaType, username, profilePicture, sensitive, createdAt, userId, postId, 'profileList', invertirOrden);
            }
        });
    })
    .catch(error => {
        console.error("Error al cargar los posts del usuario:", error);
    });
}

// Función para seguir al usuario
function followUser(userId) {
const followerId = users[activeUser].id; // El ID del usuario que está siguiendo

if (!followerId) {
    alert('Error: Usuario activo no encontrado');
    return;
}

if (followerId === userId) {
    alert('No puedes seguirte ti mismo');
    return;
}

fetch(' /followUser', {
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
    alert(data.message); // Mensaje del backend
})
.catch(error => {
    console.error('Error al seguir al usuario:', error);
    alert(error.message || 'Error al seguir al usuario');
});
}

function unfollowUser(followerId, followedId) {
fetch(' /unfollowUser', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ followerId, followedId })
})
.then(response => response.json())
.then(data => {
    if (data.message === 'Has dejado de seguir a este usuario') {
        alert('Has dejado de seguir a este usuario');
    } else {
        alert(data.message);
    }
})
.catch(error => {
    console.error('Error al dejar de seguir:', error);
    alert('Error al dejar de seguir al usuario');
});
}

function loadFollowedUsers() {
const followerId = users[activeUser]?.id; // ID del usuario activo

fetch(` /followedUsers/${followerId}`)
    .then(response => response.json())
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
        alert('Error al cargar los usuarios seguidos');
    });
}

function loadUserGroups() {
const userId = users[activeUser]?.id; // ID del usuario activo

fetch(` /grupos-usuario/${userId}`)
.then(response => response.json())
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
    alert('Error al cargar los grupos del usuario');
});
}

function loadCreatedGroups() {
const userId = users[activeUser]?.id; // ID del usuario activo

fetch(` /grupos-creados/${userId}`)
    .then(response => response.json())
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
        alert('Error al cargar los grupos creados');
    });
}

function deleteGroup(groupId) {
const userId = users[activeUser]?.id; // ID del suario activo

fetch(` /grupo/${groupId}/${userId}`, {
    method: 'DELETE',
})
    .then(response => response.json())
    .then(data => {
        if (data.message) {
            alert(data.message); // Mostrar mensaje de éxito
            loadCreatedGroups(); // Volver a cargar los grupos creados
        } else {
            alert(data.error); // Mostrar mensaje de error
        }
    })
    .catch(error => {
        console.error('Error al eliminar el grupo:', error);
        alert('Error al eliminar el grupo');
    });
}


async function obtenerNotificaciones() {
const userId = users[activeUser].id;

try {
    const response = await fetch(`/notificaciones/${userId}`);
    const notificaciones = await response.json();
    
    console.log("Notificaciones recibidas:", notificaciones);
    renderizarNotificaciones(notificaciones);
    actualizarIndicadorNotificaciones(notificaciones.length > 0);
} catch (error) {
    console.error('Error al obtener notificaciones:', error);
}
}

function renderizarNotificaciones(notificaciones) {
const userId = users[activeUser].id;
const contenedor = document.getElementById('renderNotif');
contenedor.innerHTML = '';

if (notificaciones.length === 0) {
    contenedor.innerHTML = '<p>No tienes notificaciones nuevas.</p>';
    actualizarIndicadorNotificaciones(false);
    return;
}

notificaciones.forEach(noti => {
    console.log(noti);
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
        notiElemento.addEventListener('click', () => createOrLoadChat(chat_or_group_id));
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
    console.log(notiElemento);

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
    await fetch(`/notificaciones/${userId}/leer`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notiId }) // Ahora envía el ID correcto
    });

    elemento.remove(); // Borra la notificación del DOM

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
const punto = document.getElementById('puntoNotificacion');

// Usa visibility en lugar de display/opacity para evitar problemas con el label
punto.style.visibility = hayNotificaciones ? 'visible' : 'hidden';
}


function searchMotor() {
const query = document.getElementById('searchInput').value;
const searchContainer = document.getElementById('searchconteiner');

// Si el campo está vacío, limpiar y salir
if (query.trim().length < 1) { 
    searchContainer.innerHTML = ''; // Limpiar resultados
    return; // Detener la ejecución
}

fetch(`/search?query=${query}`)
    .then(response => response.json())
    .then(data => {
        searchContainer.innerHTML = ''; // Limpiar resultados previos

        if (data.foros.length === 0 && data.usuarios.length === 0) {
            searchContainer.innerHTML = '<p>No se encontraron resultados.</p>';
        }

        // Mostrar foros
        data.foros.forEach(foro => {
            const foroElement = document.createElement('div');
            foroElement.classList.add('SearchContainer', 'forum-item'); // Agregar clases
            foroElement.innerHTML = `
                <p><strong>Foro:</strong> ${foro.name}</p>
            `;
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
            userElement.innerHTML = `
                <div class="SearchContainer user-item" style="margin-top: 5px; margin-bottom: 5px;">
                    <img src="${user.profilePicture || '/default-avatar.png'}" alt="${user.username}" class="profile-picture" />
                    <span class="username">${user.username}</span>
                </div>
            `;
            // Agregar manejador de clic para el usuario
            userElement.addEventListener('click', () => {
                viewProfile(user.username); // Llamar a la función con el nombre de usuario
            });
            searchContainer.appendChild(userElement);
        });
    })
    .catch(error => {
        console.error('Error al buscar:', error);
        alert('Error al procesar la búsqueda');
    });
}

function wait(ms) {
return new Promise(resolve => setTimeout(resolve, ms));
}

async  function init() {
toggleVisibility('postList');

await wait(200);

toggleVisibility('postList');
}

function scrollToBottom() {
    let containers = document.querySelectorAll(".posts");
    containers.forEach(container => {
        container.scrollTop = invertirOrden ? container.scrollHeight : 0;
    });
}
    
//al cargar página
window.onload = function() {
verMant(mantenimiento);
checkRememberedUser();
init();
};
