const http = require('http');
const https = require('https');

const HOP_BY_HOP = new Set([
    'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
    'te', 'trailer', 'transfer-encoding', 'upgrade', 'cookie', 'authorization'
]);

function configuredTarget() {
    const value = process.env.LABS_OCTOPRINT_URL;
    if (!value) return null;
    let target;
    try { target = new URL(value); } catch { throw new Error('LABS_OCTOPRINT_URL no es una URL válida'); }
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
        throw new Error('LABS_OCTOPRINT_URL debe ser una URL HTTP(S) sin credenciales');
    }
    if (!process.env.LABS_OCTOPRINT_API_KEY) {
        throw new Error('Falta LABS_OCTOPRINT_API_KEY para habilitar el laboratorio');
    }
    return target;
}

function safeHeaders(headers, target) {
    const result = {};
    for (const [key, value] of Object.entries(headers)) {
        if (value !== undefined && !HOP_BY_HOP.has(key.toLowerCase()) && key.toLowerCase() !== 'accept-encoding') result[key] = value;
    }
    result.host = target.host;
    const publicOrigin = new URL(process.env.PUBLIC_URL || `http://${headers.host || 'localhost'}`);
    result['x-forwarded-host'] = publicOrigin.host;
    result['x-forwarded-proto'] = publicOrigin.protocol.slice(0, -1);
    result['x-forwarded-prefix'] = '/labs/octoprint';
    result['x-script-name'] = '/labs/octoprint';
    result['x-api-key'] = process.env.LABS_OCTOPRINT_API_KEY;
    return result;
}

function prefixedLocation(location, target) {
    if (location.startsWith(target.origin)) return location.replace(target.origin, '/labs/octoprint');
    return location.startsWith('/') ? `/labs/octoprint${location}` : location;
}

function rewriteHtml(source) {
    return source
        .replace(/(href|src)=(['"])\/(?!labs\/octoprint\/)/gi, '$1=$2/labs/octoprint/')
        .replace(/var\s+BASE_URL\s*=\s*(['"])\/\1/g, 'var BASE_URL = "/labs/octoprint/"')
        .replace(/var\s+REDIRECT_URL\s*=\s*(['"])\//g, 'var REDIRECT_URL = "/labs/octoprint/');
}

module.exports = function labsProxy(req, res) {
    let target;
    try { target = configuredTarget(); } catch (error) { return res.status(503).json({ error: error.message }); }
    if (!target) return res.status(503).json({ error: 'El laboratorio todavía no está configurado en este servidor.' });

    const client = target.protocol === 'https:' ? https : http;
    const upstream = client.request({
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || undefined,
        method: req.method,
        path: req.url || '/',
        headers: safeHeaders(req.headers, target),
        timeout: 15000
    }, upstreamResponse => {
        const headers = {};
        const contentType = String(upstreamResponse.headers['content-type'] || '').toLowerCase();
        for (const [key, value] of Object.entries(upstreamResponse.headers)) {
            if (value === undefined || HOP_BY_HOP.has(key.toLowerCase()) || key.toLowerCase() === 'set-cookie') continue;
            if (key.toLowerCase() === 'location' && typeof value === 'string') {
                headers[key] = prefixedLocation(value, target);
            } else headers[key] = value;
        }
        if (contentType.includes('text/html')) delete headers['content-length'];
        headers['cache-control'] = 'no-store';
        headers['x-content-type-options'] = 'nosniff';
        if (!contentType.includes('text/html')) {
            res.writeHead(upstreamResponse.statusCode || 502, headers);
            return upstreamResponse.pipe(res);
        }
        const body = [];
        upstreamResponse.on('data', chunk => body.push(chunk));
        upstreamResponse.on('end', () => {
            res.writeHead(upstreamResponse.statusCode || 502, headers);
            res.end(rewriteHtml(Buffer.concat(body).toString('utf8')));
        });
    });
    upstream.on('timeout', () => upstream.destroy(new Error('El laboratorio no respondió a tiempo')));
    upstream.on('error', () => {
        if (!res.headersSent) res.status(502).json({ error: 'No se pudo conectar con el laboratorio.' });
        else res.destroy();
    });
    req.pipe(upstream);
};
