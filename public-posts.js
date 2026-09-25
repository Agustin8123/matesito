const linkifyPost = require('./public/scripts/post-links');
const fs = require('fs');
const path = require('path');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const publicMessages = "m.chat_or_group_id = 'F-' || f.id::text AND m.is_private IS NOT TRUE";
module.exports = function mountPublicPosts(app, db) {
    const origin = new URL(process.env.PUBLIC_URL || 'https://matesito.com.ar').origin;
    const template = fs.readFileSync(path.join(__dirname, 'public/html/informacion.html'), 'utf8');
    const wrap = handler => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
    const notFound = res => res.status(404).sendFile(path.join(__dirname, 'public/html/error.html'));
    app.get('/p/:id', wrap(async (req, res) => {
        const id = req.params.id;
        if (!/^(?:F-)?[1-9]\d{0,14}$/.test(id)) return notFound(res);
        const forum = id.startsWith('F-');
        const { rows } = forum
            ? await db.query(`SELECT m.id, m.content, m.media, m.media_type AS mediatype, m.sensitive, m.created_at, u.username, u.image FROM mensajes m JOIN foros f ON ${publicMessages} LEFT JOIN users u ON u.id = m.sender_id WHERE m.id = $1`, [id])
            : await db.query('SELECT p.id, p.username, p.content, p.media, p.mediatype, p.sensitive, p.created_at, u.image FROM posts p LEFT JOIN users u ON u.username = p.username WHERE p.id = $1', [id]);
        const post = rows[0];
        if (!post) return notFound(res);
        const canonical = origin + '/p/' + id;
        const title = 'Publicación de ' + (post.username || 'Usuario') + ' · Matesito';
        const description = post.sensitive ? 'Publicación marcada como sensible en Matesito.' : String(post.content || 'Una publicación con contenido multimedia en Matesito.').replace(/\s+/g, ' ').slice(0, 180);
        let media = '';
        let mediaURL;
        try { const u = new URL(post.media, origin); if (post.media && ['http:', 'https:'].includes(u.protocol)) mediaURL = u.href; } catch {}
        if (mediaURL) {
            const src = esc(mediaURL);
            if (post.mediatype?.startsWith('image/')) media = `<img class="preview-media" src="${src}" alt="Imagen de la publicación" decoding="async">`;
            else if (post.mediatype?.startsWith('video/')) media = `<video class="preview-media" controls preload="metadata" src="${src}"></video>`;
            else if (post.mediatype?.startsWith('audio/')) media = `<audio controls preload="metadata" src="${src}"></audio>`;
        }
        const date = new Date(post.created_at);
        const time = Number.isFinite(date.getTime()) ? `<time datetime="${date.toISOString()}">${esc(date.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }))}</time>` : '';
        let content = `<div class="post-text">${linkifyPost(post.content)}</div>${media}`;
        if (post.sensitive) content = `<details><summary>Contenido sensible · Mostrar publicación</summary>${content}</details>`;
        let avatar = '/res/default-avatar.svg';
        try { const u = new URL(post.image, origin); if (post.image && ['http:', 'https:'].includes(u.protocol)) avatar = u.href; } catch {}
        const main = `<main id="page-content" class="document-main shared-feed"><h1 class="visually-hidden">${esc(title)}</h1><article class="post postContainer"><div class="post-header"><div class="post-user-info"><span class="username"><img class="profile-pic-img" src="${esc(avatar)}" alt=""><span class="username-text">${esc(post.username || 'Usuario')}</span></span><span class="post-time">${time}</span></div></div><div class="post-content">${content}</div><div class="post-actions"><button type="button" class="toggle-reactions icon-button" aria-label="Mostrar u ocultar reacciones" title="Reacciones" onclick="toggleSharedReactions()"><img src="/res/react.svg" alt=""></button><button type="button" class="share-post-button icon-button" onclick="sharePost('${id}')" title="Copiar enlace de esta publicación" aria-label="Compartir publicación"><img src="/res/share.svg" alt=""></button></div><div id="sharedReactions" hidden><iframe data-src="/microReact.html?id=Matesito_post-${id}" title="Deja una reacción" loading="lazy"></iframe></div></article></main>`;

        let html = template.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(title)}</title>`)
            .replace(/<main\b[\s\S]*?<\/main>/, () => main)
            .replace('aria-current="page"', '')
            .replace('<span>Información</span>', '<span>Publicación</span>');
        const meta = `<link rel="canonical" href="${esc(canonical)}"><meta name="description" content="${esc(description)}"><meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}">`;
        html = html.replace('</head>', () => meta + (post.sensitive ? '<meta name="robots" content="noindex,follow">' : '') + (!post.sensitive && mediaURL && post.mediatype?.startsWith('image/') ? `<meta property="og:image" content="${esc(mediaURL)}">` : '') + '<link rel="stylesheet" href="/feedback.css"></head>');
        html = html.replace('</body>', '<script src="/feedback.js"></script><script src="/share-post.js"></script></body>');
        res.set('Cache-Control', 'no-cache').type('html').send(html);
    }));
    const xml = (res, root, body) => res.type('application/xml').set('Cache-Control', 'public, max-age=300').send(`<?xml version="1.0" encoding="UTF-8"?><${root} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</${root}>`);
    const publicSQL = `SELECT id::text AS id FROM posts WHERE sensitive IS NOT TRUE UNION ALL SELECT m.id::text AS id FROM mensajes m JOIN foros f ON ${publicMessages} WHERE m.sensitive IS NOT TRUE`;
    app.get('/sitemap.xml', wrap(async (req, res) => {
        const { rows } = await db.query(`SELECT COUNT(*) AS count FROM (${publicSQL}) publications`);
        const pages = Math.ceil(Number(rows[0].count) / 1000);
        const urls = [origin + '/sitemap-pages.xml', ...Array.from({ length: pages }, (_, i) => origin + '/sitemap-posts-' + (i + 1) + '.xml')];
        xml(res, 'sitemapindex', urls.map(url => `<sitemap><loc>${esc(url)}</loc></sitemap>`).join(''));
    }));
    app.get('/sitemap-pages.xml', (req, res) => xml(res, 'urlset', ['/', '/informacion', '/versiones', '/Ayuda', '/Terminos', '/app'].map(url => `<url><loc>${esc(origin + url)}</loc></url>`).join('')));
    app.get('/sitemap-posts-:page.xml', wrap(async (req, res) => {
        if (!/^[1-9]\d{0,6}$/.test(req.params.page)) return res.status(404).end();
        const { rows } = await db.query(`SELECT id FROM (${publicSQL}) publications ORDER BY id LIMIT 1000 OFFSET $1`, [(Number(req.params.page) - 1) * 1000]);
        if (!rows.length) return res.status(404).end();
        xml(res, 'urlset', rows.map(row => `<url><loc>${esc(origin + '/p/' + row.id)}</loc></url>`).join(''));
    }));
    app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /chat/\nDisallow: /group/\nDisallow: /cuenta\nDisallow: /microReact.html\nSitemap: ' + origin + '/sitemap.xml\n'));
};
