const localName = value => /^\/uploads\/([0-9a-f-]{36}\.(?:png|jpg|gif|webp|avif|wav|mp3|ogg|ogv|m4a|mp4|webm))(?:\?.*)?$/.exec(value || '')?.[1];
const references = name => '/uploads/' + name;
async function claimMedia(client, req, value, type) {
    const gallery = require('./public/scripts/media-gallery');
    if (type === gallery.TYPE) {
        for (const item of gallery.parse(value, type).sort((a,b)=>a.url.localeCompare(b.url))) await claimMedia(client, req, item.url);
        return;
    }
    const name = localName(value); if (!name) return;
    const asset = (await client.query('SELECT owner_id FROM media_assets WHERE name=$1 FOR UPDATE', [name])).rows[0];
    if (asset && Number(asset.owner_id) !== Number(req.user.id)) throw Object.assign(new Error('El archivo no pertenece a tu cuenta. Subí tu propio adjunto.'), { status: 403 });
}
function mediaAccess(db, requireAuth) {
    return async (req, res, next) => {
        try {
            const name = req.path.slice(1);
            const asset = (await db.query('SELECT owner_id FROM media_assets WHERE name=$1', [name])).rows[0];
            if (!asset) return next(); // Archivos anteriores conservan su comportamiento.
            res.set('Cache-Control', 'private, no-store');
            const url = references(name);
            const publicRef = await db.query(`SELECT 1 WHERE EXISTS(SELECT 1 FROM posts WHERE publication_has_media(media,mediatype,$1))
                OR EXISTS(SELECT 1 FROM users WHERE image=$1)
                OR EXISTS(SELECT 1 FROM mensajes m JOIN foros f ON m.chat_or_group_id='F-'||f.id::text WHERE publication_has_media(m.media,m.media_type,$1) AND m.is_private IS NOT TRUE)`, [url]);
            if (publicRef.rows.length) return next();
            return requireAuth(req, res, async () => {
                try {
                    if (Number(asset.owner_id) === req.user.id) return next();
                    const visible = await db.query(`SELECT 1 FROM mensajes m WHERE publication_has_media(m.media,m.media_type,$1) AND (
                        m.chat_or_group_id IN (SELECT 'C-'||id::text FROM chats WHERE user1_id=$2 OR user2_id=$2)
                        OR ((m.chat_or_group_id IN (SELECT 'G-'||forum_or_group_id::text FROM participantes WHERE user_id=$2 AND is_group=TRUE)
                            OR m.chat_or_group_id IN (SELECT 'G-'||id::text FROM grupos WHERE owner_id=$2))
                            AND (m.sender_id=$2 OR (EXISTS(SELECT 1 FROM participantes p WHERE p.user_id=m.sender_id AND p.is_group=TRUE AND 'G-'||p.forum_or_group_id::text=m.chat_or_group_id)
                                AND EXISTS(SELECT 1 FROM seguir WHERE follower_id=$2 AND followed_id=m.sender_id)
                                AND EXISTS(SELECT 1 FROM seguir WHERE followed_id=$2 AND follower_id=m.sender_id))))) LIMIT 1`, [url, req.user.id]);
                    if (!visible.rows.length) return res.status(403).end();
                    next();
                } catch (error) { next(error); }
            });
        } catch (error) { next(error); }
    };
}
module.exports = { localName, claimMedia, mediaAccess };
