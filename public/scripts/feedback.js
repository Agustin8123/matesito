/* Shared, non-blocking feedback for the site and embedded reactions. */
function notify(message, type = 'info') {
    let region = document.getElementById('feedback-region');
    if (!region) {
        region = document.createElement('div');
        region.id = 'feedback-region';
        region.setAttribute('aria-live', 'polite');
        document.body.appendChild(region);
    }
    const host = document.querySelector('dialog[open]') || document.body;
    if (region.parentElement !== host) host.appendChild(region);
    const item = document.createElement('div');
    item.className = `feedback-message ${type}`;
    item.setAttribute('role', type === 'error' ? 'alert' : 'status');
    const text = document.createElement('span');
    text.textContent = typeof message === 'string' ? message : JSON.stringify(message);
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Cerrar aviso');
    close.addEventListener('click', () => item.remove());
    item.append(text, close);
    region.appendChild(item);
    if (type !== 'error') setTimeout(() => item.remove(), 7000);
}

function confirmAction(message) {
    return new Promise(resolve => {
        const previousFocus = document.activeElement;
        const dialog = document.createElement('dialog');
        dialog.className = 'confirmation-dialog';
        dialog.setAttribute('aria-label', 'Confirmar acción');
        const text = document.createElement('p');
        text.textContent = message;
        const actions = document.createElement('div');
        const cancel = document.createElement('button');
        cancel.textContent = 'Cancelar';
        const accept = document.createElement('button');
        accept.textContent = 'Confirmar';
        accept.className = 'confirm-accept';
        const finish = result => {
            const feedback = dialog.querySelector('#feedback-region');
            if (feedback) document.body.appendChild(feedback);
            dialog.close();
            dialog.remove();
            previousFocus?.focus();
            resolve(result);
        };
        cancel.addEventListener('click', () => finish(false));
        accept.addEventListener('click', () => finish(true));
        dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
        actions.append(cancel, accept);
        dialog.append(text, actions);
        document.body.appendChild(dialog);
        dialog.showModal();
        cancel.focus();
    });
}

async function readResponse(response) {
    const data = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error((typeof data === 'string' ? data : data?.error?.message || data?.error || data?.message)
            || `No se pudo completar la solicitud (${response.status}).`);
    }
    if (data === null) throw new Error('El servidor devolvió una respuesta inválida.');
    return data;
}

// Reuse a successful upload when publishing is retried; entries disappear with the File.
const uploadedFiles = new WeakMap();
function uploadMedia(file, options = {}) {
    if (file.url && file.type === 'image/gif' && new URL(file.url).origin === 'https://upload.wikimedia.org') return Promise.resolve({ url: file.url, mediaType: file.type });
    const owner = document.cookie.split(';').map(value => value.trim()).find(value => value.startsWith('userID=')) || '';
    const cached = uploadedFiles.get(file);
    if (cached && cached.owner === owner && Date.now() - cached.at < 15 * 60 * 1000) return cached.promise;
    const entry = { owner, at: Date.now() };
    entry.promise = new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const abort = () => xhr.abort();
        const cleanup = () => options.signal?.removeEventListener('abort', abort);
        xhr.open('POST', '/api/uploads');
        xhr.timeout = 125000;
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.upload.onprogress = event => { if (event.lengthComputable) options.onProgress?.(event.loaded / event.total); };
        xhr.onload = () => {
            cleanup();
            let data; try { data = JSON.parse(xhr.responseText); } catch {}
            if (xhr.status < 200 || xhr.status >= 300) return reject(new Error(data?.error || 'No se pudo subir el archivo.'));
            resolve(data);
        };
        xhr.onerror = () => { cleanup(); reject(new Error('Se interrumpió la subida. Conservamos tu archivo para reintentar.')); };
        xhr.ontimeout = () => { cleanup(); reject(new Error('La subida tardó demasiado. Reintentá con una conexión estable.')); };
        xhr.onabort = () => { cleanup(); reject(new DOMException('Subida cancelada', 'AbortError')); };
        if (options.signal?.aborted) return reject(new DOMException('Subida cancelada', 'AbortError'));
        options.signal?.addEventListener('abort', abort, { once: true });
        xhr.send(file);
    }).then(uploaded => {
            if (!uploaded.url || !uploaded.mediaType) throw new Error('El servidor no confirmó el archivo subido.');
            return uploaded;
        }).catch(error => { if (uploadedFiles.get(file) === entry) uploadedFiles.delete(file); throw error; });
    uploadedFiles.set(file, entry);
    return entry.promise;
}
