const { randomBytes, scrypt, timingSafeEqual } = require('crypto');
const { promisify } = require('util');
const bcrypt = require('bcryptjs');
const derive = promisify(scrypt);
async function hash(password) {
    const salt = randomBytes(16).toString('hex');
    const key = await derive(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    return 'scrypt-v1$' + salt + '$' + key.toString('hex');
}
async function compare(password, stored) {
    if (typeof stored !== 'string') return false;
    if (/^\$2[aby]\$/.test(stored)) return bcrypt.compare(password, stored);
    const match = /^scrypt-v1\$([0-9a-f]{32})\$([0-9a-f]{128})$/.exec(stored);
    if (!match) return false;
    const key = await derive(password, match[1], 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    return timingSafeEqual(key, Buffer.from(match[2], 'hex'));
}
module.exports = { hash, compare, needsUpgrade: stored => !stored.startsWith('scrypt-v1$') };
