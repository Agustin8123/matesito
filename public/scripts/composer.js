// Borradores en memoria: separados por cuenta y destino; no persisten en equipos compartidos.
const composerDrafts = new Map();
let composerKey = null;
let attachmentURLs = [];
let publishController = null;

function saveComposerDraft() {
    if (!composerKey) return;
    const draft = { text: document.getElementById('postContent').value, file: selectedFiles.length ? selectedFiles : null,
        sensitive: document.getElementById('sensitiveContentCheckbox').checked };
    if (draft.text || draft.file) composerDrafts.set(composerKey, draft);
    else composerDrafts.delete(composerKey);
}
function switchComposerDraft(destination) {
    const key = (users[activeUser]?.id || 'guest') + ':' + destination;
    if (key === composerKey) return;
    saveComposerDraft();
    composerKey = key;
    const draft = composerDrafts.get(key);
    document.getElementById('postContent').value = draft?.text || '';
    document.getElementById('sensitiveContentCheckbox').checked = draft?.sensitive || false;
    selectedFiles = draft?.file || [];
    document.getElementById('postMedia').value = '';
    updatePostMediaButton();
}
function clearComposerDrafts() {
    publishController?.abort();
    composerDrafts.clear(); composerKey = null; selectedFiles = [];
    document.getElementById('postContent').value = '';
    document.getElementById('sensitiveContentCheckbox').checked = false;
    document.getElementById('postMedia').value = '';
    updatePostMediaButton();
}
function addComposerFiles(files) {
    const combined = [...selectedFiles, ...files.filter(file => !selectedFiles.includes(file))];
    if (combined.some(file => !/^(image|video|audio)\//.test(file.type))) { notify('Usá imágenes, GIFs, videos o audios.', 'error'); return false; }
    if (combined.filter(file => file.type.startsWith('audio/')).length > 1) { notify('Podés adjuntar un solo audio. Quitá el anterior para cambiarlo.', 'error'); return false; }
    if (combined.filter(file => !file.type.startsWith('audio/')).length > 10) { notify('Podés adjuntar hasta 10 fotos, GIFs o videos.', 'error'); return false; }
    if (combined.some(file => file.size > (file.type.startsWith('video/') ? 20 : 10) * 1024 * 1024)) { notify('Cada imagen o audio admite hasta 10 MB y cada video hasta 20 MB.', 'error'); return false; }
    selectedFiles = combined; updatePostMediaButton(); saveComposerDraft(); return true;
}
function previewAttachment() {
    const box = document.getElementById('attachmentPreview'); if (!box) return;
    box.querySelectorAll('audio,video').forEach(media => { media.pause(); media.removeAttribute('src'); media.load(); });
    box.replaceChildren(); attachmentURLs.forEach(url => URL.revokeObjectURL(url)); attachmentURLs = [];
    box.hidden = !selectedFiles.length;
    selectedFiles.forEach((file, index) => {
        const item = document.createElement('div'); item.className = 'attachment-item';
        const kind = file.type.split('/')[0]; const media = document.createElement(kind === 'image' ? 'img' : kind);
        if (file.url) media.src = file.url;
        else { const url = URL.createObjectURL(file); attachmentURLs.push(url); media.src = url; }
        if (kind === 'image') media.alt = file.name || 'Imagen adjunta'; else { media.controls = true; media.preload = 'metadata'; }
        const label = document.createElement('span'); label.textContent = (index+1) + '. ' + (file.name || 'GIF');
        const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.setAttribute('aria-label', 'Quitar ' + (file.name || 'adjunto'));
        remove.onclick = () => { selectedFiles = selectedFiles.filter(value => value !== file); updatePostMediaButton(); saveComposerDraft(); };
        item.append(media, label, remove); box.append(item);
    });
}
function setUploadProgress(fraction) {
    const box = document.getElementById('uploadStatus');
    box.hidden = false;
    const percentage = Math.round(fraction * 100);
    box.querySelector('progress').value = percentage;
    box.querySelector('span').textContent = percentage === 100 ? 'Archivos recibidos. Preparando publicación…' : 'Subiendo adjuntos · ' + percentage + '%';
}
function cancelUpload() { publishController?.abort(); }
function setConnectionStatus(message) {
    const status = document.getElementById('connectionStatus');
    status.hidden = !message; status.textContent = message;
}
window.addEventListener('offline', () => setConnectionStatus('Sin conexión. Tu borrador sigue acá; esperá a reconectar antes de publicar.'));
window.addEventListener('online', () => setConnectionStatus('Reconectando…'));
if (!navigator.onLine) setConnectionStatus('Sin conexión. Tu borrador sigue acá.');
