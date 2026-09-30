// Un componente liviano por tarjeta, con una sola conexión compartida.
class MateReactions extends HTMLElement {
    connectedCallback() {
        if (this.initialized) return;
        this.initialized = true;
        this.className = 'inline-reactions';
        const labels = ['Me gusta', 'Me encanta', 'Me divierte', 'Me sorprende', 'Me entristece'];
        ['👍', '❤️', '😂', '😮', '😢'].forEach((icon, index) => {
            const button = document.createElement('button'); button.type = 'button'; button.setAttribute('aria-label', labels[index]); button.setAttribute('aria-pressed', 'false');
            const count = document.createElement('span'); count.textContent = '0'; button.append(icon, count);
            button.addEventListener('click', () => this.react(index + 1)); this.append(button);
        });
        this.status = document.createElement('span'); this.status.className = 'reaction-status'; this.status.setAttribute('role', 'status'); this.append(this.status);
        this.retry = document.createElement('button'); this.retry.type = 'button'; this.retry.textContent = 'Reintentar'; this.retry.hidden = true; this.retry.onclick = () => this.refresh(); this.append(this.retry);
    }
    activate() {
        if (!this.socket && typeof io === 'function') {
            this.socket = window.communitySocket || window.sharedReactionSocket || (window.sharedReactionSocket = io());
            this.listener = event => { if (event.id === this.dataset.id) this.refresh(); };
            this.socket.on('reloadReactions', this.listener);
        }
        this.refresh();
    }
    disconnectedCallback() { this.controller?.abort(); this.socket?.off('reloadReactions', this.listener); this.socket = null; }
    async refresh() {
        if (this.loading) { this.refreshAgain = true; return; }
        if (!this.isConnected || !/^Matesito_post-(?:[CFG]-)?[1-9]\d*$/.test(this.dataset.id)) return;
        this.loading = true; this.controller = new AbortController(); this.retry.hidden = true;
        try {
            const result = await fetch('/get/microreact--reactionss/' + this.dataset.id, { signal: this.controller.signal }).then(readResponse);
            if (!this.isConnected) return;
            const counts = new Map(result.reactions.map(row => [Number(row.reaction_id), Number(row.count)]));
            [...this.children].slice(0, 5).forEach((button, index) => {
                button.querySelector('span').textContent = counts.get(index + 1) || 0;
                button.setAttribute('aria-pressed', String(Number(result.selected) === index + 1));
            }); this.status.textContent = '';
        } catch (error) { if (error.name !== 'AbortError') { this.status.textContent = 'No se pudieron cargar las reacciones.'; this.retry.hidden = false; } }
        finally { this.loading = false; if (this.refreshAgain) { this.refreshAgain = false; this.refresh(); } }
    }
    async react(reaction) {
        if (this.sending) return;
        const cookie = document.cookie.split(';').map(x => x.trim()).find(x => x.startsWith('userID='));
        let userId; try { userId = cookie && decodeURIComponent(cookie.slice(7)); } catch {}
        if (!userId) return notify('Iniciá sesión para reaccionar.', 'error');
        this.sending = true; this.setAttribute('aria-busy', 'true');
        try {
            await fetch('/hit/microreact--reactions/' + this.dataset.id + '/' + reaction, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: userId })
            }).then(readResponse); await this.refresh();
        } catch (error) { notify(error.message, 'error'); }
        finally { this.sending = false; this.removeAttribute('aria-busy'); }
    }
}
customElements.define('mate-reactions', MateReactions);
