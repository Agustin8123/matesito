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
    const feedback = panel.querySelector('#feedback-region');
    if (feedback) document.body.appendChild(feedback);
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
    const icons = { forumSubMenu: '/res/sidebar-icons/foros.svg', gruposMenu: '/res/sidebar-icons/chats.svg', userSubMenu: '/res/sidebar-icons/followers.svg', SearchMenu: '/resources/SVG/search.svg', dropdownMenu: '/res/default-avatar.svg', notificationsPanel: '/res/sidebar-icons/notifications.svg' };
    document.getElementById('panelIcon').src = icons[id] || icons.forumSubMenu;
    document.getElementById('navigationPanel').showModal();
}
function toggleRightMenu() { toggleForumMenu(); }
function toggleSearch() { openPanel('SearchMenu', 'Buscar'); document.getElementById('searchInput').focus(); }
function toggleMenu() {
    if (!activeUser) return showUserSelectOverlay();
    openPanel('dropdownMenu', 'Mi cuenta');
    document.getElementById('accountPanelIdentity').textContent = activeUser;
}
function toggleForumMenu() { openPanel('forumSubMenu', 'Foros'); return selectPanelTab('forums', 'forumExplore'); }
function toggleGruposMenu() { openPanel('gruposMenu', 'Chats y grupos'); return selectPanelTab('chats', 'chatInbox'); }
function toggleUserMenu() { openPanel('userSubMenu', 'Siguiendo'); loadFollowedUsers(); }
function createForumMenu() { openCommunityForm('createForumOverlay'); }
function createGroupMenu() { openCommunityForm('createGroupOverlay'); }
function joinGroupMenu() { openCommunityForm('joinGrupoMenu'); }
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

async function loadPrivateChats() {
    const container = document.getElementById('privateChats');
    try {
        const chats = await fetch('/chats').then(readResponse);
        container.replaceChildren();
        if (!chats.length) {
            const empty = document.createElement('p'); empty.textContent = 'Tu próxima conversación empieza acá. Para chatear, ambos tienen que seguirse.';
            container.append(empty, menuButton('Buscar personas', toggleSearch));
        }
        for (const chat of chats) {
            const card = menuButton('', () => loadChatMessages(chat.id, loadAll)); card.className = 'chat-card';
            const avatar = document.createElement('img'); avatar.src = '/res/default-avatar.svg'; avatar.alt = '';
            const name = document.createElement('span'); name.textContent = chat.username;
            const icon = document.createElement('img'); icon.src = '/res/sidebar-icons/chats.svg'; icon.className = 'ui-icon'; icon.alt = '';
            card.append(avatar, name, icon); container.appendChild(card);
        }
    } catch (error) { container.replaceChildren(); const message = document.createElement('p'); message.textContent = error.message; container.append(message, menuButton('Reintentar', loadPrivateChats)); }
}

const panelTabs = {
    forums: { forumExplore: loadForos, forumFollowing: () => loadForumMenu('followed'), forumOwned: () => loadForumMenu('created') },
    chats: { chatInbox: loadPrivateChats, groupJoined: loadUserGroups, groupOwned: loadCreatedGroups }
};
async function selectPanelTab(group, selected) {
    const tabs = panelTabs[group];
    if (!tabs || !tabs[selected]) return;
    for (const id of Object.keys(tabs)) {
        document.getElementById(id).hidden = id !== selected;
        const button = document.getElementById('tab-' + id);
        button.setAttribute('aria-selected', String(id === selected));
        button.tabIndex = id === selected ? 0 : -1;
    }
    const section = document.getElementById(selected);
    const list = section.querySelector('.community-list');
    list.textContent = 'Cargando…';
    list.setAttribute('aria-busy', 'true');
    try { await tabs[selected](); }
    finally {
        list.removeAttribute('aria-busy');
        filterPanelCards(section.closest('.workspace-panel').querySelector('input[type="search"]'));
    }
}
function filterPanelCards(input) {
    if (!input) return;
    const panel = input.closest('.workspace-panel');
    const section = panel.querySelector('[role="tabpanel"]:not([hidden])');
    if (!section) return;
    const query = input.value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const cards = [...section.querySelectorAll('.community-list > div, .community-list > button')];
    for (const card of cards) card.hidden = !card.textContent.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(query);
    section.querySelector('.filter-empty')?.remove();
    if (cards.length && cards.every(card => card.hidden)) {
        const empty = document.createElement('p'); empty.className = 'panel-empty filter-empty'; empty.textContent = 'No hay coincidencias. Probá con otro nombre.'; section.appendChild(empty);
    }
}
document.querySelectorAll('.panel-tabs').forEach(tablist => tablist.addEventListener('keydown', event => {
    const tabs = [...tablist.querySelectorAll('[role="tab"]')];
    const index = tabs.indexOf(document.activeElement);
    if (index < 0 || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[next].focus(); tabs[next].click();
}));
function toggleBell() { openPanel('notificationsPanel', 'Notificaciones'); obtenerNotificaciones(); }
let markingNotifications = false;
async function markAllNotificationsRead() {
    const userId = users[activeUser]?.id;
    if (!userId || markingNotifications) return;
    markingNotifications = true;
    try {
        await fetch('/notificaciones/' + userId + '/leer', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
        }).then(readResponse);
        await obtenerNotificaciones();
    } catch (error) { notify(error.message, 'error'); }
    finally { markingNotifications = false; }
}

function openCommunityForm(id) {
    const form = document.getElementById(id);
    if (form.style.display === 'flex') return closeCommunityForm(id);
    closePanel(); closeSidebar(); form.style.display = 'flex'; form.querySelector('input')?.focus();
}
function closeCommunityForm(id) {
    document.getElementById(id).style.display = 'none';
    if (id === 'createForumOverlay') { openPanel('forumSubMenu', 'Foros'); return selectPanelTab('forums', 'forumOwned'); }
    openPanel('gruposMenu', 'Chats y grupos');
    return selectPanelTab('chats', id === 'createGroupOverlay' ? 'groupOwned' : 'groupJoined');
}
document.querySelectorAll('#createForumOverlay, #createGroupOverlay, #joinGrupoMenu').forEach(form => {
    form.addEventListener('click', event => { if (event.target === form) closeCommunityForm(form.id); });
    form.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.stopPropagation(); closeCommunityForm(form.id); }
        if (event.key !== 'Tab') return;
        const elements = [...form.querySelectorAll('button, input, textarea')].filter(el => !el.disabled && el.type !== 'hidden');
        const first = elements[0], last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
});
function selectGif() { const input = document.getElementById('postMedia'); input.accept = 'image/gif'; input.click(); }
function selectAttachment() { const input = document.getElementById('postMedia'); input.accept = 'image/*,audio/*,video/*'; input.click(); }
function clearSelectedMedia() { selectedFile = null; document.getElementById('postMedia').value = ''; updatePostMediaButton(); }
function openRequestedPanel() {
    const routes = { '#foros': toggleForumMenu, '#chats': toggleGruposMenu, '#siguiendo': toggleUserMenu, '#notificaciones': toggleBell, '#buscar': toggleSearch };
    if (activeUser) routes[location.hash]?.();
}
window.addEventListener('hashchange', openRequestedPanel);
