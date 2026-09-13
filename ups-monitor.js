const { execFile } = require('child_process');

function parseUpsc(output) {
  const data = {};
  for (const line of output.split('\n')) {
    const sep = line.indexOf(': ');
    if (sep === -1) continue;
    const key = line.slice(0, sep).trim();
    const value = line.slice(sep + 2).trim();
    if (key) data[key] = value;
  }
  return data;
}

function attachUpsMonitor(app, opts = {}) {
  const {
    upsName = 'Kaise',
    upsHost = 'localhost',
    path = '/api/ups',
    pollMs = 5000,
    // Si tu server corre como servicio systemd, el PATH suele venir
    // recortado y no encuentra "upsc" a secas. Confirmá la ruta real
    // con `which upsc` y ajustala acá si no es esta.
    upscBin = '/usr/bin/upsc',
  } = opts;

  const target = `${upsName}@${upsHost}`;
  let latest = null;
  let lastError = null;
  let lastGoodAt = null;
  const clients = new Set();

  function pollOnce() {
    return new Promise((resolve, reject) => {
      execFile(upscBin, [target], { timeout: pollMs - 250 }, (err, stdout) => {
        if (err) return reject(err);
        resolve(parseUpsc(stdout));
      });
    });
  }

  function currentPayload() {
    return {
      ...(latest || {}),
      _error: lastError,
      _lastGoodAt: lastGoodAt,
    };
  }

  async function tick() {
    try {
      latest = await pollOnce();
      lastError = null;
      lastGoodAt = new Date().toISOString();
    } catch (err) {
      // Si upsc falla (upsd se cayó, la UPS se desconectó, lo que sea),
      // no vaciamos el dashboard: seguimos sirviendo la última lectura
      // buena junto con el motivo del fallo, para que se note el
      // problema sin que la pantalla quede en blanco.
      lastError = err.message;
    }
    const payload = `data: ${JSON.stringify(currentPayload())}\n\n`;
    for (const res of clients) res.write(payload);
  }

  tick();
  setInterval(tick, pollMs);

  app.get(path, (req, res) => {
    if (!latest) {
      return res.status(503).json({ error: lastError || 'todavía sin lecturas' });
    }
    res.json(currentPayload());
  });

  app.get(`${path}/stream`, (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders?.();
    if (latest) res.write(`data: ${JSON.stringify(currentPayload())}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
  });
}

module.exports = attachUpsMonitor;