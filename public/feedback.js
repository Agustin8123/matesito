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
