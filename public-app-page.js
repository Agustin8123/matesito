const renderPage = require('./page-renderer');
const seo = require('./public-seo');
// Keep the complete public content in HTML, then enhance it with the same app UI.
module.exports = function publicAppPage(document, route) {
 const main = document.match(/<main\b[\s\S]*?<\/main>/)?.[0];
 const head = document.split('</head>')[0];
 const metadata = (head.match(/<link rel="canonical"[^>]*>|<meta (?:name="(?:description|robots)"|property="og:[^"]+")[^>]*>|<script type="application\/ld\+json">[\s\S]*?<\/script>/g) || []).join('');
 const title = head.match(/<title>[\s\S]*?<\/title>/)?.[0] || '<title>Matesito</title>';
 const data = JSON.stringify(route).replace(/</g, '\\u003c');
 return seo.shell(renderPage('index'))
  .replace(/<title>[\s\S]*?<\/title>/, () => title)
  .replace('<head>', '<head><base href="/">')
  .replace('</head>', () => metadata + '<link rel="stylesheet" href="/pages.css"><style>.public-loading #appContainer{display:none!important}</style><script id="publicRoute" type="application/json">'+data+'</script></head>')
  .replace('<body>', '<body class="public-loading">')
  .replace(/<div class="overlay"/g, '<div data-nosnippet class="overlay"')
  .replace('<dialog ', '<dialog data-nosnippet ')
  .replace('<div class="container right-side" id="appContainer">', () => main.replace('id="page-content"', 'id="serverPublicContent"')+'<div class="container right-side" id="appContainer">')
  .replace('id="initialOverlay">', 'id="initialOverlay" style="display:none">')
  .replace('<div class="header app-header">', '<div class="header app-header" data-nosnippet>');
};
