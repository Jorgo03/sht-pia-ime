#!/usr/bin/env node
// Builds the Shtëpia.ime simulator (simulator/README.md): the real app's web
// build, compiled against a pretend Supabase at https://demo.supabase.co that
// simulator/demo-backend.js answers inside the page. Never contacts the real
// project.
//
//   node scripts/build-simulator.mjs [outDir] [--skip-export]
//
// Writes <outDir>/ (default dist-simulator/):
//   simulator.html  the page: the export's index.html without its document
//                   wrapper, demo data and backend inlined first, leaflet CSS
//                   inlined (an Artifact page loads stylesheets inline only)
//   index.html      the same page as a full document, for local checks
//   files.json      { "<published path>": "<file on disk>" } for every file the
//                   page needs: scripts, fonts, icons, the drawn photos
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Buffer } from 'node:buffer';

import { PLACEHOLDER_SVG, SCENE_NAMES, TILE_SVG, photoSvg } from '../simulator/photos.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const OUT = resolve(ROOT, args.find((a) => !a.startsWith('--')) ?? 'dist-simulator');
const SKIP_EXPORT = args.includes('--skip-export');

if (!SKIP_EXPORT) {
  rmSync(OUT, { recursive: true, force: true });
  execFileSync('npx', ['expo', 'export', '-p', 'web', '--clear', '--output-dir', relative(ROOT, OUT)], {
    cwd: ROOT,
    stdio: 'inherit',
    env: {
      ...process.env,
      // Set here, so .env and .env.local (which name the real project) are
      // ignored: Expo never overrides a variable that is already set.
      EXPO_PUBLIC_SUPABASE_URL: 'https://demo.supabase.co',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: 'demo-anon-key',
      EXPO_PUBLIC_SITE_URL: '',
      CI: '1',
    },
  });
}

// The Artifact host reserves top-level names that start with "_", so the
// export's _expo/ folder is served as expo/ and every reference follows it.
if (!SKIP_EXPORT) {
  renameSync(join(OUT, '_expo'), join(OUT, 'expo'));
  for (const f of readdirSync(join(OUT, 'expo/static/js/web'))) {
    const p = join(OUT, 'expo/static/js/web', f);
    writeFileSync(p, readFileSync(p, 'utf8').split('"/_expo/static/').join('"/expo/static/'));
  }
  const ix = join(OUT, 'index.html');
  writeFileSync(ix, readFileSync(ix, 'utf8').split('/_expo/static/').join('/expo/static/'));
}

// Refuse to ship a bundle that could reach the real database.
const jsDir = join(OUT, 'expo/static/js/web');
for (const f of readdirSync(jsDir)) {
  const js = readFileSync(join(jsDir, f), 'utf8');
  if (/xzzzhlwmzotibrxdqmcm|[a-z]{20}\.supabase\.co/.test(js)) throw new Error(`${f} names a real Supabase project; refusing to build the simulator.`);
}

// The drawn photos, a placeholder and a plain map tile.
const seedSrc = readFileSync(join(ROOT, 'simulator/seed.js'), 'utf8');
const photos = new Set([...seedSrc.matchAll(/photo\('([a-z]+)', (\d+)\)/g)].map((m) => `${m[1]}-${m[2]}`));
mkdirSync(join(OUT, 'sim/photos'), { recursive: true });
for (const name of photos) {
  const [scene, n] = name.split('-');
  if (!SCENE_NAMES.includes(scene)) throw new Error(`seed.js uses an unknown photo scene: ${scene}`);
  writeFileSync(join(OUT, `sim/photos/${name}.svg`), photoSvg(scene, Number(n)));
}
writeFileSync(join(OUT, 'sim/photos/placeholder.svg'), PLACEHOLDER_SVG);
writeFileSync(join(OUT, 'sim/tile.svg'), TILE_SVG);

// The page. The export's own index.html is kept as export-index.html, since
// index.html is overwritten below and --skip-export rebuilds from the original.
if (!SKIP_EXPORT) renameSync(join(OUT, 'index.html'), join(OUT, 'export-index.html'));
const html = readFileSync(join(OUT, 'export-index.html'), 'utf8');
const head = /<head>([\s\S]*)<\/head>/.exec(html)[1];
const body = /<body>([\s\S]*)<\/body>/.exec(html)[1];
const inlineCss = (part) =>
  part
    .replace(/<link rel="preload" href="[^"]+\.css" as="style"\/>/g, '')
    .replace(/<link rel="stylesheet" href="(\/expo\/static\/css\/[^"]+\.css)"\/>/g, (_, href) => `<style>${readFileSync(join(OUT, href), 'utf8')}</style>`)
    .replace(/<meta charSet="utf-8"\/>|<meta name="viewport"[^>]*\/>|<meta http-equiv[^>]*\/>|<title>[^<]*<\/title>/g, '');
