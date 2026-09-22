const params = new URLSearchParams(window.location.search);
const postReactionId = params.get('id');
const enabledReactions = new Set((params.get('reactions') || '12345').split('').filter(id => /^[1-5]$/.test(id)));
let reactionPending = false;

function reactionUserId() {
    const cookie = document.cookie.split(';').map(part => part.trim()).find(part => part.startsWith('userID='));
    return cookie ? decodeURIComponent(cookie.slice(7)) : null;
}
async function refreshReactions() {
    const result = await fetch('/get/microreact--reactionss/' + encodeURIComponent(postReactionId)).then(readResponse);
    const counts = new Map(result.reactions.map(row => [String(row.reaction_id), row.count]));
    for (const id of enabledReactions) {
        const label = document.querySelector('[data-list-id="' + id + '"]');
        if (label) label.textContent = counts.get(id) || 0;
    }
}

if (!postReactionId || !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(postReactionId)) {
    notify('No se puede cargar esta publicación.', 'error');
} else {
    for (const id of enabledReactions) {
        const button = document.querySelector('[data-reaction-id="' + id + '"]');
        const label = document.querySelector('[data-list-id="' + id + '"]');
        if (!button || !label) continue;
        button.style.display = 'block';
        label.style.display = 'block';
        button.setAttribute('role', 'button');
        button.tabIndex = 0;
        const react = async () => {
            if (reactionPending) return;
            const userId = reactionUserId();
            if (!userId) return notify('Iniciá sesión para reaccionar.', 'error');
            reactionPending = true;
            button.setAttribute('aria-busy', 'true');
            try {
                await fetch('/hit/microreact--reactions/' + encodeURIComponent(postReactionId) + '/' + id, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId })
                }).then(readResponse);
                await refreshReactions();
            } catch (error) { notify(error.message, 'error'); }
            finally { reactionPending = false; button.removeAttribute('aria-busy'); }
        };
        button.addEventListener('click', react);
        button.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); react(); }
        });
    }
    refreshReactions().catch(error => notify(error.message, 'error'));
    if (typeof io === 'function') {
        const reactionSocket = io();
        reactionSocket.on('reloadReactions', data => {
            if (data.id === postReactionId) refreshReactions().catch(error => notify(error.message, 'error'));
        });
    }
}

const safeColor = value => /^(#[0-9a-f]{3,8}|(?:rgb|hsl)a?\([\d\s,.%+-]+\)|[a-z]+)$/i.test(value || '') ? value : null;
const color = safeColor(params.get('textColor'));
const background = safeColor(params.get('bgColor'));
if (color) document.body.style.color = color;
if (background) document.body.style.backgroundColor = background;
