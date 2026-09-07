#!/usr/bin/env node

/**
 * Writes the Expo Go QR code to an image you can actually scan, and opens it.
 *
 * Metro already prints a QR in the terminal, so this looks redundant until you
 * try to scan one on Windows: the code is drawn with block characters, and
 * Command Prompt / PowerShell render those with cell padding and a non-square
 * aspect ratio, which distorts the modules just enough that a phone camera
 * cannot lock on. Terminals with a ligature-heavy or non-monospace font do the
 * same thing on macOS and Linux. The failure is silent — the QR looks fine to
 * a human and simply never scans.
 *
 * Rendering to a real image sidesteps the terminal entirely.
 *
 * The address comes from start-expo-lan.cjs's own detection, imported rather
 * than reimplemented, so the QR can never point somewhere other than where
 * Metro is listening.
 *
 * Usage:
 *   npm run expo:qr                 (assumes Metro's default port, 8081)
 *   npm run expo:qr -- --port=8082
 *   npm run expo:qr -- --host=192.168.1.42   (override detection entirely)
 *
 * Start Metro separately — this only draws the code:
 *   EXPO_OFFLINE=1 npm run expo:go
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const { findLanAddress } = require('./start-expo-lan.cjs');

function argValue(name) {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

const port = argValue('port') || '8081';
const hostOverride = argValue('host');

const detected = hostOverride ? { address: hostOverride, name: 'override' } : findLanAddress();

if (!detected) {
  console.error(
    '[expo:qr] Could not detect a LAN IPv4 address on this machine.\n' +
      '          Find it yourself and pass it in:\n' +
      '            macOS    ipconfig getifaddr en0\n' +
      '            Windows  ipconfig        (IPv4 Address on your Wi-Fi adapter)\n' +
      '            Linux    hostname -I\n' +
      '          then:  npm run expo:qr -- --host=<that-address>',
  );
  process.exit(1);
}

/**
 * A tunnel host already carries its port in the subdomain.
 *
 * `npm run expo:tunnel` publishes the dev server as
 * <slug>-<user>-<port>.exp.direct, reached over ordinary 443. Appending :8081
 * to that sends Expo Go to a port the tunnel does not listen on, and the
 * connection fails with no useful message. Only a bare IPv4 literal — the LAN
 * case — takes an explicit port.
 */
const isIpv4 = /^\d{1,3}(\.\d{1,3}){3}$/.test(detected.address);
const url = isIpv4 ? `exp://${detected.address}:${port}` : `exp://${detected.address}`;

/**
 * Renders the QR as inline SVG.
 *
 * The encoder is the one qrcode-terminal already vendors, which Expo's CLI
 * pulls in — so this adds no dependency to package.json and, more importantly,
 * needs no network. An earlier version fetched a QR library from a CDN, which
 * meant the page silently produced nothing on a machine that could not reach
 * it: the exact class of failure this script exists to remove.
 *
 * `QUIET` is the four-module margin the QR spec requires. Scanners use it to
 * find the symbol's edges, and a code drawn flush to the border of its
 * container frequently will not read at all.
 */
function qrSvg(text, pixels) {
  const QRCode = require('qrcode-terminal/vendor/QRCode');
  const ErrorCorrectLevel = require('qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel');

  const qr = new QRCode(-1, ErrorCorrectLevel.M);
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

  // shape-rendering=crispEdges keeps module boundaries from being antialiased
  // into grey, which is what makes a scaled-down SVG QR fail to scan.
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" ` +
    `viewBox="0 0 ${side} ${side}" shape-rendering="crispEdges" role="img" ` +
    `aria-label="Expo Go link ${text}">` +
    `<rect width="${side}" height="${side}" fill="#ffffff"/>` +
    `<g fill="#000000">${rects}</g></svg>`
  );
}

// Written to the OS temp directory rather than the repo: it is a throwaway
// view of a value that changes with every network, and it should never end up
// committed or cluttering `git status`.
const outFile = path.join(os.tmpdir(), 'shtepia-expo-go-qr.html');

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Expo Go — Shtëpia.ime</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
       background:#FDFBF8;color:#1A1512;
       font-family:Manrope,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  .card{text-align:center;padding:34px 38px;background:#fff;border:1px solid #E9E1D7;border-radius:16px}
  .eyebrow{font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#E85D00;font-weight:700}
  h1{font-size:21px;margin:8px 0 20px;font-weight:700}
  #qr{display:inline-block;line-height:0}
  code{display:block;margin-top:20px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
       font-size:14px;color:#E85D00;font-weight:600}
  p{margin:16px 0 0;font-size:13px;color:#6E655B;max-width:34ch;line-height:1.6}
</style></head>
<body><div class="card">
  <div class="eyebrow">Shtëpia.ime</div>
  <h1>Scan with Expo&nbsp;Go</h1>
  <div id="qr">${qrSvg(url, 300)}</div>
  <code>${url}</code>
  <p>Android: scan from inside the Expo Go app. iOS: use the system Camera.
     Metro must be running, and the phone must be on this same Wi-Fi.</p>
</div>
</body></html>
`;

fs.writeFileSync(outFile, html, 'utf8');

console.log(`[expo:qr] ${url}  (from "${detected.name}")`);
console.log(`[expo:qr] Opening ${outFile}`);

// `start` needs an empty title argument first, or it treats the path as one.
const opener =
  process.platform === 'win32'
    ? `start "" "${outFile}"`
    : process.platform === 'darwin'
      ? `open "${outFile}"`
      : `xdg-open "${outFile}"`;

const child = spawn(opener, { stdio: 'ignore', shell: true, detached: true });
child.on('error', () => {
  console.log('[expo:qr] Could not open a browser automatically — open the file above by hand.');
});
child.unref();
