const { execFile } = require('child_process');
const { promisify } = require('util');
const run = promisify(execFile);
module.exports = async function probeMedia(file, type) {
    try {
        const { stdout } = await run(process.env.FFPROBE_PATH || 'ffprobe', [
            '-v', 'error', '-protocol_whitelist', 'file,pipe', '-show_packets',
            '-show_entries', 'format=duration:stream=codec_type,width,height:packet=pts_time,duration_time', '-of', 'json', file
        ], { timeout: 20000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
        const info = JSON.parse(stdout);
        const streams = info.streams || [], packets = info.packets || [];
        let duration = Number(info.format?.duration) || 0;
        for (const packet of packets) duration = Math.max(duration, (Number(packet.pts_time) || 0) + (Number(packet.duration_time) || 0));
        const category = type.split('/')[0];
        if (!streams.some(stream => stream.codec_type === category) || !packets.length || !Number.isFinite(duration) || duration <= 0 || duration > 3600) throw new Error('Contenido inválido');
        if (streams.some(stream => stream.codec_type === 'video' && (!stream.width || !stream.height || stream.width * stream.height > 16000000))) throw new Error('Dimensiones inválidas');
        return { duration };
    } catch (error) {
        if (error.code === 'ENOENT') throw Object.assign(new Error('La validación de audio y video no está disponible. El servidor necesita FFmpeg/ffprobe.'), { status: 503 });
        throw Object.assign(new Error('El audio o video está dañado, no coincide con su tipo o supera los límites de duración y dimensiones.'), { status: 415 });
    }
};
