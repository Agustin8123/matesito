function renderHardware(system, error) {
    const status = document.getElementById('hardwareStatus');
    if (!system) { status.textContent = error || 'Esperando la primera lectura…'; return; }
    const percent = n => Number.isFinite(n) ? n.toFixed(1) + ' %' : 'Calculando…';
    const gib = n => (n / 1024 ** 3).toFixed(2) + ' GiB';
    status.textContent = (error ? error + '. Última lectura válida: ' : 'Actualizado: ') + new Date(system.updatedAt).toLocaleTimeString('es-AR');
    document.getElementById('cpuTotal').textContent = percent(system.cpuUsage);
    const memory = system.memory;
    const memoryPercent = memory.total > 0 ? memory.used / memory.total * 100 : 0;
    document.getElementById('ramTotal').textContent = percent(memoryPercent);
    document.getElementById('ramBar').value = memoryPercent;
    document.getElementById('ramDetail').textContent = gib(memory.used) + ' usados de ' + gib(memory.total) + ' · ' + gib(memory.available) + ' disponibles' + (memory.availableIncludesCache ? ' (incluye caché recuperable)' : '');
    const temperatures = document.getElementById('temperatures');
    temperatures.replaceChildren();
    for (const sensor of system.temperatures) {
        const card = document.createElement('article');
        const label = document.createElement('span'); label.textContent = sensor.label;
        const value = document.createElement('strong'); value.textContent = sensor.celsius.toFixed(1) + ' °C';
        card.append(label, value); temperatures.append(card);
    }
    if (!system.temperatures.length) {
        const unavailable = document.createElement('p');
        unavailable.textContent = 'Temperatura no disponible: el sistema no expone sensores compatibles o el servicio no tiene permiso para leerlos.';
        temperatures.append(unavailable);
    }
    const threads = document.getElementById('cpuThreads');
    threads.replaceChildren();
    const groups = new Map();
    for (const thread of system.threads) {
        const key = thread.socket !== null && thread.core !== null ? 'CPU ' + thread.socket + ' · Núcleo ' + thread.core : 'Procesadores lógicos';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(thread);
    }
    for (const [label, group] of groups) {
        const card = document.createElement('article');
        const title = document.createElement('h4'); title.textContent = label; card.append(title);
        const valid = group.filter(t => Number.isFinite(t.usage));
        if (valid.length) {
            const average = document.createElement('strong');
            average.textContent = percent(valid.reduce((sum, t) => sum + t.usage, 0) / valid.length) + ' promedio';
            card.append(average);
        }
        for (const thread of group) {
            const row = document.createElement('div'); row.className = 'thread-meter';
            const name = document.createElement('span'); name.textContent = 'Hilo ' + thread.id + ' · ' + percent(thread.usage);
            const meter = document.createElement('progress'); meter.max = 100;
            if (Number.isFinite(thread.usage)) meter.value = thread.usage;
            meter.setAttribute('aria-label', label + ', hilo ' + thread.id);
            row.append(name, meter); card.append(row);
        }
        threads.append(card);
    }
}
