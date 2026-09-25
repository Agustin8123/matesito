async function openAudioRecorder() {
    if (!users[activeUser]?.id) return showUserSelectOverlay();
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return notify('Este navegador no permite grabar audio. Usá HTTPS y un navegador compatible, o adjuntá un archivo.', 'error');
    if (document.getElementById('audioRecorder')) return;
    const dialog = document.createElement('dialog'); dialog.id = 'audioRecorder'; dialog.className = 'navigation-panel audio-recorder';
    dialog.setAttribute('aria-labelledby', 'audioRecorderTitle');
    dialog.innerHTML = '<h2 id="audioRecorderTitle">Grabar audio</h2><p class="recording-status" role="status">Esperando permiso para el micrófono…</p><audio controls hidden></audio><div class="recording-actions"><button type="button" data-stop disabled>Detener</button><button type="button" data-use hidden>Adjuntar audio</button><button type="button" data-cancel>Cancelar</button></div><p>Hasta 5 minutos o 10 MB. Podés escucharlo antes de adjuntarlo y publicarlo con Cebar.</p>';
    document.body.append(dialog); dialog.showModal();
    let stream, recorder, timer, blob, previewURL, closed = false, bytes = 0;
    const chunks = [];
    const status = dialog.querySelector('.recording-status');
    const stop = dialog.querySelector('[data-stop]');
    function release() {
        clearInterval(timer);
        stream?.getTracks().forEach(track => track.stop());
    }
    function close() {
        closed = true;
        if (recorder?.state === 'recording') recorder.stop();
        release();
        if (previewURL) URL.revokeObjectURL(previewURL);
        dialog.close(); dialog.remove();
    }
    function finish() { if (recorder?.state === 'recording') recorder.stop(); stop.disabled = true; clearInterval(timer); }
    dialog.querySelector('[data-cancel]').onclick = close;
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    window.addEventListener('pagehide', close, { once: true });
    dialog.addEventListener('close', () => window.removeEventListener('pagehide', close), { once: true });
    stop.onclick = finish;
    dialog.querySelector('[data-use]').onclick = () => {
        if (!blob?.size || !users[activeUser]?.id) return close();
        const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
        selectedFile = new File([blob], 'audio-' + Date.now() + '.' + extension, { type: blob.type });
        document.getElementById('postMedia').value = '';
        updatePostMediaButton(selectedFile.name);
        close();
        notify('Audio adjuntado. Tocá Cebar para publicarlo.', 'success');
    };
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (closed) { release(); return; }
        const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
        if (!mimeType) throw new Error('No hay un formato de grabación compatible. Podés adjuntar un audio desde tu dispositivo.');
        recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 96000 });
        recorder.ondataavailable = event => {
            if (closed || !event.data.size) return;
            bytes += event.data.size; chunks.push(event.data);
            if (bytes >= 10 * 1024 * 1024) finish();
        };
        recorder.onerror = () => { close(); notify('No se pudo grabar el audio. Reintentá.', 'error'); };
        recorder.onstop = () => {
            release();
            if (closed) return;
            blob = new Blob(chunks, { type: recorder.mimeType });
            stop.hidden = true;
            if (!blob.size || blob.size > 10 * 1024 * 1024) { status.textContent = 'La grabación está vacía o supera los 10 MB. Cancelá y grabá nuevamente.'; return; }
            previewURL = URL.createObjectURL(blob);
            const audio = dialog.querySelector('audio'); audio.src = previewURL; audio.hidden = false;
            dialog.querySelector('[data-use]').hidden = false;
            status.textContent = 'Grabación lista. Escuchala antes de adjuntarla.';
        };
        recorder.start(500);
        stop.disabled = false;
        const started = Date.now(); status.textContent = 'Grabando · 0:00';
        timer = setInterval(() => {
            const seconds = Math.floor((Date.now() - started) / 1000);
            status.textContent = 'Grabando · ' + Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
            if (seconds >= 300) finish();
        }, 500);
    } catch (error) {
        close();
        notify(error.name === 'NotAllowedError' ? 'No se habilitó el micrófono. Podés permitirlo desde el navegador o adjuntar un audio.' : error.name === 'NotFoundError' ? 'No se encontró un micrófono.' : error.message, 'error');
    }
}
