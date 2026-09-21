function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const text = document.querySelector('.theme-toggle .nav-text');
    if (text) text.textContent = theme === 'dark' ? 'Modo claro' : 'Modo oscuro';
}
function toggleTheme() {
    const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    try { localStorage.setItem('theme', theme); } catch { /* Storage can be disabled. */ }
}
try { applyTheme(localStorage.getItem('theme') || 'dark'); } catch { applyTheme('dark'); }
function toggleSidebar() {
    const open = document.getElementById('sidebar').classList.toggle('active');
    document.querySelector('.mobile-menu').setAttribute('aria-expanded', String(open));
}
function closeSidebar() {
    document.getElementById('sidebar').classList.remove('active');
    document.querySelector('.mobile-menu').setAttribute('aria-expanded', 'false');
}
function navigateHome() { closeSidebar(); closePanel(); backToPosts(); }

// Keep the existing menu handlers when moving menus into the new dialog.
const panelOrigins = new Map();
function closePanel() {
    const panel = document.getElementById('navigationPanel');
    if (panel.open) panel.close();
    for (const [menu, marker] of panelOrigins) {
        marker.replaceWith(menu);
        menu.style.display = 'none';
    }
    panelOrigins.clear();
}
function openPanel(id, title) {
    closePanel(); closeSidebar();
    const menu = document.getElementById(id);
    if (!menu) return;
    const marker = document.createComment('menu location');
    menu.replaceWith(marker);
    panelOrigins.set(menu, marker);
    menu.style.display = 'block';
    document.getElementById('panelContent').appendChild(menu);
    document.getElementById('panelTitle').textContent = title;
    document.getElementById('navigationPanel').showModal();
}
function toggleRightMenu() { openPanel('rightMenu', 'Explorar la comunidad'); }
function toggleSearch() { openPanel('SearchMenu', 'Buscar'); document.getElementById('searchInput').focus(); }
function toggleMenu() {
    if (!activeUser) return showUserSelectOverlay();
    openPanel('dropdownMenu', 'Mi cuenta');
}
function toggleForumMenu() { openPanel('forumSubMenu', 'Foros'); }
function toggleGruposMenu() { openPanel('gruposMenu', 'Chats y grupos'); }
function toggleUserMenu() { openPanel('userSubMenu', 'Siguiendo'); loadFollowedUsers(); }
function createForumMenu() { closePanel(); toggleVisibility('createForumOverlay', 'flex'); }
function createGroupMenu() { closePanel(); toggleVisibility('createGroupOverlay', 'flex'); }
function joinGroupMenu() { closePanel(); toggleVisibility('joinGrupoMenu', 'flex'); }
document.getElementById('navigationPanel').addEventListener('cancel', event => { event.preventDefault(); closePanel(); });
document.getElementById('navigationPanel').addEventListener('click', event => {
    if (event.target === event.currentTarget) closePanel();
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closeSidebar(); hideMenus('notifMenu', 'createForumOverlay', 'createGroupOverlay', 'joinGrupoMenu'); }
});
const originalShowOnlyMenu = showOnlyMenu;
showOnlyMenu = function (id) {
    closePanel(); closeSidebar(); originalShowOnlyMenu(id);
    const titles = { postList: 'Inicio', profileList: 'Perfil', forumList: 'Foro', messageList: 'Chat privado', groupMessageList: 'Grupo' };
    const title = titles[id] || 'Publicaciones';
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('composerContext').textContent = id === 'postList' ? 'Compartí con la comunidad' : 'Publicando en: ' + title;
    document.querySelector('.page-intro').hidden = id !== 'postList';
};
const originalUpdateUserButton = updateUserButton;
updateUserButton = function () {
    originalUpdateUserButton();
    document.getElementById('composerName').textContent = activeUser || 'Tu próximo mate';
    document.getElementById('composerAvatar').src = users[activeUser]?.profileImage || '/res/default-avatar.svg';
};
