const MediaGallery = require('./public/scripts/media-gallery');
const linkifyPost = require('./public/scripts/post-links');
const renderPage = require('./page-renderer');
const seo = require('./public-seo');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const publicMessages = "m.chat_or_group_id = 'F-' || f.id::text AND m.is_private IS NOT TRUE";
module.exports = function mountPublicPosts(app, db) {
    const origin = new URL(process.env.PUBLIC_URL || 'https://matesito.com.ar').origin;
    const template = seo.shell(renderPage('informacion'));
    const sitemapCache = new Map();
    app.use((req,res,next) => {
        if (!/^\/sitemap(?:-pages|-(?:posts|profiles)-[1-9]\d*)?\.xml$/.test(req.path)) return next();
        const hit = sitemapCache.get(req.path);
        if (hit && Date.now() - hit.at < 300000) return res.type('application/xml').set('Cache-Control','public, max-age=300').send(hit.body);
        const send = res.send.bind(res);
        res.send = body => {
            if (res.statusCode === 200 && typeof body === 'string') {
                if (sitemapCache.size >= 100) sitemapCache.delete(sitemapCache.keys().next().value);
                sitemapCache.set(req.path,{ body,at:Date.now() });
            }
            return send(body);
        }; next();
    });
    const wrap = handler => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
    const notFound = res => res.status(404).type('html').send(renderPage('error'));
    app.get('/p/:id', wrap(async (req, res) => {
        const id = req.params.id;
        if (!/^(?:F-)?[1-9]\d{0,14}$/.test(id) || (!id.startsWith('F-') && Number(id)>2147483647)) return notFound(res);
        const forum = id.startsWith('F-');
        const { rows } = forum
            ? await db.query(`SELECT m.id, m.content, m.media, m.media_type AS mediatype, m.sensitive, m.created_at, u.username, u.image FROM mensajes m JOIN foros f ON ${publicMessages} LEFT JOIN users u ON u.id = m.sender_id WHERE m.id = $1`, [id])
            : await db.query('SELECT p.id, p.username, p.content, p.media, p.mediatype, p.sensitive, p.created_at, u.image FROM posts p LEFT JOIN users u ON u.username = p.username WHERE p.id = $1', [id]);
        const post = rows[0];
        if (!post) return notFound(res);
        const canonical = origin + '/p/' + id;
        const title = 'Publicación de ' + (post.username || 'Usuario') + ' · Matesito';
        const description = post.sensitive ? 'Publicación marcada como sensible en Matesito.' : seo.summary(post.content, 'Publicación de ' + (post.username || 'Usuario') + ' con fotos, videos o audio en Matesito.');
        let media = '';
        let mediaURL;
        try { const u = new URL(post.media, origin); if (post.media && ['http:', 'https:'].includes(u.protocol)) mediaURL = u.href; } catch {}
        if (mediaURL) {
            const src = esc(mediaURL);
            if (post.mediatype?.startsWith('image/')) media = `<img class="preview-media" src="${src}" alt="Imagen de la publicación" decoding="async">`;
            else if (post.mediatype?.startsWith('video/')) media = `<video class="preview-media" controls ${MediaGallery.videoAttributes(post.media)}></video>`;
            else if (post.mediatype?.startsWith('audio/')) media = `<audio controls preload="metadata" src="${src}"></audio>`;
        }
        if (post.mediatype === MediaGallery.TYPE) {
            media = MediaGallery.render(post.media, post.mediatype);
            const first = MediaGallery.parse(post.media, post.mediatype).find(item => item.mediaType.startsWith('image/'));
            mediaURL = first ? new URL(first.url, origin).href : undefined;
        }
        const date = new Date(post.created_at);
        const time = Number.isFinite(date.getTime()) ? `<time datetime="${date.toISOString()}">${esc(date.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }))}</time>` : '';
        let content = `<div class="post-text">${linkifyPost(post.content)}</div>${media}`;
        if (post.sensitive) content = `<details><summary>Contenido sensible · Mostrar publicación</summary>${content}</details>`;
        let avatar = '/res/default-avatar.svg';
        try { const u = new URL(post.image, origin); if (post.image && ['http:', 'https:'].includes(u.protocol)) avatar = u.href; } catch {}
        const main = `<main id="page-content" class="document-main shared-feed"><h1 class="visually-hidden">${esc(title)}</h1><article class="post postContainer"><div class="post-header"><div class="post-user-info"><span class="username"><img class="profile-pic-img" src="${esc(avatar)}" alt=""><span class="username-text">${esc(post.username || 'Usuario')}</span></span><span class="post-time">${time}</span></div></div><div class="post-content">${content}</div><div class="post-actions"><button type="button" class="toggle-reactions icon-button" aria-label="Mostrar u ocultar reacciones" title="Reacciones" onclick="toggleSharedReactions()"><img src="/res/react.svg" alt=""></button><button type="button" class="share-post-button icon-button" onclick="sharePost('${id}')" title="Copiar enlace de esta publicación" aria-label="Compartir publicación"><img src="/res/share.svg" alt=""></button></div><div id="sharedReactions" hidden><mate-reactions data-id="Matesito_post-${id}"></mate-reactions></div></article></main>`;

        let html = template.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(title)}</title>`)
            .replace(/<main\b[\s\S]*?<\/main>/, () => main)
            .replace('aria-current="page"', '')
            .replace('<span>Información</span>', '<span>Publicación</span>');
        const meta = `<link rel="canonical" href="${esc(canonical)}"><meta name="description" content="${esc(description)}"><meta property="og:type" content="article"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}">`;
        html = html.replace('</head>', () => meta + (post.sensitive ? '<meta name="robots" content="noindex,follow">' : '') + (!post.sensitive && mediaURL && (post.mediatype?.startsWith('image/') || post.mediatype === MediaGallery.TYPE) ? `<meta property="og:image" content="${esc(mediaURL)}">` : '') + '<link rel="stylesheet" href="/feedback.css"></head>');
        html = html.replace('</body>', '<script src="/media-gallery.js"></script><script src="/feedback.js"></script><script src="/socket.io/socket.io.js"></script><script src="/reactions.js"></script><script src="/share-post.js"></script></body>');
        html = html.replace('<div class="post-header">', '<div class="post-header" data-nosnippet>')
            .replace('<div class="post-actions">', '<div class="post-actions" data-nosnippet>')
            .replace('<div id="sharedReactions"', '<div data-nosnippet id="sharedReactions"')
            .replace('<h1 class="visually-hidden">', '<h1 class="visually-hidden"><span data-nosnippet>')
            .replace('</h1>', '</span></h1>');
        if (post.username) html = html.replace('<span class="username-text">' + esc(post.username) + '</span>', () => '<a class="username-text" href="/u/' + esc(encodeURIComponent(post.username)) + '">' + esc(post.username) + '</a>');
        if (!post.sensitive) html = html.replace('</head>', () => seo.structured({ '@context': 'https://schema.org', '@type': 'SocialMediaPosting', url: canonical, headline: title, description, articleBody: String(post.content || ''), author: { '@type': 'Person', name: post.username || 'Usuario', ...(post.username ? { url: origin + '/u/' + encodeURIComponent(post.username) } : {}) }, ...(Number.isFinite(date.getTime()) ? { datePublished: date.toISOString() } : {}) }) + '</head>');
        res.set('Cache-Control', 'no-cache').type('html').send(require('./public-app-page')(html,{kind:'post',id}));
    }));
    app.get('/u/:username', wrap(async (req, res) => {
        const username = req.params.username;
        const before = req.query.before;
        if (!username || username.length > 25 || (before !== undefined && (typeof before !== 'string' || !/^[1-9]\d{0,9}$/.test(before) || Number(before) > 2147483647))) return notFound(res);
        const user = (await db.query('SELECT username, image, description FROM users WHERE username=$1', [username])).rows[0];
        if (!user) return notFound(res);
        const path = '/u/' + encodeURIComponent(user.username);
        const canonical = origin + path + (before ? '?before=' + before : '');
        const title = user.username + ' · Perfil en Matesito';
        const description = seo.summary(user.description, 'Conocé a ' + user.username + ' y sus publicaciones públicas en Matesito.');
        const rows = (await db.query('SELECT id, content, media, mediatype, created_at FROM posts WHERE username=$1 AND sensitive IS NOT TRUE AND ($2::integer IS NULL OR id<$2) ORDER BY id DESC LIMIT 13', [user.username, before || null])).rows;
        const posts = rows.slice(0, 12);
        let avatar = '/res/default-avatar.svg';
        try { const url = new URL(user.image, origin); if (user.image && ['http:', 'https:'].includes(url.protocol)) avatar = url.href; } catch {}
        const cards = posts.map(post => {
            const date = new Date(post.created_at);
            const time = Number.isFinite(date.getTime()) ? `<time datetime="${date.toISOString()}">${esc(date.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }))}</time>` : '';
            return `<article class="post postContainer"><div class="post-header" data-nosnippet><a class="username" href="${esc(path)}">${esc(user.username)}</a><span class="post-time">${time}</span></div><div class="post-text">${linkifyPost(post.content)}</div>${MediaGallery.render(post.media, post.mediatype)}<div class="public-profile-actions" data-nosnippet><a href="/p/${esc(post.id)}">Ver publicación y reacciones →</a></div></article>`;
        }).join('');
        const pagination = `<div class="public-profile-pagination" data-nosnippet>${before ? `<a href="${esc(path)}">Volver a las más recientes</a>` : ''}${rows.length > 12 ? `<a href="${esc(path)}?before=${esc(posts[posts.length - 1].id)}" rel="next">Ver más publicaciones</a>` : ''}</div>`;
        const main = `<main id="page-content" class="document-main shared-feed public-profile"><section class="post postContainer public-profile-heading"><img class="public-profile-avatar" src="${esc(avatar)}" alt="Foto de ${esc(user.username)}"><h1>${esc(user.username)}</h1><div class="post-text">${linkifyPost(user.description || 'Este es el perfil público de ' + user.username + ' en Matesito.')}</div></section><h2>Publicaciones públicas</h2>${cards || '<p>No hay publicaciones públicas para mostrar.</p>'}${pagination}</main>`;
        const meta = `<link rel="canonical" href="${esc(canonical)}"><meta name="description" content="${esc(description)}"><meta property="og:type" content="profile"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(new URL(avatar, origin).href)}">${before ? '<meta name="robots" content="noindex,follow">' : ''}`;
        const data = seo.structured({ '@context': 'https://schema.org', '@type': 'ProfilePage', url: canonical, mainEntity: { '@type': 'Person', name: user.username, description: String(user.description || ''), url: origin + path } });
        const html = template.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(title)}</title>`)
            .replace(/<main\b[\s\S]*?<\/main>/, () => main).replace('aria-current="page"', '')
            .replace('<span>Información</span>', '<span>Perfil</span>')
            .replace('</head>', () => meta + data + '</head>')
            .replace('</body>', '<script src="/media-gallery.js"></script></body>');
        res.set('Cache-Control', 'no-cache').type('html').send(require('./public-app-page')(html,{kind:'profile',username:user.username,before:before||null}));
    }));
    const xml = (res, root, body) => res.type('application/xml').set('Cache-Control', 'public, max-age=300').send(`<?xml version="1.0" encoding="UTF-8"?><${root} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</${root}>`);
    const publicSQL = `SELECT id::text AS id FROM posts WHERE sensitive IS NOT TRUE UNION ALL SELECT m.id::text AS id FROM mensajes m JOIN foros f ON ${publicMessages} WHERE m.sensitive IS NOT TRUE`;
    app.get('/sitemap.xml', wrap(async (req, res) => {
        const { rows } = await db.query(`SELECT COUNT(*) AS count FROM (${publicSQL}) publications`);
        const pages = Math.ceil(Number(rows[0].count) / 1000);
        const profiles = Math.ceil(Number((await db.query('SELECT COUNT(*) AS count FROM users')).rows[0].count) / 1000);
        const urls = [origin + '/sitemap-pages.xml', ...Array.from({ length: pages }, (_, i) => origin + '/sitemap-posts-' + (i + 1) + '.xml'), ...Array.from({ length: profiles }, (_, i) => origin + '/sitemap-profiles-' + (i + 1) + '.xml')];
        xml(res, 'sitemapindex', urls.map(url => `<sitemap><loc>${esc(url)}</loc></sitemap>`).join(''));
    }));
    app.get('/sitemap-pages.xml', (req, res) => xml(res, 'urlset', ['/', '/informacion', '/versiones', '/Ayuda', '/Terminos', '/app'].map(url => `<url><loc>${esc(origin + url)}</loc></url>`).join('')));
    app.get('/sitemap-posts-:page.xml', wrap(async (req, res) => {
        if (!/^[1-9]\d{0,6}$/.test(req.params.page)) return res.status(404).end();
        const { rows } = await db.query(`SELECT id FROM (${publicSQL}) publications ORDER BY id LIMIT 1000 OFFSET $1`, [(Number(req.params.page) - 1) * 1000]);
        if (!rows.length) return res.status(404).end();
        xml(res, 'urlset', rows.map(row => `<url><loc>${esc(origin + '/p/' + row.id)}</loc></url>`).join(''));
    }));
    app.get('/sitemap-profiles-:page.xml', wrap(async (req, res) => {
        if (!/^[1-9]\d{0,6}$/.test(req.params.page)) return res.status(404).end();
        const { rows } = await db.query('SELECT username FROM users ORDER BY id LIMIT 1000 OFFSET $1', [(Number(req.params.page) - 1) * 1000]);
        if (!rows.length) return res.status(404).end();
        xml(res, 'urlset', rows.map(row => `<url><loc>${esc(origin + '/u/' + encodeURIComponent(row.username))}</loc></url>`).join(''));
    }));
    app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /chat/\nDisallow: /group/\nDisallow: /cuenta\nDisallow: /microReact.html\nSitemap: ' + origin + '/sitemap.xml\n'));
};
