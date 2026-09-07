#!/usr/bin/env node

/**
 * Starts the dev server for Expo Go and opens its QR once it is actually ready.
 *
 * WHY THIS EXISTS
 * The two-step version -- `npm run expo:go` in one terminal, `npm run expo:qr`
 * in another -- has an ordering trap that is easy to fall into and hard to
 * recognise. Scan before the server answers and the phone reports something
 * that looks like a broken code rather than a missing server: over a tunnel,
 * `ERR_NGROK_3200 -- the endpoint is offline`; on a LAN, a connection that
 * hangs and eventually times out. Both send you to debug the QR, which is the
 * one part that was never wrong.
 *
 * So this runs Metro in the foreground, polls until it genuinely answers, and
 * only then opens the code. Nothing to sequence by hand, and if the server
 * dies during startup you are told that instead of being handed a QR.
 *
 * Metro stays attached: quitting it (Ctrl+C) quits this too, which is what you
 * want, since the QR is worthless the moment the server stops.
 *
 * Usage:
 *   npm run expo:go:qr
 *   npm run expo:go:qr -- --port=8082
 */

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const argv = process.argv.slice(2);
const portArg = argv.find((a) => a.startsWith('--port='));
const port = Number(portArg ? portArg.slice(7) : 8081);

const READY_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 1_000;

function serverAnswers() {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/status', timeout: 1500 }, (res) => {
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// start-expo-lan.cjs rather than `expo start` directly: it is what pins
// REACT_NATIVE_PACKAGER_HOSTNAME to a freshly detected LAN address, and
// scripts/expo-qr.cjs reads that same variable through Expo's UrlCreator. Going
// around it would let the QR and the server disagree about the address.
const metro = spawn(
  process.execPath,
  [path.join(__dirname, 'start-expo-lan.cjs'), '--go', `--port=${port}`],
  { stdio: 'inherit', env: { ...process.env } },
);

let metroExited = false;
metro.on('exit', (code) => {
  metroExited = true;
  process.exit(code ?? 0);
});

process.on('SIGINT', () => metro.kill('SIGINT'));
process.on('SIGTERM', () => metro.kill('SIGTERM'));

(async () => {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (metroExited) return;
    if (await serverAnswers()) {
      // A short settle before drawing the code: Metro answers /status a moment
      // before it finishes announcing itself, and opening a browser into the
      // middle of that makes the terminal output confusing to read.
      await sleep(1500);
      console.log('\n[expo:go:qr] Dev server is up — opening the QR code.\n');
      spawn(process.execPath, [path.join(__dirname, 'expo-qr.cjs'), `--port=${port}`], {
        stdio: 'inherit',
      });
      return;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  console.error(
    `\n[expo:go:qr] The dev server did not answer on port ${port} within ` +
      `${READY_TIMEOUT_MS / 1000}s.\n` +
      '             Metro is still attached above — read its output for the reason.\n' +
      '             If it reported a port already in use, pass another one:\n' +
      '               npm run expo:go:qr -- --port=8082\n',
  );
})();
