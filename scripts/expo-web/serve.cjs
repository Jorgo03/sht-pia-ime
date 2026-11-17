#!/usr/bin/env node
// Serves an Expo web export the way deploy/expo-web/vercel.json does, for the
// e2e tests (playwright.expo.config.ts) and local checks:
//   node scripts/expo-web/serve.cjs <dir> [port]
// - clean URLs: /privacy -> privacy.html, /favorites -> favorites/index.html;
// - a pre-rendered listing page (property/<id>.html) wins over the template;
// - dynamic routes fall back to their [id] page (/listing/<id>/edit);
// - anything else gets 404.html with status 404.
const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.resolve(process.argv[2] || 'dist-expo');
// The redirects in deploy/expo-web/vercel.json, so tests cover old Vite links.
// Supports `:param` segments and a `has` query condition with one named
// group, which is all that file uses.
const REDIRECTS = JSON.parse(fs.readFileSync(path.join(__dirname, '../../deploy/expo-web/vercel.json'), 'utf8')).redirects || [];

function redirectFor(url) {
  for (const r of REDIRECTS) {
    const names = [];
    const pattern = new RegExp(`^${r.source.replace(/:([a-zA-Z]+)/g, (_, n) => { names.push(n); return '([^/]+)'; })}$`);
    const m = url.pathname.match(pattern);
    if (!m) continue;
    const values = Object.fromEntries(names.map((n, i) => [n, m[i + 1]]));
    let ok = true;
    for (const cond of r.has || []) {
      const v = url.searchParams.get(cond.key);
      const cm = v == null ? null : new RegExp(`^${cond.value}$`).exec(v);
      if (!cm) ok = false;
      else Object.assign(values, cm.groups || {});
    }
    if (!ok) continue;
    let dest = r.destination.replace(/:([a-zA-Z]+)/g, (_, n) => values[n] ?? '');
    // Vercel keeps the query string unless the rule consumed it (has).
    if (!r.has && url.search) dest += url.search;
    return { dest, status: r.permanent ? 308 : 307 };
  }
  return null;
}
const port = Number(process.argv[3] || 4174);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ttf': 'font/ttf',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
};

function candidates(urlPath) {
  const parts = urlPath.split('/').filter(Boolean);
  const out = [urlPath, `${urlPath}.html`, path.posix.join(urlPath, 'index.html')];
  for (let i = 0; i < parts.length; i++) {
    const alt = `/${parts.map((p, j) => (j === i ? '[id]' : p)).join('/')}`;
    out.push(`${alt}.html`, path.posix.join(alt, 'index.html'));
  }
  return out;
}

function send(res, file, status = 200) {
  res.writeHead(status, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}

http
  .createServer((req, res) => {
    let urlPath;
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
      urlPath = decodeURIComponent(url.pathname);
    } catch {
      res.writeHead(400);
      return res.end();
    }
    const redirect = redirectFor(url);
    if (redirect) {
      res.writeHead(redirect.status, { location: redirect.dest });
      return res.end();
    }
    if (urlPath === '/') urlPath = '/index.html';
    for (const c of candidates(urlPath)) {
      const file = path.join(root, c);
      if (file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) return send(res, file);
    }
    const notFound = path.join(root, '404.html');
    if (fs.existsSync(notFound)) return send(res, notFound, 404);
    res.writeHead(404);
    res.end('Not found');
  })
  .listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
