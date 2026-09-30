// La clave de búsqueda de GIPHY se usa en el navegador, como requiere su integración.
module.exports = function mountGifSearch(app) {
    app.get('/api/gifs/config', (req, res) => {
        res.set('Cache-Control', 'no-store');
        const apiKey = process.env.GIPHY_API_KEY?.trim();
        if (!apiKey) return res.status(503).json({ error: 'La búsqueda de GIFs todavía no está configurada. Podés adjuntar un GIF desde tus archivos.' });
        res.json({ apiKey });
    });
};
