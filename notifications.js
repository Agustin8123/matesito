module.exports = function mountNotifications(app, { db, requireAuth }) {
    app.get('/notificaciones/:user_id', requireAuth, async (req, res, next) => {
        if (String(req.user.id) !== req.params.user_id) return res.status(403).json({ error: 'Acceso denegado' });
        try {
            const result = await db.query(`SELECT n.id,n.tipo,n.referencia_id,n.chat_or_group_id,n.leido,n.reaction_id,
                actor.username AS actor, COALESCE(f.name,g.name,peer.username,p.username,'Publicación') AS nombre
                FROM notificaciones n
                LEFT JOIN mensajes m ON m.id=n.referencia_id AND m.chat_or_group_id=n.chat_or_group_id
                LEFT JOIN posts p ON p.id::text=n.referencia_id AND n.chat_or_group_id='P-'||p.id::text
                LEFT JOIN foros f ON m.chat_or_group_id='F-'||f.id::text
                LEFT JOIN grupos g ON m.chat_or_group_id='G-'||g.id::text
                LEFT JOIN chats c ON m.chat_or_group_id='C-'||c.id::text
                LEFT JOIN users peer ON peer.id=CASE WHEN c.user1_id=$1 THEN c.user2_id ELSE c.user1_id END
                LEFT JOIN users actor ON actor.id=n.actor_id
                WHERE n.user_id=$1 AND n.leido=FALSE
                AND NOT EXISTS (SELECT 1 FROM user_blocks b WHERE
                    (b.user_id=$1 AND b.blocked_id=COALESCE(n.actor_id,m.sender_id)) OR
                    (b.blocked_id=$1 AND b.user_id=COALESCE(n.actor_id,m.sender_id)))
                AND ((p.id IS NOT NULL AND n.tipo='reaccion')
                    OR (f.id IS NOT NULL AND m.is_private IS NOT TRUE)
                    OR (c.id IS NOT NULL AND (c.user1_id=$1 OR c.user2_id=$1))
                    OR (g.id IS NOT NULL AND (g.owner_id=$1 OR EXISTS(SELECT 1 FROM participantes WHERE user_id=$1 AND forum_or_group_id=g.id AND is_group=TRUE))
                        AND (m.sender_id=$1 OR (EXISTS(SELECT 1 FROM participantes WHERE user_id=m.sender_id AND forum_or_group_id=g.id AND is_group=TRUE)
                            AND EXISTS(SELECT 1 FROM seguir WHERE follower_id=$1 AND followed_id=m.sender_id)
                            AND EXISTS(SELECT 1 FROM seguir WHERE followed_id=$1 AND follower_id=m.sender_id)))))
                ORDER BY n.id DESC LIMIT 100`, [req.user.id]);
            res.json(result.rows);
        } catch (error) { next(error); }
    });
};
