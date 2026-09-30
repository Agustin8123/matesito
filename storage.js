const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const express = require('express');
const sharp = require('sharp');
sharp.concurrency(1);
sharp.cache({ memory: 32 });

// Only inert media containers are accepted; never serve user-supplied HTML or SVG.
function detectMedia(b) {
    if (b.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return ['png', 'image/png'];
    if (b[0] === 255 && b[1] === 216 && b[2] === 255) return ['jpg', 'image/jpeg'];
    if (/^GIF8[79]a/.test(b.toString('ascii', 0, 6))) return ['gif', 'image/gif'];
    if (b.toString('ascii', 0, 4) === 'RIFF') {
        if (b.toString('ascii', 8, 12) === 'WEBP') return ['webp', 'image/webp'];
        if (b.toString('ascii', 8, 12) === 'WAVE') return ['wav', 'audio/wav'];
    }
    if (b.toString('ascii', 4, 8) === 'ftyp') {
        const brand = b.toString('ascii', 8, 12);
        if (['avif', 'avis'].includes(brand)) return ['avif', 'image/avif'];
        if (['M4A ', 'M4B '].includes(brand)) return ['m4a', 'audio/mp4'];
        if (['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V ', 'qt  '].includes(brand)) return ['mp4', 'video/mp4'];
    }
    if (b.toString('ascii', 0, 4) === 'OggS') return ['ogg', 'audio/ogg'];
    if (b.subarray(0, 4).equals(Buffer.from('1a45dfa3', 'hex')) && b.includes(Buffer.from('webm'))) return ['webm', 'video/webm'];
    if (b.toString('ascii', 0, 3) === 'ID3' || (b[0] === 255 && (b[1] & 0xe0) === 0xe0 && (b[1] & 6) !== 0)) return ['mp3', 'audio/mpeg'];
    return null;
}

module.exports = function mountStorage(app, requireAuth, db) {
    const root = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, 'uploads'));
    const maxMB = Number(process.env.UPLOAD_MAX_MB || 50);
    if (!Number.isFinite(maxMB) || maxMB <= 0) throw new Error('UPLOAD_MAX_MB debe ser positivo');
    const limit = Math.floor(maxMB * 1024 * 1024);
    fs.mkdirSync(root, { recursive: true });
    const pending = new Set();
    app.post('/api/uploads', requireAuth, async (req, res) => {
        if (pending.has(req.user.id) || pending.size >= 8) return res.status(429).json({ error: 'Hay otra subida en curso. Reintentá en unos segundos.' });
        if (Number(req.headers['content-length']) > limit) return res.status(413).json({ error: `El límite es ${maxMB} MB por archivo.` });
        if (!/^(image|audio|video)\//.test(req.headers['content-type'] || '')) return res.status(415).json({ error: 'Enviá una imagen, audio o video.' });
        const temp = path.join(root, '.' + randomUUID() + '.part');
        pending.add(req.user.id);
        let handle;
        const outputs = [];
        let persisted = false;
        let bytes = 0;
        const header = Buffer.alloc(4096);
        let headerLength = 0;
        let detected = null;
        let expired = false;
        const timer = setTimeout(() => { expired = true; req.destroy(); }, 120000);
        try {
            const space = await fs.promises.statfs(root);
            if (space.bavail * space.bsize < pending.size * limit + 128 * 1024 * 1024) throw Object.assign(new Error('No hay espacio disponible para subir archivos.'), { status: 507 });
            handle = await fs.promises.open(temp, 'wx', 0o600);
            for await (const chunk of req) {
                bytes += chunk.length;
                if (bytes > limit) throw Object.assign(new Error(`El límite es ${maxMB} MB por archivo.`), { status: 413 });
                if (headerLength < header.length) {
                    headerLength += chunk.copy(header, headerLength, 0, Math.min(chunk.length, header.length - headerLength));
                    detected = detectMedia(header.subarray(0, headerLength));
                }
                if (detected?.[1].startsWith('image/') && bytes > 10 * 1024 * 1024) throw Object.assign(new Error('Las imágenes pueden pesar hasta 10 MB.'), { status: 413 });
                await handle.writeFile(chunk);
            }
            let media = detected || detectMedia(header.subarray(0, headerLength));
            if (!media || !bytes || expired) throw Object.assign(new Error('Formato no admitido. Usá JPEG, PNG, GIF, WebP, AVIF, MP3, WAV, OGG, MP4 o WebM.'), { status: 415 });
            if (media[0] === 'mp4' && req.headers['content-type']?.split(';')[0] === 'audio/mp4') media = ['m4a', 'audio/mp4'];
            if (media[0] === 'webm' && req.headers['content-type']?.split(';')[0] === 'audio/webm') media = ['webm', 'audio/webm'];
            if (media[0] === 'ogg' && req.headers['content-type']?.split(';')[0] === 'video/ogg') media = ['ogv', 'video/ogg'];
            if (media[1].startsWith('image/') && bytes > 10 * 1024 * 1024) throw Object.assign(new Error('Las imágenes pueden pesar hasta 10 MB.'), { status: 413 });
            await handle.close(); handle = null;
            const name = randomUUID() + '.' + media[0];
            const output = path.join(root, name); outputs.push(output);
            if (media[1].startsWith('image/')) {
                try {
                    const input = sharp(temp, { animated: true, limitInputPixels: 40000000, failOn: 'warning' });
                    const metadata = await input.metadata();
                    if (!metadata.width || !metadata.height || (metadata.pages || 1) > 300) throw new Error('Imagen demasiado compleja');
                    await input.rotate().timeout({ seconds: 20 }).toFormat(media[0] === 'jpg' ? 'jpeg' : media[0]).toFile(output);
                    if ((metadata.pages || 1) === 1) for (const width of [384, 960]) {
                        const variant = output + '.' + width + '.webp'; outputs.push(variant);
                        await sharp(output).resize({ width, height: width, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toFile(variant);
                    }
                } catch { throw Object.assign(new Error('La imagen está dañada o supera los límites de dimensiones o animación.'), { status: 415 }); }
            } else {
                await require('./media-probe')(temp, media[1]);
                await fs.promises.rename(temp, output);
            }
            await db.query('INSERT INTO media_assets(name,owner_id) VALUES ($1,$2)', [name, req.user.id]);
            persisted = true;
            res.status(201).json({ url: '/uploads/' + name, mediaType: media[1] });
        } catch (error) {
            if (!res.destroyed && !res.headersSent) res.status(error.status || 500).json({ error: error.status ? error.message : 'No se pudo guardar el archivo. Reintentá.' });
        } finally {
            clearTimeout(timer);
            await handle?.close().catch(() => {});
            await fs.promises.unlink(temp).catch(() => {});
            if (!persisted) await Promise.all(outputs.map(file => fs.promises.unlink(file).catch(() => {})));
            pending.delete(req.user.id);
        }
    });
    app.use('/uploads', (req, res, next) => {
        if (!/^\/[0-9a-f-]{36}\.(png|jpg|gif|webp|avif|wav|mp3|ogg|ogv|m4a|mp4|webm)$/.test(req.path)) return res.status(404).end();
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
        next();
    }, require('./media-access').mediaAccess(db, requireAuth), async (req, res, next) => {
        if (!['384', '960'].includes(req.query.width)) return next();
        const variant = path.join(root, req.path.slice(1) + '.' + req.query.width + '.webp');
        try { await fs.promises.access(variant); res.sendFile(variant); } catch { next(); }
    }, express.static(root, { dotfiles: 'deny', fallthrough: false, maxAge: 0, setHeaders: res => {
        if (!res.getHeader('Cache-Control')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } }));
};

