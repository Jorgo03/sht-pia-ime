#!/usr/bin/env node

/**
 * Renders the development QR code for this project to a scannable image.
 *
 * WHY THIS EXISTS
 * Metro already prints a QR in the terminal, which makes this look redundant
 * until you try to scan one. The terminal code is drawn with block characters,
 * and Command Prompt and PowerShell render those with cell padding and a
 * non-square aspect ratio; the modules distort just enough that a phone camera
 * never locks on. A ligature-heavy or non-monospace font does the same on
 * macOS and Linux. The failure is silent -- the QR looks correct to a human and
 * simply does not scan.
 *
 * WHERE THE URL COMES FROM
 * Nothing here is hand-assembled. The URL is built by @expo/cli's own
 * UrlCreator, the same class `expo start` uses to produce the address it
 * prints, so this code cannot drift from what the running server actually
 * serves. That matters for the details that are easy to get wrong by hand:
 *
 *   - REACT_NATIVE_PACKAGER_HOSTNAME wins over auto-detection, which is what
 *     scripts/start-expo-lan.cjs sets, so the two agree by construction;
 *   - EXPO_PACKAGER_PROXY_URL is honoured;
 *   - LAN detection is Expo's own getIpAddress(), not a hand-rolled scan of
 *     os.networkInterfaces();
 *   - a tunnel host carries its port inside the subdomain, and Expo's tunnel
 *     path correctly emits no explicit port. Appending :8081 to an .exp.direct
 *     host sends the phone to a port the tunnel does not listen on.
 *
 * The app's scheme is read through @expo/config's getConfig(), so it follows
 * app.json / app.config.* rather than being duplicated here.
 *
 * TWO TARGETS, because this project has both runtimes installed:
 *   --target=go            exp://HOST:PORT                    (Expo Go)
 *   --target=dev-client    shtepia-ime://expo-development-client/?url=...
 *                                                             (expo-dev-client)
 *
 * Usage:
 *   npm run expo:qr
 *   npm run expo:qr -- --target=dev-client
 *   npm run expo:qr -- --tunnel=abc123-user-8081.exp.direct
 *   npm run expo:qr -- --host=192.168.1.42
 *   npm run expo:qr -- --print          (URL only, no page)
 *
 * Start the server first, in its own terminal:
 *   npm run expo:go            (Expo Go, same Wi-Fi)
 *   npm run expo:tunnel:go     (Expo Go, over a tunnel)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const { requireFromExpo } = require('./require-from-expo.cjs');

const { UrlCreator } = requireFromExpo('@expo/cli/build/src/start/server/UrlCreator', 'expo:qr');
const { getConfig } = requireFromExpo('@expo/config', 'expo:qr');

/* ------------------------------------------------------------------- args */

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};

const port = Number(value('port') || 8081);
const tunnelHost = value('tunnel');
const hostOverride = value('host');
const target = value('target') || 'go';
const printOnly = flag('print');

if (!['go', 'dev-client'].includes(target)) {
  console.error(`[expo:qr] Unknown --target=${target}. Use "go" or "dev-client".`);
  process.exit(1);
}

/* ----------------------------------------------------------------- config */

// getConfig() rather than reading app.json directly: it resolves
// app.config.js/ts too, and applies the same normalisation the CLI does.
const { exp } = getConfig(process.cwd(), {
  skipSDKVersionRequirement: true,
  isPublicConfig: true,
});

if (target === 'dev-client' && !exp.scheme) {
  console.error(
    '[expo:qr] This project declares no `scheme`, so a dev-client URL cannot be built.\n' +
      '          Add one to app.json under expo.scheme, or use --target=go.',
  );
  process.exit(1);
}

/* -------------------------------------------------------------------- url */

// A host passed on the command line is fed in the way Expo itself reads one,
// so the same precedence rules apply rather than a parallel code path.
if (hostOverride) {
  process.env.REACT_NATIVE_PACKAGER_HOSTNAME = hostOverride;
}

