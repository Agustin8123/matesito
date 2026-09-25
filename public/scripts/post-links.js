(function (root) {
    'use strict';
    const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

    function linkifyPost(value) {
        const text = String(value ?? '');
        const pattern = /\b(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
        let result = '', position = 0;
        for (const match of text.matchAll(pattern)) {
            let label = match[0];
            // Sentence punctuation is not part of the destination. Keep balanced URL parentheses.
            while (label) {
                if (/[.,!?;:]$/.test(label)) { label = label.slice(0, -1); continue; }
                const pairs = { ')': '(', ']': '[', '}': '{' };
                const close = label.at(-1), open = pairs[close];
                if (open && label.split(close).length > label.split(open).length) { label = label.slice(0, -1); continue; }
                break;
            }
            result += escape(text.slice(position, match.index));
            try {
                const url = new URL(/^www\./i.test(label) ? 'https://' + label : label);
                if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error('Invalid link');
                result += '<a class="post-link" href="' + escape(url.href) + '" target="_blank" rel="noopener noreferrer ugc">' + escape(label) + '</a>';
                position = match.index + label.length;
            } catch {
                result += escape(match[0]);
                position = match.index + match[0].length;
            }
        }
        return result + escape(text.slice(position));
    }
    if (typeof module === 'object' && module.exports) module.exports = linkifyPost;
    else root.linkifyPost = linkifyPost;
})(typeof window === 'object' ? window : globalThis);
