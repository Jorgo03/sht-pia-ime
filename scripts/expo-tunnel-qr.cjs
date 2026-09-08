#!/usr/bin/env node

/**
 * Starts a tunnelled dev server for Expo Go and opens its QR — but only once
 * the tunnel is provably reachable from the public internet.
 *
 * WHY A TUNNEL AT ALL
 * A LAN QR (`npm run expo:go:qr`) encodes your machine's private address, so it
 * only works while the phone is on the same Wi-Fi, and not even then on
 * networks that isolate clients from each other. A tunnel gives the dev server
 * a public https address, so the phone can be on any Wi-Fi, on mobile data, or
 * on the other side of the world. That is the only mechanism Expo Go has for
 * working off-network.
 *
 * WHY IT VERIFIES BEFORE DRAWING THE CODE
 * Every failure in this area presents identically on the phone: `ERR_NGROK_3200
 * -- the endpoint is offline`. It means the .exp.direct hostname resolved at
 * Expo's edge but nothing was connected behind it, and it happens whether the
 * server never started, the tunnel failed to establish, or the server has since
 * stopped. The phone cannot tell those apart, which is why chasing it from the
 * phone end wastes so much time.
 *
 * So this checks two separate things, and says which one failed:
 *   1. the local dev server answers  (Metro's /status)
 *   2. the public tunnel host answers (an HTTPS request to the .exp.direct URL)
 * A QR is only produced when both hold. Anything else is reported as prose.
 *
 * HOW THE HOSTNAME IS DERIVED
 * Not guessed. AsyncNgrok builds it from three inputs, and this reads the same
 * ones through the same modules: the project's persisted `urlRandomness`, the
 * logged-in Expo account name (slugified, periods stripped), and the port. The
 * randomness is stored per project, which is why the address is stable between
 * runs rather than new every time.
 *
 * Usage:
 *   npm run expo:tunnel:qr
 *   npm run expo:tunnel:qr -- --port=8082
 */

const http = require('http');
const https = require('https');
const path = require('path');
const { spawn } = require('child_process');

const slugify = require('slugify');
// Resolved through the shared helper rather than by a bare require: these are
// Expo's own internals, and the SDK 57 bump moved a sibling package out of the
// top level, breaking exactly this pattern in expo-qr.cjs.
const { requireFromExpo } = require('./require-from-expo.cjs');

const { ProjectSettings } = requireFromExpo(
  '@expo/cli/build/src/start/project/settings',
  'expo:tunnel:qr',
);
const { getUserAsync, getActorDisplayName } = requireFromExpo(
  '@expo/cli/build/src/api/user/user',
  'expo:tunnel:qr',
);

const argv = process.argv.slice(2);
const portArg = argv.find((a) => a.startsWith('--port='));
const port = Number(portArg ? portArg.slice(7) : 8081);

const NGROK_DOMAIN = 'exp.direct';
const READY_TIMEOUT_MS = 180_000;
const POLL_MS = 2_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Metro's own liveness endpoint — the string the Expo and RN CLIs look for. */
function localServerUp() {
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

/**
 * Decides whether a response from the tunnel host means it is really serving.
 *
 * Split out from the request so it can be tested without a live tunnel, which
 * matters because this is the judgement the whole script turns on: get it wrong
 * in the permissive direction and it hands over a QR that fails on the phone,
 * which is the exact failure it exists to prevent.
 *
 * ngrok answers 404 with an ERR_NGROK_3200 body when the hostname is registered
 * but no agent is connected. That is a well-formed HTTP response, so status
 * alone is not enough — a 200 carrying that error would still be a dead tunnel.
 * Both signals are checked.
 *
 * @param {{ status: number|null, body: string }} response
 * @returns {{ ok: boolean, reason: string }}
 */
function classifyTunnelResponse({ status, body }) {
  if (status == null) return { ok: false, reason: 'no response' };
  if (String(body ?? '').includes('ERR_NGROK_3200')) {
    return { ok: false, reason: 'tunnel registered but nothing is connected behind it' };
  }
  if (status >= 400) return { ok: false, reason: `tunnel responded ${status}` };
  return { ok: true, reason: `serving (${status})` };
}

/**
 * Is the public tunnel actually serving?
 *
 * ngrok answers with 404 and an ERR_NGROK_3200 body when the hostname is
 * registered but no agent is connected — the exact state that produces the
 * error on the phone. Treating "any response" as success would defeat the
 * point, so the body is inspected too.
 */
function tunnelUp(hostname) {
  return new Promise((resolve) => {
    const req = https.get(
      { host: hostname, path: '/', timeout: 8000, headers: { 'expo-platform': 'android' } },
      (res) => {
        let body = '';
        res.on('data', (c) => {
          body += c;
          if (body.length > 4096) req.destroy();
        });
        res.on('end', () => {
          const verdict = classifyTunnelResponse({ status: res.statusCode, body });
          resolve({ ...verdict, status: res.statusCode });
        });
      },
    );
    req.on('error', (err) => resolve({ ok: false, status: null, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, status: null, error: 'timed out' });
    });
  });
}

/**
 * Extracts the live public hostname from the ngrok agent's own API payload.
 *
 * This is the authoritative answer, and it is better than deriving the name
 * ourselves: it is what ngrok actually registered, so it stays correct even if
 * the derivation is wrong, the project's stored randomness was reset after a
 * collision, or the account name is not what we expect. If it returns a
 * hostname, a tunnel genuinely exists.
 *
 * @param {string} json raw body from GET /api/tunnels
 * @returns {string|null} hostname, or null when no https tunnel is registered
 */
