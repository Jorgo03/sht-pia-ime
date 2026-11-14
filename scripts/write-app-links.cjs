// Writes the two files that let a shared website link open the app
// (AUDIT-008), into public/.well-known/ (served by the website build):
//   apple-app-site-association  (iOS universal links)
//   assetlinks.json             (Android verified app links)
//
// Run once the Apple Developer account and the Play app exist:
//   APPLE_TEAM_ID=ABCDE12345 \
//   ANDROID_CERT_SHA256=AA:BB:...(32 pairs)[,second fingerprint] \
//   node scripts/write-app-links.cjs
// Team ID: developer.apple.com > Membership. Fingerprints: Play Console >
// Test and release > App integrity > App signing key certificate (and the
// upload key's, if you also install builds signed with it). Then set
// APP_LINK_DOMAIN in EAS for the store builds (app.config.js) and deploy.
const fs = require('fs');
const path = require('path');

const BUNDLE_ID = 'com.shtepiaime.app';
const PACKAGE = 'com.shtepiaime.app';
// The paths the app answers itself (expo-router routes of the same name).
const PATHS = ['/property', '/user', '/agent'];

function buildAasa(teamId, bundleId) {
  if (!/^[A-Z0-9]{10}$/.test(String(teamId))) throw new Error('APPLE_TEAM_ID must be the 10-character Apple Team ID');
  return {
    applinks: {
      details: [
        {
          appIDs: [`${teamId}.${bundleId}`],
          components: PATHS.map((p) => ({ '/': `${p}/*` })),
        },
      ],
    },
  };
}

function buildAssetLinks(packageName, fingerprints) {
  const list = fingerprints.map((f) => String(f).trim().toUpperCase()).filter(Boolean);
  if (!list.length || list.some((f) => !/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(f))) {
    throw new Error('ANDROID_CERT_SHA256 must be SHA-256 fingerprint(s): 32 hex pairs joined by ":"');
  }
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: { namespace: 'android_app', package_name: packageName, sha256_cert_fingerprints: list },
    },
  ];
}

module.exports = { buildAasa, buildAssetLinks, PATHS };

if (require.main === module) {
  const dir = path.join(__dirname, '..', 'public', '.well-known');
  fs.mkdirSync(dir, { recursive: true });
  const aasa = buildAasa(process.env.APPLE_TEAM_ID, BUNDLE_ID);
  const links = buildAssetLinks(PACKAGE, (process.env.ANDROID_CERT_SHA256 ?? '').split(','));
  fs.writeFileSync(path.join(dir, 'apple-app-site-association'), JSON.stringify(aasa, null, 2) + '\n');
  fs.writeFileSync(path.join(dir, 'assetlinks.json'), JSON.stringify(links, null, 2) + '\n');
  console.log(`Wrote ${path.relative(process.cwd(), dir)}/apple-app-site-association and assetlinks.json`);
}
