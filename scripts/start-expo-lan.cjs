#!/usr/bin/env node

/**
 * The single place this project starts an Expo dev server.
 *
 * Two connection modes, chosen by the caller:
 *   (default)   `expo start --lan`    — fast, needs the phone on the same
 *                                       subnet with client isolation off
 *   `--tunnel`  `expo start --tunnel` — works from any network, at the cost
 *                                       of routing through ngrok
 *
 * Everything funnels through here rather than calling `expo start` directly,
 * because the rules below (the freshly detected LAN address, and the Expo Go
 * redirect-page rule) have to hold for every mode. A second spawn site is free
 * to forget one of them, and that is exactly how the tunnel QR ended up
 * opening a browser while the LAN QR opened Expo Go.
 *
 * In LAN mode it wraps `expo start --lan` with a freshly auto-detected LAN
 * IPv4 address on every run, instead of the one-time hardcoded
 * REACT_NATIVE_PACKAGER_HOSTNAME that used to live in .env.
 *
 * Why this exists: this machine has virtual network adapters (Hyper-V
 * vEthernet, Bluetooth PAN, etc.) alongside the real Wi-Fi adapter, and
 * Expo's own auto-detection sometimes advertises one of those instead of
 * the real one — the phone then gets a QR code / manifest URL for an
 * address it can never reach. Pinning REACT_NATIVE_PACKAGER_HOSTNAME to a
 * fixed value fixed that on one specific network, but broke every other
 * network: switch Wi-Fi (home -> work, hotel, tethering, anywhere) and
 * Metro keeps advertising the stale address, which doesn't even exist on
 * the new subnet — a phone can't connect to an IP that isn't there,
 * regardless of any firewall or client-isolation policy on that network.
 * Detecting fresh on every `npm run expo:lan` fixes that for good.
 */

const os = require('os');
const { spawn } = require('child_process');

const VIRTUAL_ADAPTER_NAME = /virtual|vethernet|hyper-v|loopback|bluetooth|vmware|virtualbox|docker|wsl|default switch|npcap/i;

function findLanAddress() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (VIRTUAL_ADAPTER_NAME.test(name)) continue;
    for (const addr of addrs ?? []) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      // 169.254.x.x is APIPA — the OS assigned it because DHCP failed, not
      // a real reachable address.
      if (addr.address.startsWith('169.254.')) continue;
      candidates.push({ name, address: addr.address });
    }
  }

  // Prefer an adapter that's actually named Wi-Fi/Wireless/Ethernet over
  // anything else that slipped through the exclusion filter above.
  const preferred = candidates.find((c) => /wi-?fi|wireless|ethernet/i.test(c.name));
  return (preferred ?? candidates[0]) ?? null;
}

// Exported so scripts/expo-qr.cjs advertises the exact address this script
// hands Metro. Two copies of this detection would be free to disagree, and a
// QR pointing at a different interface than the running server is precisely
// the failure this file exists to prevent.
module.exports = { findLanAddress };

// Everything below runs only when this file is the entry point, so requiring
// it for findLanAddress() does not spawn a second Metro.
if (require.main !== module) return;

const rawArgs = process.argv.slice(2);
const tunnelMode = rawArgs.includes('--tunnel');

// --tunnel is consumed here, not forwarded: it selects the base command rather
// than being an extra flag on top of --lan, and `expo start --lan --tunnel`
// asks for two different host types at once.
const extraArgs = rawArgs.filter((a) => a !== '--tunnel');
const command = [
  tunnelMode ? 'npx expo start --tunnel' : 'npx expo start --lan',
  ...extraArgs,
].join(' ');

// In tunnel mode the address the phone dials is ngrok's, not this machine's,
// so detecting a LAN IP would be noise — and pinning
// REACT_NATIVE_PACKAGER_HOSTNAME would describe a host the phone never uses.
const found = tunnelMode ? null : findLanAddress();

if (tunnelMode) {
  console.log('[expo:tunnel] Starting a tunnelled dev server (works from any network).');
} else if (!found) {
  console.warn(
    '[expo:lan] Could not auto-detect a LAN IPv4 address on this machine — ' +
      "falling back to Expo's own network detection. If the phone can't connect, " +
      'run `ipconfig` (Windows) / `ifconfig` (macOS/Linux) to find your current IP ' +
      'and set REACT_NATIVE_PACKAGER_HOSTNAME for this one session, e.g.\n' +
      '  set REACT_NATIVE_PACKAGER_HOSTNAME=<your-ip> && npm run expo:lan   (Windows)\n' +
      '  REACT_NATIVE_PACKAGER_HOSTNAME=<your-ip> npm run expo:lan          (macOS/Linux)',
  );
} else {
  console.log(`[expo:lan] Advertising Metro at ${found.address} (auto-detected from "${found.name}")`);
}

// Forwards anything after `--` on the npm invocation (e.g.
// `npm run expo:lan -- --go` to force Expo-Go-compatible mode instead of
// this project's default development-build target) straight through to the
// underlying `expo start` call.

/**
 * In Expo Go mode, suppress Expo's runtime-picker interstitial.
 *
 * The CLI decides this in BundlerDevServer.isRedirectPageEnabled():
 *
 *   !env.EXPO_NO_REDIRECT_PAGE && !this.isDevClient
 *     && !!resolveFrom.silent(projectRoot, 'expo-dev-client')
 *
 * expo-dev-client is a dependency of this project, and `--go` does NOT set
 * isDevClient — only `--dev-client` does. So the interstitial stays on even
 * when we have explicitly asked for Expo Go, and the terminal QR is then
 * built from it:
 *
 *   printQRCode(interstitialPageUrl ?? nativeRuntimeUrl)   [interactiveActions]
 *
 * That URL is http://HOST:8081/_expo/loading — an ordinary web address. A
 * phone camera hands it to the default browser, so scanning Metro's own QR
 * opens Brave/Safari on a "choose an app" page instead of opening Expo Go.
 * It looks like a broken QR and is not: the code is read perfectly, it just
 * points at a web page.
 *
 * Turning the redirect page off makes getRedirectUrl() return null, so the
 * terminal QR falls through to nativeRuntimeUrl — exp://HOST:8081 — which is
 * the scheme Expo Go registers. Only in --go mode: with a development build
 * the picker is the right thing to show.
 */
const goMode = extraArgs.includes('--go');

// Passed as a single command string (not `spawn('npx', [...])`) — with
// shell:true, Node only skips its args-escaping deprecation warning when
// there's no separate args array to (not) escape. Nothing here is
// user-controlled (extraArgs comes from this project's own npm scripts /
// the developer's own CLI invocation, not external input), so this is just
// avoiding the noisy warning, not fixing an actual injection risk.
const child = spawn(command, {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    ...(found ? { REACT_NATIVE_PACKAGER_HOSTNAME: found.address } : {}),
    // Respect an explicit setting from the caller; only default it in --go.
    ...(goMode && process.env.EXPO_NO_REDIRECT_PAGE == null
      ? { EXPO_NO_REDIRECT_PAGE: '1' }
      : {}),
  },
});

child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
  console.error('[expo:lan] Failed to start expo:', err);
  process.exit(1);
});
