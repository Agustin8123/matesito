const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function summary(value, fallback, limit = 180) {
 const text = String(value || '').replace(/\s+/g, ' ').trim() || fallback;
 if (Array.from(text).length <= limit) return text;
 const cut = Array.from(text).slice(0, limit - 1).join('');
 const space = cut.lastIndexOf(' ');
 return (space > limit * .65 ? cut.slice(0, space) : cut) + '…';
}
function shell(html) {
 return html.replace(/<aside\b[\s\S]*?<\/aside>/g, value => '<div data-nosnippet>'+value+'</div>')
  .replace(/<header\b[\s\S]*?<\/header>/g, value => '<div data-nosnippet>'+value+'</div>')
  .replace(/<a class="skip-link"[^>]*>[\s\S]*?<\/a>/g, value => '<div data-nosnippet>'+value+'</div>');
}
function structured(value) { return '<script type="application/ld+json">'+JSON.stringify(value).replace(/</g,'\\u003c')+'</script>'; }
module.exports = {esc,summary,shell,structured};
