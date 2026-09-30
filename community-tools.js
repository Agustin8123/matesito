// Edición, denuncias y bloqueos. Todas las decisiones de permisos se toman en el servidor.
module.exports = function mountCommunityTools(app, { db, requireAuth, reactionAccess, transaction, io, emitPrivateUpdate }) {
    const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
    const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
    const admins = new Set((process.env.ADMIN_USER_IDS || '').split(',').map(x => x.trim()).filter(Boolean));
    const access = (req, res, next) => {
        req.targetId = req.params.id;
        req.params.id = 'Matesito_post-' + req.targetId;
        reactionAccess(req, res, next);
    };
    async function target(client, id, lock = false) {
        if (!/^(?:[CFG]-)?[1-9]\d{0,15}$/.test(id)) fail(400, 'Publicación inválida');
        const message = /^[CFG]-/.test(id);
        const result = await client.query(message
            ? 'SELECT id, sender_id AS author_id, content, media, sensitive, chat_or_group_id AS context FROM mensajes WHERE id=$1' + (lock ? ' FOR UPDATE' : '')
            : 'SELECT id, username, content, media, sensitive FROM posts WHERE id=$1' + (lock ? ' FOR UPDATE' : ''), [id]);
        const row = result.rows[0];
        if (!row) fail(404, 'La publicación ya no existe');
        return { ...row, message };
    }
    async function canModerate(client, row, user) {
        if (admins.has(String(user.id))) return true;
        if (!row.context?.startsWith('F-')) return false;
        return (await client.query('SELECT 1 FROM foros WHERE id=$1 AND owner_id=$2', [row.context.slice(2), user.id])).rows.length > 0;
    }
    async function announce(row, id, deleted) {
        const payload = { id, deleted };
        if (!row.context || row.context.startsWith('F-')) io.emit('publicationChanged', payload);
        else await emitPrivateUpdate(row.context, row.author_id, 'publicationChanged', payload);
    }
    app.put('/api/publications/:id', requireAuth, access, wrap(async (req, res) => {
        const id = req.targetId;
        const row = await transaction(async client => {
            const row = await target(client, id, true);
            if (row.message ? Number(row.author_id) !== req.user.id : row.username !== req.user.username) fail(403, 'Solo podés editar tus publicaciones');
            const { content, sensitive } = req.body;
            if (typeof content !== 'string' || content.length > 10000 || (!content.trim() && !row.media) || typeof sensitive !== 'boolean') fail(400, 'Revisá el texto y el contenido sensible');
            await client.query(`UPDATE ${row.message ? 'mensajes' : 'posts'} SET content=$1,sensitive=$2 WHERE id=$3`, [content.trim(), sensitive, id]);
            return row;
        });
        await announce(row, id, false); res.json({ id });
    }));
    async function remove(client, row, id) {
        await client.query('DELETE FROM user_reactions WHERE post_id=$1', ['Matesito_post-' + id]);
        await client.query('DELETE FROM reactions WHERE id=$1', ['Matesito_post-' + id]);
        await client.query('DELETE FROM notificaciones WHERE referencia_id=$1', [id]);
        await client.query(`DELETE FROM ${row.message ? 'mensajes' : 'posts'} WHERE id=$1`, [id]);
        await client.query("UPDATE content_reports SET status='removed' WHERE target_id=$1", [id]);
    }
    app.delete('/api/publications/:id', requireAuth, access, wrap(async (req, res) => {
        const id = req.targetId;
        const row = await transaction(async client => {
            const row = await target(client, id, true);
            const own = row.message ? Number(row.author_id) === req.user.id : row.username === req.user.username;
            if (!own && !await canModerate(client, row, req.user)) fail(403, 'No podés eliminar esta publicación');
            await remove(client, row, id); return row;
        });
        await announce(row, id, true); res.json({ id });
    }));
    app.post('/api/reports/:id', requireAuth, access, wrap(async (req, res) => {
        const row = await target(db, req.targetId);
        // La moderación de mensajes privados no expone su contenido a terceros.
        if (row.context && !row.context.startsWith('F-')) fail(400, 'Para una conversación privada, bloqueá a la cuenta desde su perfil');
        const reason = req.body.reason;
        if (typeof reason !== 'string' || reason.trim().length < 5 || reason.length > 1000) fail(400, 'Contanos el motivo (entre 5 y 1000 caracteres)');
        await db.query(`INSERT INTO content_reports (reporter_id,target_id,reason,forum_id) VALUES ($1,$2,$3,$4)
            ON CONFLICT (reporter_id,target_id) DO UPDATE SET reason=EXCLUDED.reason,status='pending'`, [req.user.id, req.targetId, reason.trim(), row.context?.slice(2) || null]);
        res.status(201).json({ message: 'Denuncia enviada para revisión' });
    }));
    app.get('/api/moderation', requireAuth, wrap(async (req, res) => {
        const result = await db.query(`SELECT r.id,r.target_id,r.reason,r.created_at FROM content_reports r
            WHERE r.status='pending' AND ($2::boolean OR r.forum_id IN (SELECT id FROM foros WHERE owner_id=$1))
            ORDER BY r.id LIMIT 50`, [req.user.id, admins.has(String(req.user.id))]);
        res.json(result.rows);
    }));
    app.put('/api/moderation/:id', requireAuth, wrap(async (req, res) => {
        if (!/^\d+$/.test(req.params.id) || !['dismiss', 'remove'].includes(req.body.action)) fail(400, 'Acción inválida');
        let removed;
        await transaction(async client => {
            const report = (await client.query('SELECT * FROM content_reports WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
            if (!report) fail(404, 'Denuncia no encontrada');
            const owner = report.forum_id && (await client.query('SELECT 1 FROM foros WHERE id=$1 AND owner_id=$2', [report.forum_id, req.user.id])).rows.length;
            if (!owner && !admins.has(String(req.user.id))) fail(403, 'Acceso denegado');
            if (req.body.action === 'remove') {
                const row = await target(client, report.target_id, true);
                await remove(client, row, report.target_id); removed = { row, id: report.target_id };
            } else await client.query("UPDATE content_reports SET status='dismissed' WHERE id=$1", [report.id]);
        });
        if (removed) await announce(removed.row, removed.id, true);
        res.json({ success: true });
    }));
    app.get('/api/blocks', requireAuth, wrap(async (req, res) => res.json((await db.query(
        'SELECT u.id,u.username FROM user_blocks b JOIN users u ON u.id=b.blocked_id WHERE b.user_id=$1 ORDER BY u.username', [req.user.id])).rows)));
    app.post('/api/blocks/:id', requireAuth, wrap(async (req, res) => {
        if (!/^[1-9]\d*$/.test(req.params.id) || Number(req.params.id) === req.user.id) fail(400, 'Cuenta inválida');
        await transaction(async client => {
            if (!(await client.query('SELECT 1 FROM users WHERE id=$1', [req.params.id])).rows.length) fail(404, 'Cuenta no encontrada');
            await client.query('INSERT INTO user_blocks(user_id,blocked_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, req.params.id]);
            await client.query('DELETE FROM seguir WHERE (follower_id=$1 AND followed_id=$2) OR (follower_id=$2 AND followed_id=$1)', [req.user.id, req.params.id]);
        });
        res.json({ success: true });
    }));
    app.delete('/api/blocks/:id', requireAuth, wrap(async (req, res) => {
        if (!/^[1-9]\d*$/.test(req.params.id)) fail(400, 'Cuenta inválida');
        await db.query('DELETE FROM user_blocks WHERE user_id=$1 AND blocked_id=$2', [req.user.id, req.params.id]);
        res.json({ success: true });
    }));
};
