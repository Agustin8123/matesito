const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, 'public', 'html');
const sidebar = fs.readFileSync(path.join(root, 'partials', 'sidebar.html'), 'utf8').trim();
const pages = new Map();
for (const file of fs.readdirSync(root).filter(file => file.endsWith('.html'))) {
    const name = file.slice(0, -5);
    const navigation = sidebar.replace(`href="/${file}"`, `href="/${file}" aria-current="page"`);
    pages.set(name.toLowerCase(), fs.readFileSync(path.join(root, file), 'utf8').replace('<!-- shared-sidebar -->', navigation));
}
module.exports = name => pages.get(String(name).toLowerCase());
