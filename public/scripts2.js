// ===== SISTEMA DE NAVEGACIÓN PRINCIPAL =====
function togglePosts() {
    // Ocultar todos los contenedores de contenido primero
    hideAllContentContainers();
    
    // Mostrar solo los posts principales
    document.querySelector('.right-side').style.display = 'flex';
    
    // Aquí puedes agregar la lógica para cargar los posts si es necesario
    console.log('Mostrando posts principales');
}

// ===== SISTEMA DE SUBMENÚS Y OVERLAYS =====
function toggleForumMenu() {
    toggleVisibility('forumSubMenu');
}

function toggleMyForumMenu() {
    toggleVisibility('myForumMenu');
}

function toggleGruposMenu() {
    toggleVisibility('gruposMenu');
}

function userJoinedGroupMenu() {
    toggleVisibility('userJoinedMenu');
}

function usercreatedGroupMenu() {
    toggleVisibility('userCreatedMenu');
}

function toggleUserMenu() {
    toggleVisibility('userSubMenu');
    // loadFollowedUsers(); // Comentado hasta que implementes esta función
}

function createForumMenu() {
    toggleVisibility('createForumOverlay', 'flex');
}

function createGroupMenu() {
    toggleVisibility('createGroupOverlay', 'flex');
}

function toggleBell() {
    toggleVisibility('notifMenu', 'flex');
    // obtenerNotificaciones(); // Comentado hasta que implementes esta función
}

function joinGroupMenu() {
    toggleVisibility('joinGrupoMenu', 'flex');
}

function exploreForumMenu() {
    toggleVisibility('exploreforumMenu');
    // loadForos(); // Comentado hasta que implementes esta función
}

function exploreForumMenu2() {
    toggleVisibility('exploreforumMenu2');
    // loadUserForums(); // Comentado hasta que implementes esta función
}

// ===== FUNCIONES DE DETALLES =====
function toggleDetails(menu, groupId) {
    toggleVisibility(menu);
    // Comentado hasta que implementes los grupos
    /*
    fetch(` /grupo/${groupId}`)
        .then(response => response.json())
        .then(group => {
            const detailsElement = document.getElementById(`GroupDetailsContainer-${groupId}`);
            if (detailsElement) {
                detailsElement.innerHTML = `
                    <h3>${group.name}</h3>
                    <p>${group.description}</p>
                    <p>Código de invitación: ${group.invite_code}</p>
                `;
            }
        })
        .catch(error => console.error('Error al cargar los detalles del grupo:', error));
    */
}

function toggleDetails1(menu, groupId) {
    toggleVisibility(menu);
    // Comentado hasta que implementes los grupos
    /*
    fetch(` /grupo/${groupId}`)
        .then(response => response.json())
        .then(group => {
            const detailsElement = document.getElementById(`groupDetailsContainer-${groupId}`);
            if (detailsElement) {
                detailsElement.innerHTML = `
                    <h3>${group.name}</h3>
                    <p>${group.description}</p>
                    <p>Código de invitación: ${group.invite_code}</p>
                `;
            }
        })
        .catch(error => console.error('Error al cargar los detalles del grupo:', error));
    */
}

// ===== FUNCIONES DE TOGGLE PARA ELEMENTOS ESPECÍFICOS =====
function toggle_UserMenu(user) {
    toggleVisibility(user);
}

function toggle_ForumMenu(forum) {
    toggleVisibility(forum);
}

function toggle_GroupMenu(groupId) {
    const menu = document.getElementById(`${groupId}`);
    if (menu) {
        if (menu.style.display === 'none' || menu.style.display === '') {
            menu.style.display = 'block';
        } else {
            menu.style.display = 'none';
        }
    }
}

function toggle_GroupMenu1(groupId) {
    const menu = document.getElementById(`${groupId}`);
    if (menu) {
        if (menu.style.display === 'none' || menu.style.display === '') {
            menu.style.display = 'block';
        } else {
            menu.style.display = 'none';
        }
    }
}

// ===== FUNCIONALIDAD FULLSCREEN =====
function openFullscreen(element) {
    if (element.requestFullscreen) {
        element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) { /* Safari */
        element.webkitRequestFullscreen();
    } else if (element.msRequestFullscreen) { /* IE11 */
        element.msRequestFullscreen();
    }
}

// ===== SISTEMA DE GESTIÓN DE USUARIO =====
let users = {};

function Acept() {
    // Esta función parece ser para overlays iniciales - ajustar según necesites
    const authPopup = document.querySelector('.authpopup');
    if (authPopup) {
        authPopup.style.display = 'none';
    }
    document.querySelector('.right-side').style.display = 'flex';
}

// Función de login actualizada para tu sistema
function loginUser() {
    const username = "usuario_ejemplo"; // Temporal - conectar con tu backend
    const password = "password"; // Temporal
    
    // Simulación de login exitoso
    setActiveUser(username);
}

