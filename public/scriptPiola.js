
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Actualizar texto del botón
    const themeText = document.querySelector('.theme-toggle .nav-text');
    themeText.textContent = newTheme === 'dark' ? 'Modo claro' : 'Modo oscuro';
}

// Cargar tema guardado al iniciar
document.addEventListener('DOMContentLoaded', function() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    // Actualizar texto del botón
    const themeText = document.querySelector('.theme-toggle .nav-text');
    if (themeText) {
        themeText.textContent = savedTheme === 'dark' ? 'Modo claro' : 'Modo oscuro';
    }
});