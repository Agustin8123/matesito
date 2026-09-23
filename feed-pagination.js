const invalid = () => Object.assign(new Error('Paginación inválida'), { status: 400 });

async function queryFeed(req, db, sql, values = [], idColumn = 'id') {
    if (req.query.limit === undefined) return db.query(sql, values);
    const order = req.query.order || 'newest';
    const sensitive = req.query.sensitive === 'show';
    if (req.query.limit !== '12' || !['newest', 'oldest', 'reactions', 'reactions-asc'].includes(order)) throw invalid();
    const byReactions = order.startsWith('reactions');
    let cursor;
    if (req.query.cursor) {
        try { cursor = JSON.parse(Buffer.from(req.query.cursor, 'base64url').toString()); } catch { throw invalid(); }
        if (!cursor || cursor.order !== order || cursor.sensitive !== sensitive ||
            typeof cursor.id !== 'string' || !/^(?:[CFG]-)?\d+$/.test(cursor.id) ||
            typeof cursor.time !== 'string' || !Number.isFinite(Date.parse(cursor.time)) ||
            !Number.isFinite(cursor.total)) throw invalid();
    }
    const params = [...values];
    const bind = value => { params.push(value); return '$' + params.length; };
    const ascending = order === 'oldest' || order === 'reactions-asc';
    const operator = ascending ? '>' : '<';
    const direction = ascending ? 'ASC' : 'DESC';
    const total = byReactions ? 'COALESCE(score.total, 0)' : '0';
    const predicates = sensitive ? [] : ['feed.sensitive IS NOT TRUE'];
    if (cursor) {
        const time = bind(cursor.time), id = bind(cursor.id);
        const byTime = `(feed.created_at ${operator} ${time}::timestamptz OR (feed.created_at = ${time}::timestamptz AND feed.${idColumn} ${operator} ${id}))`;
        if (byReactions) {
            const score = bind(cursor.total);
            predicates.push(`(${total} ${operator} ${score} OR (${total} = ${score} AND ${byTime}))`);
        } else predicates.push(byTime);
    }
    const base = sql.replace(/ORDER BY[\s\S]*$/i, '').trim().replace(/;$/, '');
    const join = byReactions
        ? `LEFT JOIN (SELECT id, SUM(count) AS total FROM reactions GROUP BY id) score ON score.id = 'Matesito_post-' || feed.${idColumn}::text` : '';
    const result = await db.query(`SELECT feed.*, to_char(feed.created_at, 'YYYY-MM-DD"T"HH24:MI:SS.USTZH:TZM') AS cursor_time, ${total} AS reaction_total
        FROM (${base}) feed ${join}
        ${predicates.length ? 'WHERE ' + predicates.join(' AND ') : ''}
        ORDER BY ${byReactions ? total + ' ' + direction + ',' : ''} feed.created_at ${direction}, feed.${idColumn} ${direction} LIMIT 13`, params);
    const rows = result.rows.slice(0, 12);
    const last = rows.at(-1);
    const nextCursor = result.rows.length > 12 && last ? Buffer.from(JSON.stringify({
        id: String(last[idColumn]), time: last.cursor_time, total: Number(last.reaction_total), order, sensitive
    })).toString('base64url') : null;
    return { rows: rows.map(({ cursor_time, reaction_total, ...row }) => row), nextCursor };
}
function feedResponse(result, items = result.rows) {
    return 'nextCursor' in result ? { items, nextCursor: result.nextCursor } : items;
}
module.exports = { queryFeed, feedResponse };