// Routing a tunnel host through Expo's own tunnel branch is what keeps the
// port off it: getTunnelUrlComponents() takes the port from the parsed tunnel
// URL, which for an https .exp.direct host is empty.
const hostType = tunnelHost ? 'tunnel' : 'lan';
const bundlerInfo = {
  port,
  getTunnelUrl: () => (tunnelHost ? `https://${tunnelHost}` : null),
};

const scheme = target === 'go' ? 'exp' : Array.isArray(exp.scheme) ? exp.scheme[0] : exp.scheme;
const urlCreator = new UrlCreator({ scheme, hostType }, bundlerInfo);

const url =
  target === 'go'
    ? urlCreator.constructUrl({ scheme: 'exp', hostType })
    : urlCreator.constructDevClientUrl({ hostType });

if (!url) {
  console.error('[expo:qr] Expo could not construct a URL for this configuration.');
  process.exit(1);
}

if (printOnly) {
  process.stdout.write(url + '\n');
  process.exit(0);
}

/* --------------------------------------------------------------------- qr */

/**
 * Renders the QR as inline SVG.
 *
 * The encoder is the one qrcode-terminal vendors -- no network, which matters:
 * an earlier version of this script fetched a QR library from a CDN and
 * produced a blank page on any machine that could not reach it, the same
 * silent failure the script exists to remove.
 *
 * qrcode-terminal is a declared devDependency. It used to be treated as free
 * because @expo/cli depends on it, and that was wrong: a transitive dependency
 * is only importable while npm happens to hoist it to the top level. On an
 * install where it stayed nested this threw MODULE_NOT_FOUND at the moment the
 * QR was about to be drawn -- after Metro had started, which is the worst
 * possible time to discover a missing package.
 *
 * Error correction is H (~30% recoverable). A development URL is short, so the
 * extra modules cost nothing in practice, and the redundancy is what keeps the
 * code readable on a glossy phone screen at an angle, or printed.
 *
 * QUIET is the four-module margin the spec requires. Scanners use it to find
 * the symbol's edges; a code drawn flush to its container often will not read.
 *
 * SVG rather than a raster: it stays exact at any size, on screen or printed,
 * with no resampling. shape-rendering=crispEdges stops module boundaries being
 * antialiased to grey, which is what makes a scaled SVG QR fail to scan.
 */
/**
 * Loads the vendored encoder, looking beside @expo/cli as well as in the
 * project's own node_modules.
 *
 * The second path is what makes this work on an install that has not been
 * refreshed since qrcode-terminal was declared: npm may have placed it under
 * @expo/cli/node_modules rather than at the top level, where a bare require
 * cannot see it. If neither resolves, say what to run -- a MODULE_NOT_FOUND
 * stack trace tells a developer nothing about which package to install.
 */
function loadEncoder() {
  const roots = [__dirname];
  try {
    roots.push(path.dirname(require.resolve('@expo/cli/package.json', { paths: [process.cwd()] })));
  } catch {
    // @expo/cli missing entirely is a broken install; the error below covers it.
  }

  for (const root of roots) {
    try {
      const base = require.resolve('qrcode-terminal/vendor/QRCode', { paths: [root] });
      return {
        QRCode: require(base),
        ErrorCorrectLevel: require(require.resolve('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel', { paths: [root] })),
      };
    } catch {
      // Try the next root.
    }
  }

  console.error(
    '[expo:qr] The QR encoder (qrcode-terminal) is not installed, so no code\n' +
      '          can be drawn. It is a devDependency of this project:\n\n' +
      '            npm install\n\n' +
      '          Then run this again. Metro itself is unaffected — if a dev\n' +
      '          server is already running you can keep using it.',
  );
  process.exit(1);
}

function qrSvg(text, pixels) {
  const { QRCode, ErrorCorrectLevel } = loadEncoder();

  const qr = new QRCode(-1, ErrorCorrectLevel.H);
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const QUIET = 4;
  const side = count + QUIET * 2;

  let rects = '';
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) {
        rects += `<rect x="${col + QUIET}" y="${row + QUIET}" width="1" height="1"/>`;
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" ` +
    `viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges" role="img" ` +
    `aria-label="Development link ${text}">` +
    `<rect width="${side}" height="${side}" fill="#ffffff"/>` +
    `<g fill="#000000">${rects}</g></svg>`
  );
}