const script = (file) => `<script>\n${readFileSync(join(ROOT, file), 'utf8').replace(/<\/script/gi, '<\\/script')}\n</script>`;

const SIM_CSS = `<style>
.sim-ui{position:fixed;right:0;top:38%;z-index:2147483000;font:500 13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif;color:#2a211b}
.sim-pill{writing-mode:vertical-rl;min-width:28px;padding:12px 0;border-radius:10px 0 0 10px;border:0;background:#2a211b;color:#fff;font:inherit;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;box-shadow:0 6px 18px rgba(0,0,0,.18);opacity:.88;cursor:pointer}
.sim-pill::before{content:"";display:inline-block;width:7px;height:7px;margin-bottom:8px;border-radius:50%;background:#ff7d1a}
.sim-panel{position:absolute;right:34px;top:-40px;width:min(300px,calc(100vw - 24px));padding:14px;border-radius:16px;background:#fffaf4;border:1px solid #eadfd2;box-shadow:0 12px 32px rgba(0,0,0,.2)}
.sim-panel[hidden]{display:none}
.sim-title{margin:0 0 4px;font-weight:800;font-size:14px}
.sim-text,.sim-who,.sim-small{margin:0 0 10px;color:#5b4c40}
.sim-small{margin:10px 0 0;font-size:12px}
.sim-row{display:flex;gap:8px;margin-top:8px}
.sim-row button{flex:1;min-height:40px;border-radius:10px;border:1px solid #eadfd2;background:#fff;color:#2a211b;font:inherit;font-weight:700;cursor:pointer}
.sim-row button[data-sim=agent],.sim-row button[data-sim=client]{background:#ff7d1a;border-color:#e85d00;color:#fff}
.sim-toast{position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:2147483001;max-width:min(420px,calc(100vw - 32px));padding:12px 16px;border-radius:12px;background:#2a211b;color:#fff;font:500 14px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25)}
.sim-toast[hidden]{display:none}
@media (prefers-color-scheme: dark){.sim-panel{background:#1f1915;border-color:#3a2f27;color:#f3ebe2}.sim-text,.sim-who,.sim-small{color:#cbbcad}.sim-row button{background:#2a221c;border-color:#3a2f27;color:#f3ebe2}.sim-pill{background:#fffaf4;color:#2a211b}}
</style>`;

const page =
  '<title>Shtëpia.ime Simulator</title>\n' +
  '<meta name="description" content="The Shtëpia.ime app with demo data: every screen works, nothing reaches the real app."/>\n' +
  script('simulator/seed.js') + '\n' +
  script('simulator/demo-backend.js') + '\n' +
  SIM_CSS + '\n' +
  inlineCss(head) + '\n' +
  inlineCss(body);
writeFileSync(join(OUT, 'simulator.html'), page);
writeFileSync(
  join(OUT, 'index.html'),
  `<!DOCTYPE html><html lang="sq"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/></head><body>${page}</body></html>`,
);

// Every file the page needs. The per-route .html pages are not: the app
// routes in the browser from the one page.
const files = {};
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else {
      const rel = relative(OUT, p).split('\\').join('/');
      if (/\.html$|^files\.json$|\.css$|\.map$|^_sitemap|^robots\.txt$|^sitemap|\/\.routes\.json$|^og-image/.test(rel)) continue;
      files[rel] = relative(ROOT, p).split('\\').join('/');
    }
  }
};
walk(OUT);
writeFileSync(join(OUT, 'files.json'), JSON.stringify(files, null, 2));
const bytes = Object.values(files).reduce((n, f) => n + statSync(join(ROOT, f)).size, 0) + Buffer.byteLength(page);
console.log(`simulator: ${Object.keys(files).length} files + page, ${(bytes / 1e6).toFixed(1)} MB -> ${relative(ROOT, OUT)}`);
if (Object.keys(files).length > 250) throw new Error('More files than one Artifact publish takes (255).');
