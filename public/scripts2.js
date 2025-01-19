

// Función genérica para alternar la visibilidad de un elemento
export function toggleVisibility(elementId, displayType = 'block') {
    console.log("interactuando con: ", elementId);
    const element = document.getElementById(elementId);
    element.style.display = element.style.display === displayType ? 'none' : displayType;
}

// Función para ocultar múltiples menús
export function hideMenus(...menuIds) {
    console.log("interactuando con: ", menuIds);
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
export function toggleMenu() {
    hideMenus('SearchMenu', 'rightMenu', 'forumSubMenu', 'userSubMenu');
    toggleVisibility('dropdownMenu');
}

export function togglePosts() {
    const profileList = document.getElementById('profileList');
    const postList = document.getElementById('postList');

    profileList.style.display = 'none';
    postList.style.display = 'block';
}

// Alerta de ayuda
export function HelpAlert() {
    alert('Si requieres ayuda con cualquier cosa, contactate con nuestro correo de soporte "matesito.soporte@gmail.com"');
}

// Menú lateral derecho
export function toggleRightMenu() {
    hideMenus('SearchMenu', 'dropdownMenu');
    toggleVisibility('rightMenu');
}

// Menú de búsqueda
export function toggleSearch() {
    hideMenus('rightMenu', 'dropdownMenu');
    toggleVisibility('SearchMenu');
}

// Submenús específicos
export function toggleForumMenu() {
    toggleVisibility('forumSubMenu');
}

export function toggleMyForumMenu() {
    toggleVisibility('myForumMenu');
}

export function toggleGruposMenu() {
    toggleVisibility('gruposMenu');
}

export function userJoinedGroupMenu() {
    toggleVisibility('userJoinedMenu');
}

export function usercreatedGroupMenu() {
    toggleVisibility('userCreatedMenu');
}

export function toggleUserMenu() {
    toggleVisibility('userSubMenu');
    loadFollowedUsers(); 
}

export function createForumMenu() {
    toggleVisibility('createForumOverlay', 'flex');
    toggleRightMenu();
}

export function createGroupMenu() {
    toggleVisibility('createGroupOverlay', 'flex');
    toggleRightMenu();
}

export function joinGroupMenu() {
    toggleVisibility('joinGrupoMenu', 'flex');
    toggleRightMenu();
}

export function exploreForumMenu() {
    toggleVisibility('exploreforumMenu');
    loadForos();
}

export function exploreForumMenu2() {
    toggleVisibility('exploreforumMenu2');
    loadUserForums();
}

// Otros submenús
export function toggleSubMenu() {
    toggleVisibility('subMenu');
}

export function toggleSubMenu2() {
    toggleVisibility('subMenu2');
}

export function toggleDetails(menu, groupId) {
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

export function toggleDetails1(menu, groupId) {
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

export function toggle_UserMenu(user) {
    toggleVisibility(user);

}

export function toggle_ForumMenu(forum) {
    toggleVisibility(forum);
}

export function toggle_GroupMenu(groupId) {
    const menu = document.getElementById(`${groupId}`);
    if (menu.style.display === 'none' || menu.style.display === '') {
        menu.style.display = 'block';
    } else {
        menu.style.display = 'none';
    }
}

export function toggle_GroupMenu1(groupId) {
    const menu = document.getElementById(`${groupId}`);
    if (menu.style.display === 'none' || menu.style.display === '') {
        menu.style.display = 'block';
    } else {
        menu.style.display = 'none';
    }
}

// Overlay inicial
export function Acept() {
    document.getElementById('initialOverlay').style.display = 'flex';
    document.getElementById('AvisoOverlay').style.display = 'none';
}
