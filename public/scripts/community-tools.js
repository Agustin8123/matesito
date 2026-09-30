function communityDialog(title) {
    const previous = document.activeElement;
    const dialog = document.createElement('dialog'); dialog.className = 'navigation-panel community-dialog';
    const header = document.createElement('div'); header.className = 'community-dialog-heading';
    const heading = document.createElement('h2'); heading.textContent = title;
    const close = menuButton('×', () => dialog.close()); close.className = 'icon-button'; close.setAttribute('aria-label', 'Cerrar');
    header.append(heading, close); dialog.append(header); document.body.append(dialog);
    dialog.addEventListener('close', () => {
        const feedback = dialog.querySelector('#feedback-region'); if (feedback) document.body.append(feedback);
        dialog.remove(); if (previous?.isConnected) previous.focus();
    }, { once: true });
    return dialog;
}
function addPublicationTools(card, id, author, content, sensitive) {
    if (!users[activeUser]?.id) return;
    const controls = document.createElement('details'); controls.className = 'publication-tools';
    const summary = document.createElement('summary'); summary.innerHTML = '<span aria-hidden="true">•••</span><span class="visually-hidden">Opciones de publicación</span>'; summary.title = 'Opciones de publicación'; controls.append(summary);
    const actions = document.createElement('div'); actions.className = 'publication-menu';
    const own = Number(author) === Number(users[activeUser].id);
    if (own) {
        actions.append(menuButton('Editar publicación', () => editPublication(id, content, sensitive)));
        const remove = menuButton('Eliminar', () => deletePublication(id)); remove.className = 'danger-action'; actions.append(remove);
    }
    if (!/^[CG]-/.test(String(id))) actions.append(menuButton('Denunciar', () => reportPublication(id)));
    actions.addEventListener('click', event => { if (event.target.closest('button')) controls.open = false; });
    controls.addEventListener('toggle', () => {
        if (!controls.open) return;
        document.querySelectorAll('.publication-tools[open]').forEach(other => { if (other !== controls) other.open = false; });
        document.querySelectorAll('.user-profile-box').forEach(box => { box.style.display = 'none'; });
        document.querySelectorAll('.profile-trigger').forEach(button => button.setAttribute('aria-expanded', 'false'));
        activeMenuId = null;
    });
    controls.addEventListener('keydown', event => { if (event.key === 'Escape') { controls.open = false; summary.focus(); } });
    if (actions.childElementCount) { controls.append(actions); card.querySelector('.post-header').append(controls); }
}
function editPublication(id, content, sensitive) {
    const dialog = communityDialog('Editar publicación');
    const label = document.createElement('label'); label.textContent = 'Texto';
    const input = document.createElement('textarea'); input.value = content; input.maxLength = 10000; label.append(input);
    const checkLabel = document.createElement('label'); const check = document.createElement('input'); check.type = 'checkbox'; check.checked = sensitive;
    checkLabel.append(check, ' Contenido sensible');
    const save = menuButton('Guardar cambios', async () => {
        save.disabled = true;
        try {
            await fetch('/api/publications/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: input.value, sensitive: check.checked }) }).then(readResponse);
            dialog.close(); await refreshPublication({ id }); notify('Publicación actualizada.', 'success');
        } catch (error) { notify(error.message, 'error'); }
        finally { save.disabled = false; }
    });
    dialog.append(label, checkLabel, save); dialog.showModal(); input.focus();
}
async function deletePublication(id) {
    if (!await confirmAction('¿Eliminar esta publicación? Esta acción no se puede deshacer.')) return;
    try {
        await fetch('/api/publications/' + encodeURIComponent(id), { method: 'DELETE' }).then(readResponse);
        await refreshPublication({ id, deleted: true }); notify('Publicación eliminada.', 'success');
    } catch (error) { notify(error.message, 'error'); }
}
function reportPublication(id) {
    const dialog = communityDialog('Denunciar publicación');
    const label = document.createElement('label'); label.textContent = 'Contanos qué sucede. La denuncia será revisada por moderación.';
    const input = document.createElement('textarea'); input.maxLength = 1000; label.append(input);
    const send = menuButton('Enviar denuncia', async () => {
        send.disabled = true;
        try {
            await fetch('/api/reports/' + encodeURIComponent(id), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: input.value }) }).then(readResponse);
            dialog.close(); notify('Denuncia enviada.', 'success');
        } catch (error) { notify(error.message, 'error'); }
        finally { send.disabled = false; }
    });
    dialog.append(label, send); dialog.showModal(); input.focus();
}
async function blockUser(id) {
    if (!users[activeUser]?.id) return showUserSelectOverlay();
    if (!await confirmAction('¿Bloquear esta cuenta? Dejarán de seguirse y no podrán enviarse mensajes privados nuevos.')) return;
    try { await fetch('/api/blocks/' + id, { method: 'POST' }).then(readResponse); await loadposts(loadAll); notify('Cuenta bloqueada.', 'success'); }
    catch (error) { notify(error.message, 'error'); }
}
async function openBlockedUsers() {
    const dialog = communityDialog('Cuentas bloqueadas'); dialog.showModal();
    try {
        const rows = await fetch('/api/blocks').then(readResponse);
        if (!dialog.open) return;
        if (!rows.length) dialog.append('No bloqueaste ninguna cuenta.');
        for (const row of rows) {
            const item = document.createElement('p'); item.textContent = row.username;
            item.append(menuButton('Desbloquear', async () => {
                try { await fetch('/api/blocks/' + row.id, { method: 'DELETE' }).then(readResponse); item.remove(); }
                catch (error) { notify(error.message, 'error'); }
            })); dialog.append(item);
        }
    } catch (error) { notify(error.message, 'error'); }
}
async function openModeration() {
    const dialog = communityDialog('Denuncias para revisar'); dialog.showModal();
    try {
        const rows = await fetch('/api/moderation').then(readResponse);
        if (!dialog.open) return;
        const help = document.createElement('p'); help.textContent = 'Mostramos hasta 50 denuncias pendientes de tus foros o de los espacios que administrás.'; dialog.append(help);
        if (!rows.length) dialog.append('No hay denuncias pendientes.');
        for (const row of rows) {
            const item = document.createElement('div'); item.className = 'moderation-item';
            const reason = document.createElement('p'); reason.textContent = row.reason;
            const link = document.createElement('a'); link.href = '/p/' + encodeURIComponent(row.target_id); link.target = '_blank'; link.rel = 'noopener'; link.textContent = 'Ver publicación';
            const action = async type => {
                if (type === 'remove' && !await confirmAction('¿Eliminar esta publicación denunciada?')) return;
                try { await fetch('/api/moderation/' + row.id, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: type }) }).then(readResponse); item.remove(); }
                catch (error) { notify(error.message, 'error'); }
            };
            item.append(reason, link, menuButton('Descartar denuncia', () => action('dismiss')), menuButton('Eliminar publicación', () => action('remove'))); dialog.append(item);
        }
    } catch (error) { notify(error.message, 'error'); }
}
const publicationRefreshes = new Map();
async function refreshPublication({ id, deleted }) {
    const state = feedState;
    if (!state || !/^(?:[CFG]-)?[1-9]\d*$/.test(String(id))) return;
    const list = document.getElementById(state.listId);
    const find = () => [...list.children].find(el => el.dataset.postId === String(id));
    if (deleted) { publicationRefreshes.delete(String(id)); find()?.remove(); state.seen.delete(String(id)); return; }
    if (!find()) return;
    const request = {}; publicationRefreshes.set(String(id), request);
    try {
        const query = new URLSearchParams({ limit: '12', item: id, sensitive: showSensitiveContent ? 'show' : 'hide', order: ordenarReacciones ? (invertirOrden ? 'reactions-asc' : 'reactions') : invertirOrden ? 'oldest' : 'newest' });
        const payload = await fetch(state.url + (state.url.includes('?') ? '&' : '?') + query, { signal: state.controller.signal }).then(readResponse);
        if (state !== feedState || publicationRefreshes.get(String(id)) !== request) return;
        const previous = find(); if (!previous) return;
        const row = payload.items?.[0];
        if (!row) { previous.remove(); state.seen.delete(String(id)); return; }
        addpostToList(row.content, row.media, state.messages ? row.media_type : row.mediaType, row.username,
            state.messages ? row.image : row.profilePicture, row.sensitive, row.created_at,
            state.messages ? row.sender_id : row.userId, row.postId ?? row.id, state.listId);
        const card = list.lastElementChild; card.dataset.score = String(row.reactionTotal ?? row.reaction_total ?? 0);
        previous.replaceWith(card); positionFeedCard(list, card);
    } catch (error) { if (error.name !== 'AbortError') notify('No se pudo actualizar una publicación. Podés recargarla.', 'error'); }
    finally { if (publicationRefreshes.get(String(id)) === request) publicationRefreshes.delete(String(id)); }
}
