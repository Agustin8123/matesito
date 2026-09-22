const fs = require('fs'); const path = require('path'); const { JSDOM } = require('jsdom');
for (const file of fs.readdirSync('public').filter(f => f.endsWith('.html'))) {
    const d = new JSDOM(fs.readFileSync('public/' + file, 'utf8')).window.document;
    for (const el of d.querySelectorAll('[src],link[href],a[href]')) {
        const url = el.getAttribute('src') || el.getAttribute('href');
        if (!url || /^(https?:|mailto:|#|data:)/.test(url) || url.startsWith('/socket.io/')) continue;
        const target = path.join('public', decodeURI(url.split('?')[0]));
        if (!fs.existsSync(target) && !fs.existsSync(target + '.html')) console.log(file, url);
    }
}
