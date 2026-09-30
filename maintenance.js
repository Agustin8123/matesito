// Ejecutar primero sin --apply para revisar candidatos. Solo administra archivos registrados por esta versión.
require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const { Pool } = require('pg');
const root = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, 'uploads'));
const config = process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
    host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres', password: process.env.DB_PASSWORD, database: process.env.DB_NAME || 'matesito_8s'
};
if (process.env.DB_SSL === 'true' || (process.env.NODE_ENV === 'production' && process.env.DB_SSL !== 'false')) config.ssl = { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' };
const unused = `NOT EXISTS(SELECT 1 FROM posts WHERE media='/uploads/'||a.name)
    AND NOT EXISTS(SELECT 1 FROM mensajes WHERE media='/uploads/'||a.name)
    AND NOT EXISTS(SELECT 1 FROM users WHERE image='/uploads/'||a.name)`;
async function main() {
    const db = new Pool(config), apply = process.argv.includes('--apply');
    try {
        const candidates = (await db.query(`SELECT a.name FROM media_assets a WHERE created_at<now()-interval '7 days' AND ${unused} ORDER BY created_at LIMIT 1000`)).rows;
        for (const { name } of candidates) {
            if (!/^[0-9a-f-]{36}\.(png|jpg|gif|webp|avif|wav|mp3|ogg|ogv|m4a|mp4|webm)$/.test(name)) continue;
            if (!apply) { console.log('Sin referencias:', name); continue; }
            const client = await db.connect();
            try {
                await client.query('BEGIN');
                const locked = await client.query('SELECT name FROM media_assets WHERE name=$1 FOR UPDATE', [name]);
                if (!locked.rows.length || !(await client.query(`SELECT 1 FROM media_assets a WHERE name=$1 AND ${unused}`, [name])).rows.length) { await client.query('ROLLBACK'); continue; }
                for (const suffix of ['', '.384.webp', '.960.webp']) {
                    const target = path.resolve(root, name + suffix);
                    if (path.dirname(target) !== root) throw new Error('Ruta fuera del almacenamiento');
                    await fs.unlink(target).catch(error => { if (error.code !== 'ENOENT') throw error; });
                }
                await client.query('DELETE FROM media_assets WHERE name=$1', [name]);
                await client.query('COMMIT'); console.log('Retirado:', name);
            } catch (error) { await client.query('ROLLBACK'); throw error; }
            finally { client.release(); }
        }
        if (apply) await db.query("DELETE FROM publication_requests WHERE created_at<now()-interval '30 days'");
        console.log(apply ? 'Mantenimiento terminado.' : 'Simulación terminada. No se borró ningún archivo.');
    } finally { await db.end(); }
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
