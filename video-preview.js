const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');
const run = promisify(execFile);
const jobs = new Map();
const failures = new Map();
let active = 0;
const waiting = [];
const acquire = () => active < 2 ? (active++, Promise.resolve()) : new Promise(resolve => waiting.push(resolve));
const release = () => { const next = waiting.shift(); if (next) next(); else active--; };
module.exports = async function videoPreview(file) {
 const poster = file + '.poster.jpg';
 try { await fs.promises.access(poster); return poster; } catch {}
 if (jobs.has(file)) return jobs.get(file);
 if (jobs.size >= 32 || Date.now() - (failures.get(file) || 0) < 60000) throw new Error('Vista previa no disponible');
 const task = (async () => {
  const temp = poster + '.part.jpg';
  await acquire();
  try {
   await run(process.env.FFMPEG_PATH || 'ffmpeg', ['-nostdin','-v','error','-y','-threads','1','-filter_threads','1','-protocol_whitelist','file,pipe','-i',file,'-frames:v','1','-vf','scale=min(960\\,iw):-2','-threads','1',temp], { timeout: 20000, maxBuffer: 65536, windowsHide: true });
   await fs.promises.rename(temp,poster); failures.delete(file); return poster;
  } catch(error) {
   if(failures.size>=1000)failures.delete(failures.keys().next().value);
   failures.set(file,Date.now()); throw error;
  } finally { await fs.promises.unlink(temp).catch(()=>{}); jobs.delete(file); release(); }
 })();
 jobs.set(file,task);return task;
};
