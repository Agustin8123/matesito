async function sharePost(id) {
    if (!/^(?:F-)?[1-9]\d*$/.test(String(id))) return;
    const url = new URL('/p/' + id, location.origin).href;
    try {
        await navigator.clipboard.writeText(url);
        notify('Enlace copiado. Ya podés compartir esta publicación.', 'success');
    } catch {
        let dialog = document.getElementById('sharePostDialog');
        if (!dialog) {
            dialog = document.createElement('dialog'); dialog.id = 'sharePostDialog'; dialog.className = 'navigation-panel';
            const title = document.createElement('h2'); title.textContent = 'Compartir publicación';
            const label = document.createElement('label'); label.textContent = 'Copiá este enlace:';
            const input = document.createElement('input'); input.readOnly = true; input.type = 'url'; input.style.width = '100%';
            label.append(input);
            const close = document.createElement('button'); close.textContent = 'Cerrar'; close.onclick = () => dialog.close();
            dialog.append(title, label, close); document.body.append(dialog);
        }
        dialog.querySelector('input').value = url;
        if (!dialog.open) dialog.showModal();
        dialog.querySelector('input').select();
    }
}
