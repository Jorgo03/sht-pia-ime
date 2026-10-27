// Drawn stand-ins for listing photos in the simulator: flat illustrations, so
// no real home, person or photographer's work appears in the demo.

const PALETTES = [
  { sky: ['#f6d9b8', '#fbeee0'], wall: '#efe4d6', accent: '#ff7d1a', dark: '#5b4636', green: '#7c9a6a', water: '#6fa8c7' },
  { sky: ['#bfd9ea', '#eef5f9'], wall: '#f3ede4', accent: '#e85d00', dark: '#43505c', green: '#6f9468', water: '#4f93b8' },
  { sky: ['#f3c9a6', '#fde9d6'], wall: '#eadccb', accent: '#c75b2a', dark: '#4a3b30', green: '#8aa66f', water: '#5d9ec0' },
  { sky: ['#d6e4ee', '#f7f3ee'], wall: '#e9e2d8', accent: '#ff9442', dark: '#3d4651', green: '#5f8a5c', water: '#3f86ad' },
  { sky: ['#f0d2c2', '#faf1ea'], wall: '#f1e7dc', accent: '#d9691f', dark: '#563f33', green: '#79996b', water: '#6aa2bf' },
  { sky: ['#c9dde6', '#f2f6f7'], wall: '#ece6de', accent: '#f08a3c', dark: '#394550', green: '#6b915f', water: '#4c8db3' },
];

const W = 800;
const H = 600;

const rect = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;

function windowGrid(x, y, cols, rows, w, h, gap, fill) {
  let out = '';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out += rect(x + c * (w + gap), y + r * (h + gap), w, h, fill, 'rx="3"');
  return out;
}

