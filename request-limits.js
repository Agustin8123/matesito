// Límites por proceso: el proxy puede complementarlos en despliegues con varias instancias.
module.exports = function requestLimits() {
    const buckets = new Map();
    const cleanup = setInterval(() => {
        const now = Date.now();
        for (const [key, bucket] of buckets) if (bucket.until <= now) buckets.delete(key);
    }, 60000); cleanup.unref();
    return (req, res, next) => {
        const login = ['/login', '/users', '/updatePassword'].includes(req.path);
        const expensive = ['/search', '/api/gifs'].includes(req.path);
        const write = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
        if (!login && !expensive && !write) return next();
        const limit = login ? 15 : expensive ? 60 : 120;
        const key = req.ip + ':' + (login ? 'auth' : expensive ? 'search' : 'write');
        const now = Date.now(); let bucket = buckets.get(key);
        if (!bucket || bucket.until <= now) {
            if (buckets.size >= 20000) return res.status(503).json({ error: 'Servidor ocupado. Reintentá en un momento.' });
            bucket = { count: 0, until: now + 60000 }; buckets.set(key, bucket);
        }
        if (++bucket.count > limit) {
            res.set('Retry-After', String(Math.ceil((bucket.until - now) / 1000)));
            return res.status(429).json({ error: 'Demasiadas solicitudes. Esperá un minuto antes de reintentar.' });
        }
        next();
    };
};
