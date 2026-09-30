// Borradores en memoria: separados por cuenta y destino; no persisten en equipos compartidos.
const composerDrafts = new Map();
let composerKey = null;
let attachmentURL = null;
let publishController = null;

function saveComposerDraft() {
    if (!composerKey) return;
    const draft = { text: document.getElementById('postContent').value, file: selectedFile,
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
    selectedFile = draft?.file || null;
    document.getElementById('postMedia').value = '';
    updatePostMediaButton(selectedFile?.name);
}
function clearComposerDrafts() {
    publishController?.abort();
    composerDrafts.clear(); composerKey = null; selectedFile = null;
    document.getElementById('postContent').value = '';
    document.getElementById('sensitiveContentCheckbox').checked = false;
    document.getElementById('postMedia').value = '';
    updatePostMediaButton();
}
function previewAttachment() {
    const box = document.getElementById('attachmentPreview');
    if (!box) return;
    box.querySelectorAll('audio,video').forEach(media => { media.pause(); media.removeAttribute('src'); media.load(); });
    box.replaceChildren();
    if (attachmentURL) URL.revokeObjectURL(attachmentURL);
    attachmentURL = null; box.hidden = !selectedFile;
    if (!selectedFile) return;
    const kind = selectedFile.type.split('/')[0];
    if (!['image', 'video', 'audio'].includes(kind)) return;
    const media = document.createElement(kind === 'image' ? 'img' : kind);
    if (selectedFile.url) media.src = selectedFile.url;
    else { attachmentURL = URL.createObjectURL(selectedFile); media.src = attachmentURL; }
    if (kind === 'image') media.alt = 'Vista previa del archivo adjunto';
    else { media.controls = true; media.preload = 'metadata'; }
    box.append(media);
}
function setUploadProgress(fraction) {
    const box = document.getElementById('uploadStatus');
    box.hidden = false;
    const percentage = Math.round(fraction * 100);
    box.querySelector('progress').value = percentage;
    box.querySelector('span').textContent = percentage === 100 ? 'Archivo recibido. Preparando publicación…' : 'Subiendo archivo · ' + percentage + '%';
}
function cancelUpload() { publishController?.abort(); }
function setConnectionStatus(message) {
    const status = document.getElementById('connectionStatus');
    status.hidden = !message; status.textContent = message;
}
window.addEventListener('offline', () => setConnectionStatus('Sin conexión. Tu borrador sigue acá; esperá a reconectar antes de publicar.'));
window.addEventListener('online', () => setConnectionStatus('Reconectando…'));
if (!navigator.onLine) setConnectionStatus('Sin conexión. Tu borrador sigue acá.');