const SCENES = {
  city: (p, n) =>
    rect(0, 380, W, 220, '#d9cfc2') +
    [0, 1, 2, 3, 4].map((i) => {
      const h = 180 + ((i * 97 + n * 41) % 160);
      const x = 30 + i * 155;
      return rect(x, 400 - h, 130, h, i % 2 ? p.wall : '#e2d5c4') + windowGrid(x + 16, 420 - h, 4, Math.floor((h - 40) / 38), 18, 26, 10, i === 2 ? p.accent : '#9fb3c2');
    }).join('') +
    rect(0, 395, W, 10, p.dark, 'opacity=".25"'),
  living: (p) =>
    rect(0, 0, W, H, p.wall) + rect(0, 430, W, 170, '#c9a988') +
    rect(470, 70, 260, 230, '#cfe3ee', 'rx="6"') + rect(596, 70, 8, 230, p.wall) +
    rect(90, 300, 340, 120, p.accent, 'rx="26"') + rect(70, 270, 380, 70, p.accent, 'rx="30" opacity=".85"') +
    rect(120, 420, 16, 30, p.dark) + rect(384, 420, 16, 30, p.dark) +
    rect(520, 380, 150, 16, p.dark, 'rx="8"') + rect(540, 396, 10, 50, p.dark) + rect(640, 396, 10, 50, p.dark) +
    `<circle cx="720" cy="360" r="40" fill="${p.green}"/>` + rect(712, 395, 16, 50, p.dark),
  kitchen: (p) =>
    rect(0, 0, W, H, p.wall) + rect(0, 470, W, 130, '#bfa486') +
    rect(60, 120, 680, 110, '#ffffff', 'rx="8"') + windowGrid(76, 136, 4, 1, 152, 78, 12, '#e8e0d6') +
    rect(60, 320, 680, 150, '#ffffff', 'rx="6"') + rect(60, 300, 680, 24, p.dark) +
    windowGrid(80, 340, 4, 1, 150, 110, 15, '#efe8df') +
    rect(330, 250, 140, 50, p.accent, 'rx="10"'),
  villa: (p) =>
    rect(0, 410, W, 190, p.green) + rect(140, 220, 520, 200, '#fbf7f1') + rect(110, 200, 580, 26, p.dark) +
    rect(380, 120, 260, 100, '#fbf7f1') + rect(360, 104, 300, 20, p.dark) +
    windowGrid(170, 260, 3, 1, 70, 100, 30, '#a9c4d4') + rect(470, 260, 150, 160, '#a9c4d4') +
    windowGrid(410, 140, 3, 1, 56, 60, 22, '#a9c4d4') +
    rect(80, 470, 640, 60, p.water, 'rx="10"'),
  pool: (p) =>
    rect(0, 300, W, 300, '#efe6da') + rect(60, 360, 680, 190, p.water, 'rx="24"') +
    [0, 1, 2, 3].map((i) => `<path d="M${100 + i * 160} ${420 + (i % 2) * 40} q 30 -14 60 0 t 60 0" stroke="#ffffff" stroke-width="6" fill="none" opacity=".6"/>`).join('') +
    rect(80, 250, 120, 40, p.accent, 'rx="8"') + rect(240, 250, 120, 40, p.accent, 'rx="8"') +
    `<circle cx="660" cy="200" r="70" fill="${p.green}"/>` + rect(650, 240, 20, 70, p.dark),
  bedroom: (p) =>
    rect(0, 0, W, H, p.wall) + rect(0, 460, W, 140, '#c7a785') +
    rect(150, 250, 500, 60, p.dark, 'rx="10"') + rect(150, 300, 500, 150, '#ffffff', 'rx="14"') +
    rect(190, 270, 160, 60, '#f1ebe3', 'rx="16"') + rect(450, 270, 160, 60, '#f1ebe3', 'rx="16"') +
    rect(150, 380, 500, 70, p.accent, 'rx="14"') +
    rect(560, 70, 170, 140, '#cfe3ee', 'rx="6"'),
  sea: (p, n) =>
    rect(0, 300, W, 300, p.water) +
    `<circle cx="${200 + (n % 3) * 160}" cy="170" r="60" fill="#ffe4bf"/>` +
    [0, 1, 2, 3, 4].map((i) => `<path d="M${-40 + i * 190} ${360 + i * 40} q 45 -16 90 0 t 90 0" stroke="#ffffff" stroke-width="5" fill="none" opacity=".45"/>`).join('') +
    `<path d="M0 300 L170 220 L320 300 Z" fill="${p.green}" opacity=".7"/>` +
    rect(0, 520, W, 80, '#e9d8bd'),
  balcony: (p) =>
    rect(0, 340, W, 260, p.water) + rect(0, 300, W, 50, p.green, 'opacity=".6"') +
    rect(0, 470, W, 130, '#d8c8b4') +
    Array.from({ length: 16 }, (_, i) => rect(20 + i * 50, 380, 8, 90, p.dark)).join('') + rect(0, 372, W, 12, p.dark) +
    rect(560, 410, 120, 14, p.accent, 'rx="7"') + rect(610, 424, 10, 46, p.dark),
  house: (p) =>
    rect(0, 420, W, 180, p.green) + rect(200, 230, 400, 200, '#f4ebdf') +
    `<path d="M170 240 L400 100 L630 240 Z" fill="${p.accent}"/>` +
    rect(360, 320, 80, 110, p.dark, 'rx="4"') + windowGrid(240, 270, 1, 1, 80, 70, 0, '#a9c4d4') + windowGrid(480, 270, 1, 1, 80, 70, 0, '#a9c4d4'),
  garden: (p) =>
    rect(0, 360, W, 240, p.green) +
    [80, 230, 560, 700].map((x, i) => `<circle cx="${x}" cy="${300 - (i % 2) * 40}" r="${70 + (i % 2) * 20}" fill="${p.green}" opacity=".9"/>` + rect(x - 10, 330, 20, 60, p.dark)).join('') +
    `<path d="M330 600 Q400 450 470 360" stroke="#e8dcc8" stroke-width="40" fill="none"/>` +
    [0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${120 + i * 110}" cy="${470 + (i % 2) * 40}" r="10" fill="${p.accent}"/>`).join(''),
  office: (p) =>
    rect(0, 0, W, H, '#eef0f1') + rect(0, 460, W, 140, '#c9c3ba') +
    windowGrid(40, 40, 3, 1, 230, 300, 15, '#cfe3ee') +
    rect(120, 380, 560, 20, p.dark, 'rx="6"') + rect(150, 400, 12, 70, p.dark) + rect(640, 400, 12, 70, p.dark) +
    rect(330, 310, 140, 70, '#2f3a44', 'rx="6"') + rect(250, 420, 70, 50, p.accent, 'rx="12"') + rect(480, 420, 70, 50, p.accent, 'rx="12"'),
  land: (p) =>
    rect(0, 330, W, 270, '#d8c38f') +
    `<path d="M0 330 L200 230 L380 320 L560 210 L800 330 Z" fill="${p.green}" opacity=".75"/>` +
    rect(120, 420, 560, 120, 'none', `stroke="${p.accent}" stroke-width="6" stroke-dasharray="18 12"`) +
    rect(390, 380, 8, 60, p.dark) + `<path d="M398 380 L450 395 L398 410 Z" fill="${p.accent}"/>`,
  garage: (p) =>
    rect(0, 440, W, 160, '#bdb6ad') + rect(160, 180, 480, 270, '#ece6dd') + rect(140, 160, 520, 30, p.dark) +
    Array.from({ length: 7 }, (_, i) => rect(210, 220 + i * 32, 380, 24, '#d7d0c6')).join(''),
};

/** One illustration as an SVG document. */
export function photoSvg(scene, n) {
  const p = PALETTES[(n - 1 + Object.keys(SCENES).indexOf(scene)) % PALETTES.length];
  const draw = SCENES[scene] || SCENES.city;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
    `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.sky[0]}"/><stop offset="1" stop-color="${p.sky[1]}"/></linearGradient></defs>` +
    rect(0, 0, W, H, 'url(#s)') +
    draw(p, n) +
    '</svg>'
  );
}

export const SCENE_NAMES = Object.keys(SCENES);

/** Shown for a photo the simulator no longer has (an upload from another browser). */
export const PLACEHOLDER_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">` +
  rect(0, 0, W, H, '#efe7dc') +
  `<path d="M300 360 L400 270 L500 360 Z" fill="#d9c7b2"/>` + rect(330, 360, 140, 90, '#d9c7b2') +
  '</svg>';

/** The map background: the simulator may not load map tiles from other sites. */
export const TILE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">' +
  rect(0, 0, 256, 256, '#efe9df') +
  '<path d="M0 90 C80 70 150 120 256 96" stroke="#ffffff" stroke-width="8" fill="none"/>' +
  '<path d="M60 0 C70 90 40 170 90 256" stroke="#ffffff" stroke-width="6" fill="none"/>' +
  '<path d="M0 200 L256 180" stroke="#fbf8f3" stroke-width="4" fill="none"/>' +
  '<circle cx="190" cy="40" r="26" fill="#dde6cf"/>' +
  '</svg>';
