const os = require('os');
const fs = require('fs/promises');
const read = async file => { try { return (await fs.readFile(file, 'utf8')).trim(); } catch { return null; } };
const entries = async dir => { try { return await fs.readdir(dir); } catch { return []; } };

module.exports = function createSystemMonitor() {
    let previous = new Map();
    return async function sample() {
        let cpus = os.cpus().map((cpu, id) => ({ id, idle: cpu.times.idle, total: Object.values(cpu.times).reduce((a, b) => a + b, 0) }));
        // /proc includes iowait and stable CPU IDs; guest times are already included in user/nice.
        const stat = await read('/proc/stat');
        if (stat) cpus = stat.split('\n').filter(line => /^cpu\d+\s/.test(line)).map(line => {
            const [name, ...raw] = line.trim().split(/\s+/); const t = raw.map(Number);
            return { id: Number(name.slice(3)), idle: t[3] + t[4], total: t.slice(0, 8).reduce((a, b) => a + b, 0) };
        });
        let totalDelta = 0, busyDelta = 0;
        const threads = await Promise.all(cpus.map(async cpu => {
            const old = previous.get(cpu.id); const delta = old ? cpu.total - old.total : 0;
            const busy = old ? delta - (cpu.idle - old.idle) : 0;
            const valid = delta > 0 && busy >= 0 && busy <= delta;
            if (valid) { totalDelta += delta; busyDelta += busy; }
            const base = '/sys/devices/system/cpu/cpu' + cpu.id + '/topology/';
            const [socket, core] = await Promise.all([read(base + 'physical_package_id'), read(base + 'core_id')]);
            return { id: cpu.id, socket, core, usage: valid ? Math.round(busy / delta * 1000) / 10 : null };
        }));
        previous = new Map(cpus.map(cpu => [cpu.id, cpu]));
        const total = os.totalmem();
        const info = await read('/proc/meminfo');
        const availableKB = info?.match(/^MemAvailable:\s+(\d+) kB/m)?.[1];
        const available = Math.min(total, availableKB ? Number(availableKB) * 1024 : os.freemem());
        const temperatures = [];
        for (const dir of (await entries('/sys/class/hwmon')).filter(n => /^hwmon\d+$/.test(n))) {
            const base = '/sys/class/hwmon/' + dir;
            const chip = await read(base + '/name') || dir;
            for (const input of (await entries(base)).filter(n => /^temp\d+_input$/.test(n))) {
                const raw = await read(base + '/' + input);
                const value = raw === null ? NaN : Number(raw) / 1000;
                if (!Number.isFinite(value) || value < -40 || value > 150) continue;
                const label = await read(base + '/' + input.replace('_input', '_label'));
                temperatures.push({ label: chip + ' · ' + (label || input.replace('_input', '')), celsius: value });
            }
        }
        if (!temperatures.length) {
            for (const zone of (await entries('/sys/class/thermal')).filter(n => /^thermal_zone\d+$/.test(n))) {
                const base = '/sys/class/thermal/' + zone; const raw = await read(base + '/temp');
                const value = raw === null ? NaN : Number(raw) / 1000;
                if (Number.isFinite(value) && value >= -40 && value <= 150) temperatures.push({ label: await read(base + '/type') || zone, celsius: value });
            }
        }
        return { updatedAt: new Date().toISOString(), cpuUsage: totalDelta ? Math.round(busyDelta / totalDelta * 1000) / 10 : null,
            threads, memory: { total, available, used: total - available, availableIncludesCache: !!availableKB }, temperatures };
    };
};
