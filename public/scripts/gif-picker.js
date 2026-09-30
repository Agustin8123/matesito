function selectGif() {
    if (!users[activeUser]?.id) return showUserSelectOverlay();
    const owner = users[activeUser].id, destination = composerKey;
    const dialog = communityDialog('Buscar GIFs'); dialog.classList.add('gif-picker');
    const intro = document.createElement('p'); intro.className = 'gif-intro'; intro.textContent = 'Buscá personajes, emociones o ese GIF que dice todo.';
    const form = document.createElement('form'); form.className = 'gif-search-form';
    const input = document.createElement('input'); input.type = 'search'; input.maxLength = 100; input.placeholder = 'Buscá un GIF…'; input.setAttribute('aria-label', 'Buscar GIFs');
    const submit = document.createElement('button'); submit.type = 'submit'; submit.textContent = 'Buscar';
    const results = document.createElement('div'); results.className = 'gif-results';
    const status = document.createElement('p'); status.setAttribute('role', 'status'); status.className = 'gif-status';
    const attribution = document.createElement('a'); attribution.href = 'https://giphy.com/'; attribution.target = '_blank'; attribution.rel = 'noopener noreferrer'; attribution.textContent = 'Powered by GIPHY'; attribution.className = 'gif-attribution';
    const brand = document.createElement('img'); brand.src = '/resources/PNG/giphy-attribution.png'; brand.alt = 'Powered by GIPHY'; attribution.replaceChildren(brand);
    let controller, apiKey, query = '', next = null;
    const more = menuButton('Buscar más', () => search(next)); more.hidden = true;
    async function search(offset = 0) {
        controller?.abort(); const request = controller = new AbortController();
        if (!offset) { query = input.value.trim(); results.replaceChildren(); }
        if (!query) return;
        status.textContent = 'Buscando…'; more.hidden = true;
        try {
            results.setAttribute('aria-busy', 'true');
            if (!apiKey) apiKey = (await fetch('/api/gifs/config', { signal: request.signal }).then(readResponse)).apiKey;
            const response = await fetch('https://api.giphy.com/v1/gifs/search?' + new URLSearchParams({ api_key: apiKey, q: query, offset, limit: 24, lang: 'es', rating: 'pg-13' }), { signal: request.signal });
            if (!response.ok) throw new Error(response.status === 429 ? 'Se alcanzó el límite de búsquedas. Probá más tarde.' : 'No se pudo consultar GIPHY. Reintentá en unos segundos.');
            const payload = await response.json();
            if (controller !== request || !dialog.open) return;
            if (!Array.isArray(payload.data)) throw new Error('GIPHY devolvió una respuesta inesperada.');
            for (const result of payload.data) {
                const gif = { name: result.title || 'GIF', url: result.images.original.url, type: 'image/gif', source: result.url };
                const card = document.createElement('div'); card.className = 'gif-card';
                const choose = menuButton('', () => {
                    if (users[activeUser]?.id !== owner || composerKey !== destination) return dialog.close();
                    if (addComposerFiles([gif])) dialog.close();
                });
                const image = document.createElement('img'); image.src = result.images.fixed_width?.url || gif.url; image.alt = gif.name; image.loading = 'lazy'; choose.append(image); choose.title = 'Adjuntar ' + gif.name;
                const source = document.createElement('a'); source.href = gif.source; source.target = '_blank'; source.rel = 'noopener noreferrer'; source.textContent = result.user?.display_name || result.user?.username || result.source_post_url && 'Fuente en GIPHY' || 'Ver en GIPHY'; source.title = source.textContent;
                card.append(choose, source); results.append(card);
            }
            const end = Number(offset) + payload.data.length;
            next = payload.data.length && end < payload.pagination.total_count && end < 5000 ? end : null; more.hidden = next === null;
            status.textContent = results.children.length ? 'Tocá un GIF para adjuntarlo a tu publicación.' : 'No encontramos resultados. Probá con otra palabra.';
        } catch (error) { if (error.name !== 'AbortError' && controller === request) status.textContent = error.message; }
        finally { if (controller === request) results.setAttribute('aria-busy', 'false'); }
    }
    form.addEventListener('submit', event => { event.preventDefault(); search(); });
    dialog.addEventListener('close', () => controller?.abort(), { once: true });
    form.append(input, submit); dialog.append(intro, form, attribution, status, results, more); dialog.showModal(); input.focus();
}