function parseNgrokTunnels(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  const tunnels = Array.isArray(parsed?.tunnels) ? parsed.tunnels : [];
  // Prefer https: ngrok registers both, and the http entry is a redirect.
  // Deliberately not named `https` — that is the module required above, and
  // shadowing it here would be a live grenade for whoever edits this next.
  const secure = tunnels.find(
    (t) => typeof t?.public_url === 'string' && t.public_url.startsWith('https://'),
  );
  const anyTunnel = tunnels.find((t) => typeof t?.public_url === 'string');
  const url = (secure ?? anyTunnel)?.public_url;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** Ask the running ngrok agent what it published. Null when it is not up. */
function ngrokPublicHostname(webPort = 4040) {
  return new Promise((resolve) => {
    const req = http.get(
      { host: '127.0.0.1', port: webPort, path: '/api/tunnels', timeout: 2000 },
      (res) => {
        let body = '';
        res.on('data', (c) => {
          body += c;
        });
        res.on('end', () => resolve(parseNgrokTunnels(body)));
      },
    );
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

/** The same three segments AsyncNgrok joins, read from the same sources. */
async function tunnelHostname() {
  const settings = await ProjectSettings.readAsync(process.cwd());
  const randomness = settings.urlRandomness;
  if (!randomness) return { error: 'no urlRandomness recorded yet (it is written on the first tunnel run)' };

  let user = null;
  try {
    user = await getUserAsync();
  } catch {
    /* handled below */
  }
  if (!user) {
    return {
      error:
        'not logged in to Expo. A tunnel address includes your account name, so\n' +
        '             ngrok cannot be started without one. Run `npx expo login` first.',
    };
  }

  const username = slugify(getActorDisplayName(user), { remove: /\./ });
  return { hostname: `${randomness}-${username}-${port}.${NGROK_DOMAIN}` };
}

/* ------------------------------------------------------------------- run */

// Exported for tests. Everything below is the CLI, and must not run on require.
module.exports = { classifyTunnelResponse, parseNgrokTunnels, tunnelHostname };

if (require.main !== module) return;

// Through start-expo-lan.cjs rather than @expo/cli directly, the same way
// expo-go-qr.cjs does. That wrapper is where the Expo Go redirect-page rule
// lives, and spawning the CLI straight from here bypassed it: the tunnel QR
// then encoded http://HOST/_expo/loading and opened the phone's browser
// instead of Expo Go, while the LAN QR — which did go through the wrapper —
// worked. One spawn site, one set of rules.
const metro = spawn(
  process.execPath,
  [path.join(__dirname, 'start-expo-lan.cjs'), '--tunnel', '--go', `--port=${port}`],
  { stdio: 'inherit', env: { ...process.env } },
);

let metroExited = false;
metro.on('exit', (code) => {
  metroExited = true;
  if (code) {
    console.error(
      '\n[expo:tunnel:qr] The dev server exited before the tunnel was ready.\n' +
        '                 Read its output above. If it says "ngrok tunnel took too long\n' +
        '                 to connect", this network blocks ngrok — Expo does not fall back\n' +
        '                 to LAN, it stops, which is why the phone then reports an offline\n' +
        '                 endpoint. On such a network use: npm run expo:go:qr\n',
    );
  }
  process.exit(code ?? 0);
});
process.on('SIGINT', () => metro.kill('SIGINT'));
process.on('SIGTERM', () => metro.kill('SIGTERM'));

(async () => {
  const resolved = await tunnelHostname();
  if (resolved.error) {
    console.error(`\n[expo:tunnel:qr] ${resolved.error}\n`);
    // Non-zero, so this fails a script chain rather than looking like success.
    // The exit handler on `metro` would otherwise report the signal as 0.
    metro.removeAllListeners('exit');
    metro.kill('SIGINT');
    process.exitCode = 1;
    return;
  }
  const derivedHostname = resolved.hostname;
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let announcedLocal = false;

  while (Date.now() < deadline) {
    if (metroExited) return;

    if (!(await localServerUp())) {
      await sleep(POLL_MS);
      continue;
    }
    if (!announcedLocal) {
      announcedLocal = true;
      console.log(`\n[expo:tunnel:qr] Local server up. Waiting for the tunnel…`);
    }

    // The agent's own answer wins over the derived name: it reports what ngrok
    // actually registered, so it stays right even if the stored randomness was
    // reset after a collision and the derived name has gone stale.
    const hostname = (await ngrokPublicHostname()) ?? derivedHostname;

    const probe = await tunnelUp(hostname);
    if (probe.ok) {
      console.log('[expo:tunnel:qr] Tunnel is live and serving — opening the QR code.\n');
      spawn(
        process.execPath,
        [path.join(__dirname, 'expo-qr.cjs'), `--tunnel=${hostname}`, `--port=${port}`],
        { stdio: 'inherit' },
      );
      return;
    }
    await sleep(POLL_MS);
  }

  console.error(
    `\n[expo:tunnel:qr] The tunnel never began serving within ${READY_TIMEOUT_MS / 1000}s.\n` +
      '                 No QR was produced, because one would fail on the phone with\n' +
      '                 ERR_NGROK_3200 and tell you nothing about why.\n' +
      '                 The dev server itself is fine — it is the tunnel that did not\n' +
      '                 come up. Use npm run expo:go:qr on a shared Wi-Fi instead.\n',
  );
  metro.removeAllListeners('exit');
  metro.kill('SIGINT');
  process.exitCode = 1;
})();
