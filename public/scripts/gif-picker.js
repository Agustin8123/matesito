function selectGif() {
    if (!users[activeUser]?.id) return showUserSelectOverlay();
    const owner = users[activeUser].id, destination = composerKey;
    const dialog = communityDialog('Buscar GIFs libres');
    const intro = document.createElement('p'); intro.textContent = 'Dominio público y CC0 de Wikimedia Commons. También podés probar palabras en inglés.';
    const form = document.createElement('form');
    const input = document.createElement('input'); input.type = 'search'; input.maxLength = 100; input.placeholder = 'Buscá un GIF…'; input.setAttribute('aria-label', 'Buscar GIFs');
    const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = 'Buscar';
    const results = document.createElement('div'); results.className = 'gif-results';
    const status = document.createElement('p'); status.setAttribute('role', 'status');
    let controller, query = '', next = null;
    const more = menuButton('Buscar más', () => search(next)); more.hidden = true;
    async function search(offset = 0) {
        controller?.abort(); const request = controller = new AbortController();
        if (!offset) { query = input.value.trim(); results.replaceChildren(); }
        if (!query) return;
        status.textContent = 'Buscando…'; more.hidden = true;
        try {
            const payload = await fetch('/api/gifs?' + new URLSearchParams({ q: query, offset }), { signal: request.signal }).then(readResponse);
            if (controller !== request || !dialog.open) return;
            for (const gif of payload.items) {
                const card = document.createElement('div');
                const choose = menuButton('', () => {
                    if (users[activeUser]?.id !== owner || composerKey !== destination) return dialog.close();
                    selectedFile = gif; document.getElementById('postMedia').value = '';
                    updatePostMediaButton(gif.name); dialog.close();
                });
                const image = document.createElement('img'); image.src = gif.url; image.alt = gif.name; image.loading = 'lazy'; choose.append(image); choose.title = 'Adjuntar ' + gif.name;
                const source = document.createElement('a'); source.href = gif.source; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.textContent = gif.license + ' · Fuente';
                card.append(choose, source); results.append(card);
            }
            next = payload.next; more.hidden = next === null;
            status.textContent = results.children.length ? 'Elegí un GIF para adjuntarlo.' : 'No encontramos GIFs libres en esta tanda. Probá Buscar más u otra palabra.';
        } catch (error) { if (error.name !== 'AbortError') status.textContent = error.message; }
    }
    form.addEventListener('submit', event => { event.preventDefault(); search(); });
    dialog.addEventListener('close', () => controller?.abort(), { once: true });
    form.append(input, submit); dialog.append(intro, form, status, results, more); dialog.showModal(); input.focus();
}
