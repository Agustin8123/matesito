let liveTimer;
let liveState;
const liveIds = new Set();
function scheduleFeedUpdate(data) {
    if (!feedState || !data?.id) return;
    if (liveState !== feedState) { liveIds.clear(); liveState = feedState; }
    if (!feedState.seen.has(String(data.id))) liveIds.add(String(data.id));
    clearTimeout(liveTimer); liveTimer = setTimeout(flushFeedUpdates, 80);
}
async function flushFeedUpdates() {
    const state = liveState, ids = [...liveIds]; liveIds.clear();
    if (state !== feedState) return;
    for (let offset = 0; offset < ids.length; offset += 12) {
        const batch = ids.slice(offset, offset + 12);
        const query = new URLSearchParams({ limit: '12', items: batch.join(','), sensitive: showSensitiveContent ? 'show' : 'hide',
            order: ordenarReacciones ? (invertirOrden ? 'reactions-asc' : 'reactions') : invertirOrden ? 'oldest' : 'newest' });
        try {
            const payload = await fetch(state.url + (state.url.includes('?') ? '&' : '?') + query, { signal: state.controller.signal }).then(readResponse);
            if (state !== feedState) return;
            insertFeedRows(state, payload.items || []);
        } catch (error) {
            if (state !== feedState || error.name === 'AbortError') return;
            for (const id of batch) await queueFeedUpdate({ id });
        }
    }
}
let notificationTimer;
function scheduleNotifications() { clearTimeout(notificationTimer); notificationTimer = setTimeout(obtenerNotificaciones, 120); }
