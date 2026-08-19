#!/usr/bin/env node

/**
 * Wraps `expo start --lan` with a freshly auto-detected LAN IPv4 address on
 * every run, instead of the one-time hardcoded REACT_NATIVE_PACKAGER_HOSTNAME
 * that used to live in .env.
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

const found = findLanAddress();

if (!found) {
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
const extraArgs = process.argv.slice(2);
const command = ['npx expo start --lan', ...extraArgs].join(' ');

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
  },
});

child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
  console.error('[expo:lan] Failed to start expo:', err);
  process.exit(1);
});