function setActiveUser(username) {
    activeUser = username;
    
    // Aquí puedes agregar la lógica para obtener detalles del usuario
    // desde tu backend cuando lo implementes
    /*
    fetch(' /getUserDetails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
    })
    .then(response => response.json())
    .then(data => {
        if (data.id) {
            activeUser = username;
            if (!users[username]) {
                users[username] = {};
            }
            users[username].profileImage = data.profileImage || 'res/default-avatar.svg';
            users[username].description = data.description || '';
            
            // Cerrar popup de auth y mostrar contenido principal
            closeAuthPopup();
        }
    })
    .catch(error => {
        console.error("Error al obtener detalles del usuario:", error);
    });
    */
    
    // Por ahora, simulación exitosa
    closeAuthPopup();
}

function closeAuthPopup() {
    const authPopup = document.querySelector('.authpopup');
    if (authPopup) {
        authPopup.style.display = 'none';
    }
    document.querySelector('.right-side').style.display = 'flex';
}

function hideUserSelectOverlay() {
    const authPopup = document.querySelector('.authpopup');
    if (authPopup) {
        authPopup.style.display = 'none';
    }
}

// ===== GESTIÓN DE PERFIL DEL USUARIO =====
function updateUsername() {
    const newUsername = document.getElementById('newUsername')?.value.trim();
    if (!newUsername) {
        alert('El nombre de usuario no puede estar vacío.');
        return;
    }

    if (!activeUser) {
        alert('No hay usuario activo.');
        return;
    }

    // Aquí iría tu llamada al backend
    console.log('Actualizando username:', { current: activeUser, new: newUsername });
    alert('Funcionalidad de actualizar username - conectar con backend');
}

function updatePassword() {
    const currentPassword = document.getElementById('currentPassword')?.value.trim();
    const newPassword = document.getElementById('newPassword')?.value.trim();

    if (!currentPassword || !newPassword) {
        alert('Ambos campos de contraseña deben estar completos.');
        return;
    }

    if (!activeUser) {
        alert('No hay usuario activo.');
        return;
    }

    // Aquí iría tu llamada al backend
    console.log('Actualizando password para:', activeUser);
    alert('Funcionalidad de actualizar password - conectar con backend');
}

function updateDescription() {
    const newDescription = document.getElementById('userDescription')?.value.trim();

    if (!newDescription) {
        alert('La descripción no puede estar vacía.');
        return;
    }

    if (!activeUser) {
        alert('No hay usuario activo.');
        return;
    }

    // Aquí iría tu llamada al backend
    console.log('Actualizando descripción para:', activeUser);
    alert('Funcionalidad de actualizar descripción - conectar con backend');
}

function updateProfileImage() {
    const profileImageInput = document.getElementById('profileImage');
    if (!profileImageInput?.files?.[0]) {
        alert('Por favor selecciona una imagen para subir.');
        return;
    }

    if (!activeUser) {
        alert('No hay usuario activo.');
        return;
    }

    // Aquí iría tu lógica de subida a Cloudinary
    console.log('Actualizando imagen de perfil para:', activeUser);
    alert('Funcionalidad de actualizar imagen de perfil - conectar con backend');
}

// ===== FUNCIONES AUXILIARES =====
function toggleVisibility(elementId, displayType = 'block') {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.display = (element.style.display === displayType) ? 'none' : displayType;
    }
}

function hideMenus(...menuIds) {
    menuIds.forEach(menuId => {
        const menu = document.getElementById(menuId);
        if (menu) {
            menu.style.display = 'none';
        }
    });
}

function hideAllContentContainers() {
    // Ocultar todos los overlays y menús que puedan estar abiertos
    const overlays = [
        'createForumOverlay', 'createGroupOverlay', 'joinGrupoMenu',
        'exploreforumMenu', 'exploreforumMenu2', 'notifMenu'
    ];
    
    overlays.forEach(overlay => {
        const element = document.getElementById(overlay);
        if (element) {
            element.style.display = 'none';
        }
    });
}

// ===== TOGGLES DE PASSWORD (si los necesitas) =====
function togglePassword() {
    const passwordInput = document.getElementById('currentPassword');
    if (passwordInput) {
        passwordInput.type = passwordInput.type === "password" ? "text" : "password";
    }
}

function togglePassword1() {
    const passwordInput = document.getElementById('newPassword');
    if (passwordInput) {
        passwordInput.type = passwordInput.type === "password" ? "text" : "password";
    }
}

function togglePassword2() {
    const passwordInput = document.getElementById('passwordInput1');
    if (passwordInput) {
        passwordInput.type = passwordInput.type === "password" ? "text" : "password";
    }
}

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', function() {
    // Configurar event listeners para los items del sidebar
    const navItems = document.querySelectorAll('.sidebar-nav-element');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remover clase active de todos los items
            navItems.forEach(navItem => navItem.classList.remove('active'));
            
            // Agregar clase active al item clickeado
            this.classList.add('active');
            
            // Aquí puedes agregar lógica específica para cada item del sidebar
            const navText = this.querySelector('.nav-text').textContent;
            switch(navText) {
                case 'Inicio':
                    togglePosts();
                    break;
                case 'Siguiendo':
                    // toggleUserMenu(); // Cuando implementes siguiendo
                    break;
                case 'Chats':
                    // toggleGruposMenu(); // Cuando implementes chats
                    break;
                case 'Notificaciones':
                    toggleBell();
                    break;
                case 'Foros':
                    exploreForumMenu();
                    break;
            }
        });
    });
});