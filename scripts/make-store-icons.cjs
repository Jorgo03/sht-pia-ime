// Store listing icons from the approved app icon (docs/LAUNCH_TASKS.md F10).
// Google Play wants a 512×512 PNG; the App Store takes the 1024×1024 icon the
// build already carries (assets/images/icon-light.png, no alpha). Re-run after
// the icon changes: `node scripts/make-store-icons.cjs`.
const path = require('path');
const Jimp = require('jimp-compact');

async function main() {
  const root = path.join(__dirname, '..');
  const icon = await Jimp.read(path.join(root, 'assets/images/icon-light.png'));
  await icon.clone().resize(512, 512, Jimp.RESIZE_BICUBIC).writeAsync(path.join(root, 'store/google-play-icon-512.png'));
  console.log('store/google-play-icon-512.png');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
