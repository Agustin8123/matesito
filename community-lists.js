module.exports = function mountCommunityLists(app, { db, requireAuth }) {
    const routes = [
        ['/foros', false, 'SELECT f.id,f.name,f.description,u.username AS "ownerName" FROM foros f JOIN users u ON u.id=f.owner_id', []],
        ['/userCreatedForums/:userId', true, 'SELECT id,name,description FROM foros WHERE owner_id=$1', ['userId']],
        ['/userForums/:userId', true, 'SELECT f.id,f.name,f.description FROM foros f JOIN participantes p ON p.forum_or_group_id=f.id AND p.is_group=FALSE WHERE p.user_id=$1', ['userId']],
        ['/followedUsers/:followerId', true, 'SELECT u.id,u.username FROM users u JOIN seguir s ON s.followed_id=u.id WHERE s.follower_id=$1', ['followerId']],
        ['/grupos-creados/:ownerId', true, 'SELECT id,name,description,invite_code FROM grupos WHERE owner_id=$1', ['ownerId']],
        ['/grupos-usuario/:userId', true, 'SELECT g.id,g.name,g.description,g.invite_code FROM grupos g WHERE g.owner_id=$1 OR EXISTS(SELECT 1 FROM participantes p WHERE p.user_id=$1 AND p.forum_or_group_id=g.id AND p.is_group=TRUE)', ['userId']],
        ['/chats', true, 'SELECT c.id,u.username FROM chats c JOIN users u ON u.id=CASE WHEN c.user1_id=$1 THEN c.user2_id ELSE c.user1_id END WHERE c.user1_id=$1 OR c.user2_id=$1', []]
    ];
    for (const [route, privateList, sql, parameters] of routes) app.get(route, privateList ? requireAuth : (req, res, next) => next(), async (req, res, next) => {
        try {
            if (parameters.length && String(req.user.id) !== req.params[parameters[0]]) return res.status(403).json({ error: 'Acceso denegado' });
            const offset = Number(req.query.offset || 0);
            if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) return res.status(400).json({ error: 'Paginación inválida' });
            const args = privateList ? [req.user.id] : [];
            args.push(offset);
            const rows = (await db.query(`SELECT * FROM (${sql}) entries ORDER BY id LIMIT 41 OFFSET $${args.length}`, args)).rows;
            if (rows.length > 40) res.set('X-Next-Offset', String(offset + 40));
            res.json(rows.slice(0, 40));
        } catch (error) { next(error); }
    });
};
