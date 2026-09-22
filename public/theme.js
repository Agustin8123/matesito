function applyTheme(theme) {
    const chosen = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', chosen);
    const text = document.querySelector('.theme-toggle .nav-text');
    if (text) text.textContent = chosen === 'dark' ? 'Modo claro' : 'Modo oscuro';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = chosen === 'dark' ? '#0a0a0a' : '#ffffff';
    for (const frame of document.querySelectorAll('iframe[src*="/microReact.html"]')) {
        const url = new URL(frame.src);
        url.searchParams.set('textColor', chosen === 'dark' ? '#ffffff' : '#333333');
        frame.src = url.href;
    }
}
function toggleTheme() {
    const theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    try { localStorage.setItem('theme', theme); } catch { /* Storage can be disabled. */ }
}
try { applyTheme(localStorage.getItem('theme') || 'dark'); } catch { applyTheme('dark'); }
