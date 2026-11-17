// Builds public/favicon.ico from the 48x48 brand icon (assets/images/favicon.png).
// An ICO may hold PNG data directly (every current browser and Google's
// favicon crawler read it), so no image library is needed. Run:
//   node scripts/build-favicon-ico.cjs
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const png = fs.readFileSync(path.join(root, 'assets/images/favicon.png'));
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image

const entry = Buffer.alloc(16);
entry.writeUInt8(width >= 256 ? 0 : width, 0);
entry.writeUInt8(height >= 256 ? 0 : height, 1);
entry.writeUInt8(0, 2); // no palette
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // colour planes
entry.writeUInt16LE(32, 6); // bits per pixel
entry.writeUInt32LE(png.length, 8);
entry.writeUInt32LE(header.length + entry.length, 12);

fs.writeFileSync(path.join(root, 'public/favicon.ico'), Buffer.concat([header, entry, png]));
console.log(`public/favicon.ico: ${width}x${height}, ${png.length + 22} bytes`);
