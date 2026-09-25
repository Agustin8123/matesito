function closeSidebar() {
    document.getElementById('sidebar').classList.remove('active');
    document.querySelector('.mobile-menu').setAttribute('aria-expanded', 'false');
    document.querySelector('.nav-backdrop').hidden = true;
}
function toggleSidebar() {
    const open = document.getElementById('sidebar').classList.toggle('active');
    document.querySelector('.mobile-menu').setAttribute('aria-expanded', String(open));
    document.querySelector('.nav-backdrop').hidden = !open;
}
document.addEventListener('keydown', event => {
    if (event.key === 'Escape') { closeSidebar(); document.querySelector('.mobile-menu').focus(); }
});
document.querySelectorAll('.sidebar a').forEach(link => link.addEventListener('click', closeSidebar));
