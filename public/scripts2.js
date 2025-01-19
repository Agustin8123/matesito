// Función genérica para alternar la visibilidad de un elemento
function toggleVisibility(elementId, displayType = 'block') {
    const element = document.getElementById(elementId);
    element.style.display = element.style.display === displayType ? 'none' : displayType;
}

// Función para ocultar múltiples menús
function hideMenus(...menuIds) {
    menuIds.forEach(menuId => {
        const menu = document.getElementById(menuId);
        if (menu && menu.style.display !== 'none') {
            menu.style.display = 'none';
        }
    });
}

export function showOnlyMenu(menuIdToShow, ...allMenuIds) {
    hideMenus(...allMenuIds);
    console.log("ocultando: ", allMenuIds);

    console.log("mostrando: ", menuIdToShow);
    toggleVisibility(menuIdToShow, 'block');
}

// Menú desplegable principal
function toggleMenu() {
    hideMenus('SearchMenu', 'rightMenu', 'forumSubMenu', 'userSubMenu');
    toggleVisibility('dropdownMenu');
}

function togglePosts() {
    const profileList = document.getElementById('profileList');
    const postList = document.getElementById('postList');

    profileList.style.display = 'none';
    postList.style.display = 'block';
}

// Alerta de ayuda
function HelpAlert() {
    alert('Si requieres ayuda con cualquier cosa, contactate con nuestro correo de soporte "matesito.soporte@gmail.com"');
}

// Menú lateral derecho
function toggleRightMenu() {
    hideMenus('SearchMenu', 'dropdownMenu');
    toggleVisibility('rightMenu');
}

// Menú de búsqueda
function toggleSearch() {
    hideMenus('rightMenu', 'dropdownMenu');
    toggleVisibility('SearchMenu');
}

// Submenús específicos
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
    loadFollowedUsers(); 
}

function createForumMenu() {
    toggleVisibility('createForumOverlay', 'flex');
    toggleRightMenu();
}

function createGroupMenu() {
    toggleVisibility('createGroupOverlay', 'flex');
    toggleRightMenu();
}

function joinGroupMenu() {
    toggleVisibility('joinGrupoMenu', 'flex');
    toggleRightMenu();
}

function exploreForumMenu() {
    toggleVisibility('exploreforumMenu');
    loadForos();
}

function exploreForumMenu2() {
    toggleVisibility('exploreforumMenu2');
    loadUserForums();
}

// Otros submenús
function toggleSubMenu() {
    toggleVisibility('subMenu');
}

function toggleSubMenu2() {
    toggleVisibility('subMenu2');
}

function toggleDetails(menu, groupId) {
    toggleVisibility(menu);
    fetch(`https://matesitotest.onrender.com/grupo/${groupId}`)
        .then(response => response.json())
        .then(group => {
            // Seleccionar el contenedor dinámico basado en el groupId
            const detailsElement = document.getElementById(`GroupDetailsContainer-${groupId}`);
            if (detailsElement) {
                detailsElement.innerHTML = `
                    <h3>${group.name}</h3>
                    <p>${group.description}</p>
                    <p>Código de invitación: ${group.invite_code}</p>
                `;
            } else {
                console.error(`No se encontró el contenedor para los detalles del grupo con ID: ${groupId}`);
            }
        })
        .catch(error => console.error('Error al cargar los detalles del grupo:', error));
}

function toggleDetails1(menu, groupId) {
    toggleVisibility(menu);
    fetch(`https://matesitotest.onrender.com/grupo/${groupId}`)
        .then(response => response.json())
        .then(group => {
            // Seleccionar el contenedor dinámico basado en el groupId
            const detailsElement = document.getElementById(`groupDetailsContainer-${groupId}`);
            if (detailsElement) {
                detailsElement.innerHTML = `
                    <h3>${group.name}</h3>
                    <p>${group.description}</p>
                    <p>Código de invitación: ${group.invite_code}</p>
                `;
            } else {
                console.error(`No se encontró el contenedor para los detalles del grupo con ID: ${groupId}`);
            }
        })
        .catch(error => console.error('Error al cargar los detalles del grupo:', error));
}

function toggle_UserMenu(user) {
    toggleVisibility(user);

}

function toggle_ForumMenu(forum) {
    toggleVisibility(forum);
}

function toggle_GroupMenu(groupId) {
    const menu = document.getElementById(`${groupId}`);
    if (menu.style.display === 'none' || menu.style.display === '') {
        menu.style.display = 'block';
    } else {
        menu.style.display = 'none';
    }
}

function toggle_GroupMenu1(groupId) {
    const menu = document.getElementById(`${groupId}`);
    if (menu.style.display === 'none' || menu.style.display === '') {
        menu.style.display = 'block';
    } else {
        menu.style.display = 'none';
    }
}

// Overlay inicial
function Acept() {
    document.getElementById('initialOverlay').style.display = 'flex';
    document.getElementById('AvisoOverlay').style.display = 'none';
}