/* ------------------------------------------------------------------- page */

const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const targetLabel = target === 'go' ? 'Expo Go' : 'development build';
const outFile = path.join(os.tmpdir(), `shtepia-expo-qr-${target}.html`);

/**
 * The address the page polls to show whether this QR is still live.
 *
 * A dev QR encodes a machine address, and machine addresses expire: DHCP hands
 * out a different one after a reconnect, and the server stops when the terminal
 * is closed. A page left open then shows a code that looks perfectly valid and
 * silently is not — which is the failure that wastes the most time, because
 * nothing on screen admits it.
 */
// Built by the same UrlCreator, so it points at the same server the QR does —
// for a dev-client target too, whose URL wraps the manifest address rather than
// being it, and for a tunnel, where the port lives in the subdomain.
const probeUrl =
  urlCreator.constructUrl({ scheme: hostType === 'tunnel' ? 'https' : 'http', hostType }) +
  '/status';

// Typography and colour follow the app's own tokens (Newsreader / Manrope and
// the --fho accent ramp) so this reads as part of the project rather than a
// stray tool page. Fonts degrade to system faces when offline; the QR itself
// never depends on anything remote.
const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(exp.name)} — scan to open</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,500;6..72,600&family=Manrope:wght@400;600;700&display=swap">
<style>
  :root{--ground:#FBF7F3;--card:#fff;--ink:#181310;--soft:#6B6057;--line:#E7DED3;--accent:#E85D00}
  @media (prefers-color-scheme:dark){:root{--ground:#12100E;--card:#1C1815;--ink:#F5EEE6;--soft:#A79A8C;--line:#302923;--accent:#FF8F3D}}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
       background:var(--ground);color:var(--ink);
       font-family:Manrope,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .card{width:100%;max-width:400px;background:var(--card);border:1px solid var(--line);
        border-radius:16px;padding:30px 28px;text-align:center}
  .eyebrow{font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:var(--accent);font-weight:700}
  h1{font-family:Newsreader,Georgia,serif;font-size:23px;font-weight:600;margin:8px 0 22px;line-height:1.25}
  /* White plate under the code: the card follows the OS theme, and an inverted
     QR does not scan on many Android cameras. */
  .plate{display:inline-block;background:#fff;padding:12px;border-radius:10px;line-height:0}
  .plate svg{display:block;width:280px;height:280px;max-width:100%}
  code{display:block;margin-top:20px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
       font-size:12px;color:var(--accent);font-weight:600;word-break:break-all;line-height:1.5}
  p{margin:18px 0 0;font-size:13px;color:var(--soft);line-height:1.6}
  .live{display:inline-flex;align-items:center;gap:8px;margin-top:16px;padding:7px 13px;
        border-radius:999px;border:1px solid var(--line);font-size:12.5px;font-weight:600}
  .dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto;background:var(--soft)}
  .live[data-state="up"]{border-color:#2C6B4E44;color:#2C6B4E}
  .live[data-state="up"] .dot{background:#2C6B4E}
  .live[data-state="down"]{border-color:#A81E1444;color:#A81E14}
  .live[data-state="down"] .dot{background:#A81E14}
  @media (prefers-color-scheme:dark){
    .live[data-state="up"]{color:#6FC098} .live[data-state="up"] .dot{background:#6FC098}
    .live[data-state="down"]{color:#F0857C} .live[data-state="down"] .dot{background:#F0857C}
  }
</style></head>
<body><main class="card">
  <div class="eyebrow">${escapeHtml(exp.name)}</div>
  <h1>Scan to open in ${targetLabel}</h1>
  <div class="plate">${qrSvg(url, 280)}</div>
  <code>${escapeHtml(url)}</code>
  <div class="live" id="live" data-state="checking"><span class="dot"></span><span id="liveText">Checking the server…</span></div>
  <p>${
    target === 'go'
      ? 'Android: scan from inside the Expo Go app. iOS: use the system Camera.'
      : 'Scan with the camera on a device that has the development build installed.'
  }<br>The dev server must stay running${hostType === 'tunnel' ? '.' : ', and the phone must be on this same network.'}</p>
</main>
<script>
  // Whether this code is still worth scanning.
  //
  // Metro sends no CORS headers, so an ordinary fetch from a file:// page is
  // blocked before it can be read. mode:'no-cors' gives back an opaque response
  // instead, which is enough here: it resolves when something answered and
  // rejects on a network failure, and "did anything answer" is the whole
  // question. Nothing is read from the body.
  //
  // The point is that a stale QR should say so. The address is your machine's,
  // and machines change address -- a page left open from yesterday looks
  // identical to one that works.
  (function () {
    var el = document.getElementById('live');
    var text = document.getElementById('liveText');
    var probe = ${JSON.stringify(probeUrl)};
    var failures = 0;

    function set(state, message) {
      el.setAttribute('data-state', state);
      text.textContent = message;
    }

    async function check() {
      try {
        await fetch(probe, { mode: 'no-cors', cache: 'no-store' });
        failures = 0;
        set('up', 'Server is running — scan now');
      } catch (e) {
        // One miss is usually a hiccup; two in a row is a stopped server.
        if (++failures >= 2) set('down', 'Server not reachable — rerun npm start');
      }
    }

    check();
    setInterval(check, 4000);
  })();
</script>
</body></html>
`;

/* -------------------------------------------------------------- liveness */

/**
 * Is a dev server actually listening?
 *
 * Metro answers /status with the literal `packager-status:running`, which is
 * what the Expo and React Native CLIs probe themselves.
 *
 * This check earns its place: a QR is only an address, and printing one while
 * nothing is running produces a code that scans perfectly and then fails on
 * the phone. Over a tunnel that arrives as `ERR_NGROK_3200 -- the endpoint is
 * offline`, which reads like a broken QR and sends you to debug the code
 * instead of the server. Localhost is the right thing to probe even when the
 * target is a tunnel: the tunnel only forwards, so if the local server is down
 * the public endpoint is dead too.
 */
function devServerRunning() {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/status', timeout: 2000 }, (res) => {
      let body = '';
      res.on('data', (c) => {
        body += c;
      });
      res.on('end', () => resolve(body.includes('packager-status:running')));
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  if (!(await devServerRunning())) {
    console.error(
      `[expo:qr] No Expo dev server is listening on port ${port}, so this QR would\n` +
        '          scan correctly and then fail on the phone — over a tunnel that\n' +
        '          arrives as "ERR_NGROK_3200: the endpoint is offline".\n\n' +
        '          Start the server first, in its own terminal, and leave it running:\n\n' +
        '            npm run expo:go            (phone on the same Wi-Fi)\n' +
        '            npm run expo:tunnel:go     (different networks, or Wi-Fi that\n' +
        '                                        blocks phone-to-computer traffic)\n\n' +
        '          Wait until it reports it is ready, then run this again.\n' +
        '          A tunnel takes 10-30 seconds to come up, and prints its own\n' +
        '          .exp.direct address — pass it with --tunnel=<that-host>.',
    );
    process.exit(1);
  }

  fs.writeFileSync(outFile, html, 'utf8');

  console.log(`[expo:qr] ${url}`);
  console.log(`[expo:qr] target: ${targetLabel} · host: ${hostType} · port: ${port}`);
  console.log(`[expo:qr] opening ${outFile}`);

  // `start` needs an empty title argument first, or it treats the path as one.
  const opener =
    process.platform === 'win32'
      ? `start "" "${outFile}"`
      : process.platform === 'darwin'
        ? `open "${outFile}"`
        : `xdg-open "${outFile}"`;

  const child = spawn(opener, { stdio: 'ignore', shell: true, detached: true });
  child.on('error', () => {
    console.log('[expo:qr] Could not open a browser — open the file above by hand.');
  });
  child.unref();
}

main();
