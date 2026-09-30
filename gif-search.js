// GIFs de dominio público o CC0; no requiere claves de un proveedor comercial.
module.exports = function mountGifSearch(app) {
    const cache = new Map();
    app.get('/api/gifs', async (req, res, next) => {
        const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        const offset = Number(req.query.offset || 0);
        if (!query || query.length > 100 || !Number.isInteger(offset) || offset < 0 || offset > 500) return res.status(400).json({ error: 'Escribí una búsqueda de hasta 100 caracteres' });
        const key = query.toLowerCase() + ':' + offset;
        const cached = cache.get(key);
        if (cached && Date.now() - cached.at < 300000) return res.json(cached.data);
        try {
            const params = new URLSearchParams({ action: 'query', format: 'json', generator: 'search', gsrnamespace: '6',
                gsrsearch: query + ' filemime:image/gif', gsrlimit: '30', gsroffset: String(offset),
                prop: 'imageinfo', iiprop: 'url|mime|size|extmetadata' });
            const response = await fetch('https://commons.wikimedia.org/w/api.php?' + params, {
                headers: { 'User-Agent': 'Matesito/1.3 (https://matesito.com.ar)' }, signal: AbortSignal.timeout(8000)
            });
            if (!response.ok) throw new Error('Proveedor no disponible');
            const payload = await response.json();
            if (payload.error) throw new Error('La búsqueda no se pudo completar');
            const items = Object.values(payload.query?.pages || {}).flatMap(page => {
                const info = page.imageinfo?.[0], meta = info?.extmetadata;
                const license = meta?.LicenseShortName?.value || '';
                if (info?.mime !== 'image/gif' || info.size > 10 * 1024 * 1024 || !/^(public domain|CC0(?: 1\.0)?)$/i.test(license)) return [];
                const url = new URL(info.url), source = new URL(info.descriptionurl);
                if (url.origin !== 'https://upload.wikimedia.org' || source.origin !== 'https://commons.wikimedia.org') return [];
                return [{ name: page.title.replace(/^File:/, ''), url: url.href, source: source.href, license, type: 'image/gif' }];
            });
            const data = { items, next: payload.continue?.gsroffset ?? null };
            if (cache.size >= 50) cache.delete(cache.keys().next().value);
            cache.set(key, { at: Date.now(), data });
            res.json(data);
        } catch { next(Object.assign(new Error('No se pudo consultar Wikimedia Commons. Reintentá en unos segundos.'), { status: 503 })); }
    });
};
