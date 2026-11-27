#!/usr/bin/env node
// Serves a website build (scripts/build-website.mjs) the way the root
// vercel.json does, for playwright.website.config.ts and local checks:
//   node scripts/website/serve.cjs <dir> [port]
// - files first, with clean URLs (/search -> search.html, /privacy -> privacy/index.html);
// - then the vercel.json rewrites (every app route -> index.html);
// - anything else gets 404.html with status 404.
const fs = require('fs');
const http = require('http');
const path = require('path');

const root = path.resolve(process.argv[2] || 'dist-website');
const port = Number(process.argv[3] || 4175);
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../vercel.json'), 'utf8'));
const rewrites = (config.rewrites || []).filter((r) => !r.has).map((r) => ({
  re: new RegExp(`^${r.source.replace(/:[a-zA-Z]+/g, '[^/]+')}$`),
  to: r.destination,
}));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.xml': 'application/xml', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2' };

function file(p) {
  const full = path.join(root, p);
  if (!full.startsWith(root)) return null;
  try { return fs.statSync(full).isFile() ? full : null; } catch { return null; }
}
function resolve(pathname) {
  const p = decodeURIComponent(pathname).replace(/\/+$/, '') || '/';
  if (p === '/') return file('index.html');
  return file(p) || file(`${p}.html`) || file(`${p}/index.html`);
}

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  let found = resolve(url.pathname);
  let status = 200;
  if (!found) {
    const hit = rewrites.find((r) => r.re.test(url.pathname));
    if (hit) found = resolve(hit.to);
  }
  if (!found) { found = file('404.html'); status = 404; }
  if (!found) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(status, { 'content-type': TYPES[path.extname(found)] || 'application/octet-stream' });
  fs.createReadStream(found).pipe(res);
}).listen(port, () => console.log(`website on http://localhost:${port} (${root})`));
