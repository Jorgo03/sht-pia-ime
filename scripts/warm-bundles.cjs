/**
 * Builds the phone bundles before the QR code is shown.
 *
 * WHY THIS EXISTS
 * Metro builds a bundle when a phone first asks for it. With an empty cache
 * that took 7 minutes on this machine (`iOS Bundled 416648ms`, 2440 modules),
 * and the phone gives up long before that with "Could not connect to
 * development server", which reads like a network problem and is not one. So
 * the start scripts ask for both bundles themselves and only then draw the
 * code. With a normal cache this takes seconds.
 *
 * The URL has to be the one Expo Go requests: Metro keys its graph on these
 * options, so a different query would build something the phone never uses.
 */

const http = require('http');

/** The path Expo Go requests for this platform. Pure, for `npm test`. */
function bundlePath(platform, { dev = true, minify = false } = {}) {
  const query = [
    `platform=${platform}`,
    `dev=${dev}`,
    `hot=false`,
    `lazy=true`,
    ...(minify ? ['minify=true'] : []),
    `transform.engine=hermes`,
    `transform.bytecode=1`,
    `transform.routerRoot=app`,
    `transform.reactCompiler=true`,
    `unstable_transformProfile=hermes-stable`,
  ].join('&');
  return `/node_modules/expo-router/entry.bundle?${query}`;
}

/** dev/minify from the start script's own arguments. Pure, for `npm test`. */
function bundleOptions(argv) {
  return { dev: !argv.includes('--no-dev'), minify: argv.includes('--minify') };
}

function fetchBundle(port, urlPath) {
  return new Promise((resolve) => {
    const started = Date.now();
    const done = (ok, detail) => resolve({ ok, detail, seconds: Math.round((Date.now() - started) / 1000) });
    // No timeout: the wait is the point. A dropped request would stop the build.
    const req = http.get({ host: '127.0.0.1', port, path: urlPath }, (res) => {
      res.on('data', () => {});
      res.on('end', () => done(res.statusCode === 200, `HTTP ${res.statusCode}`));
      res.on('error', (e) => done(false, e.message));
    });
    req.on('error', (e) => done(false, e.message));
  });
}

/**
 * Asks for the iOS and Android bundles and waits for both. Never throws: if
 * one fails the QR still opens and Metro's own output says why.
 */
async function warmBundles({ port, argv = [], tag = 'expo', isStopped = () => false }) {
  const options = bundleOptions(argv);
  const started = Date.now();
  console.log(`\n[${tag}] Building the app for iOS and Android. The QR code opens when it is ready.`);
  const ticker = setInterval(() => {
    if (isStopped()) return;
    const minutes = Math.floor((Date.now() - started) / 60000);
    if (minutes > 0) {
      console.log(`[${tag}] Still building (${minutes} min). The first build after a cache reset takes several minutes. Keep waiting; do not scan yet.`);
    }
  }, 60_000);
  try {
    const results = await Promise.all(
      ['ios', 'android'].map(async (platform) => [platform, await fetchBundle(port, bundlePath(platform, options))]),
    );
    for (const [platform, r] of results) {
      console.log(r.ok ? `[${tag}] ${platform} ready (${r.seconds}s)` : `[${tag}] ${platform} did not build (${r.detail}). See the server output above.`);
    }
    return results.every(([, r]) => r.ok);
  } finally {
    clearInterval(ticker);
  }
}

module.exports = { bundleOptions, bundlePath, warmBundles };
