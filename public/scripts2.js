// Función genérica para alternar la visibilidad de un elemento
function toggleVisibility(elementId, displayType = 'block') {
    const element = document.getElementById(elementId);
    element.style.display = element.style.display === displayType ? 'none' : displayType;
}

function toggleVisibility1(elementId, displayType = 'grid') {
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

function deactivateAllDivs() {
    const container = document.getElementById('usersContainer');
    const inputs = container.querySelectorAll(':scope > input, :scope > button, :scope > textarea, :scope > select');

    inputs.forEach(input => {
        input.disabled = !input.disabled;
    });
}

// Menú desplegable principal
function toggleMenu() {
    hideMenus('SearchMenu', 'rightMenu', 'forumSubMenu', 'userSubMenu');
    toggleVisibility('dropdownMenu');
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

function toggleUserMenu() {
    toggleVisibility('userSubMenu');
    loadFollowedUsers(); 
}

function createForumMenu() {
    toggleVisibility('createForumOverlay', 'flex');
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

function toggle_UserMenu(user) {
    toggleVisibility1(user);
    deactivateAllDivs();
}

// Overlay inicial
function Acept() {
    document.getElementById('initialOverlay').style.display = 'flex';
    document.getElementById('AvisoOverlay').style.display = 'none';
}