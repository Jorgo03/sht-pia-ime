#!/usr/bin/env node
// Free advert builder: the same iPhone advert, with no paid service.
//   1. Playwright draws the iPhone frame, captions and end card as PNGs (HTML + the app's fonts).
//   2. ffmpeg puts the screen recordings in the phone, cross-fades them,
//      animates the captions and appends the door ending.
//
// Usage: node make-ad.mjs --scenes <dir with s01..s14.mp4> --fonts <dir> --out ad.mp4
//        [--ffmpeg <path>] [--chromium <path>] [--music track.mp3] [--voice voice.mp3]
// Everything here is free and runs offline once the recordings exist.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const SCENES = path.resolve(arg('scenes', 'scenes'));
const FONTS = path.resolve(arg('fonts', 'fonts'));
const OUT = path.resolve(arg('out', 'shtepia-ime-ad.mp4'));
const FFMPEG = arg('ffmpeg', 'ffmpeg');
const FFPROBE = arg('ffprobe', 'ffprobe');
const CHROMIUM = arg('chromium', undefined);
const MUSIC = arg('music', null);
const VOICE = arg('voice', null);
const WORK = path.join(path.dirname(OUT), 'ad-work');
fs.mkdirSync(WORK, { recursive: true });

// ---- The edit -------------------------------------------------------------
const W = 1080, H = 1920, FPS = 30;
const SX = 240, SY = 420, SW = 600, STRIP = 54, VH = 1298, SH = STRIP + VH, BEZEL = 16, R = 76;
const LIGHT = '#F9F5ED', DARK = '#16110E', INK = '#221B16', ACCENT = '#E85D00', ORANGE = '#FF5F1F';
const XF = 0.3, INTRO = 1.7, DOOR_DUR = 3.95;
// [clip, [[source start, length], ...], slot length, caption]
const B = 'PËR BLERËSIT', A = 'PËR AGJENTËT', E = 'PËR TË GJITHË';
const SHOTS = [
  ['s01', [[2.2, 4.6]], 4.6, 'Përputhje të reja<br>për ty, çdo ditë', B],
  ['s15', [[1.8, 3.2]], 3.2, 'Kërko sipas qytetit<br>ose lagjes', B],
  ['s02', [[2.2, 3.2]], 3.2, 'Shitje apo qira,<br>me një prekje', B],
  ['s03', [[1.9, 3.3]], 3.3, 'Filtra: çmim,<br>sipërfaqe, dhoma', B],
  ['s04', [[2.0, 3.0]], 3.0, 'Të gjitha pronat<br>në hartë', B],
  ['s05', [[2.0, 3.2]], 3.2, 'Çdo detaj i pronës,<br>në një vend', B],
  ['s11', [[2.9, 3.6]], 3.6, 'Pyet asistentin AI<br>për çdo pronë', B],
  ['s07', [[1.9, 3.0]], 3.0, 'Ruaj pronat<br>që të pëlqejnë', B],
  ['s06', [[2.2, 2.8]], 2.8, 'Mesazh, telefon<br>ose WhatsApp', B],
  ['s21', [[4.0, 3.6]], 3.6, 'Kërko vizitë në orën<br>që të përshtatet', B],
  ['s09', [[3.6, 3.4]], 3.4, 'Bisedo me agjentin<br>në aplikacion', B],
  ['s08', [[1.8, 2.9]], 2.9, 'Ruaj kërkimin,<br>shiko çfarë ka të re', B],
  ['s10', [[2.1, 1.6], [8.1, 2.1]], 3.7, 'Posto pronën:<br>përkthehet në 8 gjuhë', A],
  ['s18', [[1.9, 3.2]], 3.2, 'Menaxho listimet:<br>pauzë, e shitur, ndrysho', A],
  ['s19', [[1.8, 3.2]], 3.2, 'Sa njerëz e panë,<br>thirrën, shkruan', A],
  ['s16', [[1.8, 3.8]], 3.8, 'Vizitat e sotme dhe<br>blerësit që përputhen', A],
  ['s20', [[1.8, 2.9]], 2.9, 'Konfirmo vizitat<br>me një prekje', A],
  ['s17', [[2.6, 1.8], [5.9, 2.0]], 3.8, 'Klientët e tu:<br>nga i ri te fituar', A],
  ['s23', [[1.9, 3.0]], 3.0, 'Profili yt publik<br>me të gjitha pronat', A],
  ['s24', [[2.2, 3.2]], 3.2, 'Hyr si klient<br>ose si agjent', E],
  ['s22', [[1.8, 2.8]], 2.8, 'Njoftime për<br>mesazhe dhe vizita', E],
  ['s12', [[2.0, 3.9]], 3.9, 'Në gjuhën tënde:<br>8 gjuhë', E],
  ['s13', [[2.1, 2.7]], 2.7, 'Edhe në modalitetin<br>e errët', E],
];
const DARK_SCENE = 's13', DARK_AT = 0.6; // seconds into s13 when the theme flips

let t = 0;
const slots = SHOTS.map(([name, parts, dur, caption, section], i) => {
  const s = { name, parts, dur, caption, section, i, at: t };
  t += dur - XF;
  return s;
});
const PHONE_END = t + XF;
const DOOR_AT = PHONE_END - 0.35;
const TOTAL = DOOR_AT + DOOR_DUR;

// ---- 1. Graphics: HTML -> transparent PNG ----------------------------------
const font = (file) => `url("file://${path.join(FONTS, file)}")`;
const CSS = `
@font-face { font-family: Serif; src: ${font('Newsreader_500Medium.ttf')}; }
@font-face { font-family: SerifItalic; src: ${font('Newsreader_500Medium_Italic.ttf')}; }
@font-face { font-family: Sans; src: ${font('Manrope_700Bold.ttf')}; }
@font-face { font-family: SansMid; src: ${font('Manrope_600SemiBold.ttf')}; }
@font-face { font-family: Mono; src: ${font('JetBrainsMono_500Medium.ttf')}; }
html, body { margin: 0; background: transparent; }
.abs { position: absolute; }
.cap-n { left: 60px; width: 960px; top: 118px; text-align: center; font: 24px Mono; letter-spacing: 4px; color: ${ACCENT}; }
.cap { left: 50px; width: 980px; top: 168px; text-align: center; font: 64px/1.1 Serif; color: ${INK}; }
`;
const svgIcon = (d, x, y, size, color, sw = 2.4) =>
  `<svg class="abs" style="left:${x}px;top:${y}px" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const statusBar = (color, bg) => `<div class="abs" style="left:${SX}px;top:${SY}px;width:${SW}px;height:${STRIP}px;${bg ? `background:${bg};border-radius:${R}px ${R}px 0 0;` : ''}">
  <div class="abs" style="left:58px;top:11px;font:25px Sans;color:${color}">9:41</div>
  ${svgIcon('<path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/>', 444, 15, 26, color)}
  ${svgIcon('<path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.86a10 10 0 0 1 14 0"/><path d="M8.5 16.43a5 5 0 0 1 7 0"/>', 478, 15, 26, color)}
  ${svgIcon('<rect width="16" height="10" x="2" y="7" rx="2" ry="2"/><path d="M22 11v2"/><path d="M6 11v2"/><path d="M10 11v2"/><path d="M14 11v2"/>', 512, 13, 30, color, 2)}
</div>`;

const PAGES = {
  bg: { w: W, h: H, html: `<div class="abs" style="inset:0;background:linear-gradient(180deg,#FFF8F0 0%,#FFEBD8 55%,#FFDDBF 100%)"></div>
    <div class="abs" style="left:140px;top:520px;width:800px;height:1200px;border-radius:400px;background:radial-gradient(closest-side,rgba(255,184,119,.35),rgba(255,184,119,0))"></div>`, opaque: true },
  body: { w: W, h: H, html: `
    <div class="abs" style="left:${SX - BEZEL}px;top:${SY - BEZEL}px;width:${SW + 2 * BEZEL}px;height:${SH + 2 * BEZEL}px;border-radius:${R + BEZEL}px;background:#151314;box-shadow:0 40px 90px rgba(122,58,15,.33)"></div>
    <div class="abs" style="left:${SX - BEZEL - 5}px;top:${SY + 250}px;width:6px;height:110px;border-radius:3px;background:#2A2627"></div>
    <div class="abs" style="left:${SX - BEZEL - 5}px;top:${SY + 390}px;width:6px;height:110px;border-radius:3px;background:#2A2627"></div>
    <div class="abs" style="left:${SX + SW + BEZEL - 1}px;top:${SY + 300}px;width:6px;height:170px;border-radius:3px;background:#2A2627"></div>` },
  top: { w: W, h: H, html: `${statusBar(INK)}
    <div class="abs" style="left:${SX + SW / 2 - 86}px;top:${SY + 14}px;width:172px;height:46px;border-radius:23px;background:#050505"></div>` },
  topDark: { w: W, h: H, html: `${statusBar('#F5EFE8', DARK)}
    <div class="abs" style="left:${SX + SW / 2 - 86}px;top:${SY + 14}px;width:172px;height:46px;border-radius:23px;background:#050505"></div>` },
  brand: { w: W, h: H, html: `<div class="abs" style="left:90px;width:900px;top:1822px;text-align:center;font:36px Serif;color:${ORANGE}">Shtëpia.ime</div>` },
  mask: { w: SW, h: SH, html: `<div class="abs" style="inset:0;background:#000"></div><div class="abs" style="inset:0;border-radius:${R}px;background:#fff"></div>`, opaque: true },
  opening: { w: W, h: 420, html: `<div class="abs" style="left:60px;width:960px;top:112px;text-align:center;font:86px Serif;color:${INK}">Të gjitha veçoritë,</div>
    <div class="abs" style="left:60px;width:960px;top:210px;text-align:center;font:86px SerifItalic;color:${ACCENT}">në një aplikacion.</div>` },
  cta: { w: W, h: 120, html: `<div class="abs" style="left:80px;width:920px;top:20px;text-align:center;font:40px SansMid;color:${INK}">Së shpejti në App Store dhe Google Play</div>` },
};
for (const s of slots) {
  PAGES[`cap-${s.name}`] = { w: W, h: 420, html: `<div class="abs cap-n">${s.section} · ${String(s.i + 1).padStart(2, '0')}/${slots.length}</div><div class="abs cap">${s.caption}</div>` };
}

const { chromium } = require('playwright');
const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [name, p] of Object.entries(PAGES)) {
  const file = path.join(WORK, `${name}.html`);
  fs.writeFileSync(file, `<!doctype html><meta charset="utf-8"><style>${CSS}</style><body style="width:${p.w}px;height:${p.h}px;position:relative;overflow:hidden">${p.html}</body>`);
  await page.setViewportSize({ width: p.w, height: p.h });
  await page.goto(`file://${file}`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(WORK, `${name}.png`), omitBackground: !p.opaque });
}
await browser.close();
console.log('graphics: done');

// ---- 2. ffmpeg -------------------------------------------------------------
const ff = (args) => execFileSync(FFMPEG, ['-loglevel', 'error', '-y', ...args], { stdio: 'inherit' });
const png = (name) => path.join(WORK, `${name}.png`);
const enc = ['-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(FPS)];

// 2a. Each scene as the phone screen: recording under a status strip.
for (const s of slots) {
  const ins = [];
  const chains = [];
  const clipDur = Number(execFileSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(SCENES, `${s.name}.mp4`)]).toString());
  s.parts = s.parts.map(([from, len]) => [Math.max(0, Math.min(from, clipDur - len - 0.1)), len]);
  s.parts.forEach(([from, len], k) => {
    ins.push('-ss', String(from), '-t', String(len + 0.05), '-i', path.join(SCENES, `${s.name}.mp4`));
    chains.push(`[${k}:v]scale=${SW}:${VH},fps=${FPS},setsar=1,format=yuv420p,trim=duration=${len},setpts=PTS-STARTPTS[p${k}]`);
  });
  const joined = s.parts.length > 1 ? `${s.parts.map((_, k) => `[p${k}]`).join('')}concat=n=${s.parts.length}:v=1[v]` : '[p0]null[v]';
  let screen = `[v]pad=${SW}:${SH}:0:${STRIP}:color=${LIGHT.replace('#', '0x')},trim=duration=${s.dur}`;
  if (s.name === DARK_SCENE) screen += `,drawbox=x=0:y=0:w=${SW}:h=${STRIP}:color=${DARK.replace('#', '0x')}:t=fill:enable='gte(t,${DARK_AT})'`;
  ff([...ins, '-filter_complex', `${chains.join(';')};${joined};${screen}[out]`, '-map', '[out]', ...enc, path.join(WORK, `${s.name}.mp4`)]);
}
console.log('screens: done');

// 2b. Cross-fade the screens into one track.
{
  const ins = slots.flatMap((s) => ['-i', path.join(WORK, `${s.name}.mp4`)]);
  const parts = [];
  let last = '[0:v]';
  let offset = 0;
  slots.slice(1).forEach((s, k) => {
    offset += slots[k].dur - XF;
    const out = k === slots.length - 2 ? '[out]' : `[x${k}]`;
    parts.push(`${last}[${k + 1}:v]xfade=transition=fade:duration=${XF}:offset=${offset.toFixed(3)}${out}`);
    last = out;
  });
  ff([...ins, '-filter_complex', parts.join(';'), '-map', '[out]', ...enc, path.join(WORK, 'screen.mp4')]);
}
console.log('screen track: done');

// 2c. The phone film: background, body, screen, status bar, captions.
{
  const L = PHONE_END;
  const img = (name, dur = L) => ['-loop', '1', '-framerate', String(FPS), '-t', String(dur), '-i', png(name)];
  const ins = [...img('bg'), ...img('body'), '-i', path.join(WORK, 'screen.mp4'), ...img('mask'), ...img('top'), ...img('topDark'), ...img('brand'), ...img('opening')];
  const capIdx = {};
  slots.forEach((s, k) => { capIdx[s.name] = 8 + k; ins.push(...img(`cap-${s.name}`)); });
  const rise = `if(lt(t,0.75),260*pow(1-t/0.75,3),0)`; // eases up into place
  const fadeIO = `fade=in:st=0:d=0.45:alpha=1,fade=out:st=${(L - 0.45).toFixed(3)}:d=0.45:alpha=1`;
  const g = [
    `[0:v]format=yuv420p,setsar=1[bg]`,
    `[1:v]format=rgba,${fadeIO}[body]`,
    `[3:v]format=gray[m]`,
    `[2:v]format=rgba[scr0]`,
    `[scr0][m]alphamerge,${fadeIO}[scr]`,
    `[4:v]format=rgba,${fadeIO}[top]`,
    `[6:v]format=rgba,fade=in:st=0.8:d=0.4:alpha=1,fade=out:st=${(L - 0.6).toFixed(3)}:d=0.3:alpha=1[brand]`,
    `[bg][body]overlay=x=0:y='${rise}':eval=frame[a1]`,
    `[a1][scr]overlay=x=${SX}:y='${SY}+${rise}':eval=frame[a2]`,
    `[a2][top]overlay=x=0:y='${rise}':eval=frame[a3]`,
  ];
  // Dark status bar for the dark-mode scene.
  const d = slots.find((s) => s.name === DARK_SCENE);
  const dAt = d.at + DARK_AT;
  g.push(`[5:v]format=rgba,trim=duration=${(d.at + d.dur - dAt).toFixed(3)},fade=in:st=0:d=0.1:alpha=1,fade=out:st=${(d.at + d.dur - dAt - 0.45).toFixed(3)}:d=0.45:alpha=1,setpts=PTS+${dAt.toFixed(3)}/TB[dk]`);
  g.push(`[a3][dk]overlay=0:0:eof_action=pass:enable='between(t,${dAt.toFixed(3)},${(d.at + d.dur).toFixed(3)})'[a4]`);
  g.push(`[a4][brand]overlay=0:0[a5]`);
  // Captions: rise 26px and fade in, fade out at the end of their scene.
  let cur = '[a5]';
  const caption = (input, at, dur, label) => {
    g.push(`[${input}:v]format=rgba,trim=duration=${dur.toFixed(3)},fade=in:st=0:d=0.45:alpha=1,fade=out:st=${(dur - 0.22).toFixed(3)}:d=0.22:alpha=1,setpts=PTS+${at.toFixed(3)}/TB[${label}]`);
    const out = `[o${label}]`;
    g.push(`${cur}[${label}]overlay=x=0:y='26*max(0,1-(t-${at.toFixed(3)})/0.45)':eval=frame:eof_action=pass:enable='between(t,${at.toFixed(3)},${(at + dur).toFixed(3)})'${out}`);
    cur = out;
  };
  caption(7, 0.25, INTRO - 0.25, 'cOpen');
  for (const s of slots) {
    const at = s.i === 0 ? s.at + INTRO : s.at + XF / 2;
    caption(capIdx[s.name], at, s.at + s.dur - at - XF / 2, `c${s.name}`);
  }
  g.push(`${cur}format=yuv420p[out]`);
  fs.writeFileSync(path.join(WORK, 'phone-graph.txt'), g.join(';\n'));
  ff([...ins, '-filter_complex_script', path.join(WORK, 'phone-graph.txt'), '-map', '[out]', '-t', String(L), ...enc, path.join(WORK, 'phone.mp4')]);
}
console.log('phone film: done');

// 2d. The door ending with the closing line.
ff(['-ss', '0.3', '-t', String(DOOR_DUR), '-i', path.join(SCENES, 's14.mp4'), '-loop', '1', '-framerate', String(FPS), '-t', String(DOOR_DUR), '-i', png('cta'),
  '-filter_complex',
  `[0:v]scale=1080:2337,crop=1080:1920:0:208,fps=${FPS},setsar=1,format=yuv420p,tpad=stop_mode=clone:stop_duration=1,trim=duration=${DOOR_DUR}[d];` +
  `[1:v]format=rgba,fade=in:st=2.35:d=0.5:alpha=1[c];[d][c]overlay=x=0:y='1350+20*max(0,1-(t-2.35)/0.5)':eval=frame,format=yuv420p[out]`,
  '-map', '[out]', ...enc, path.join(WORK, 'door.mp4')]);
console.log('door: done');

// 2e. Join, and add sound if given (music and/or voice-over).
const audioIns = [];
const audioGraph = [];
if (MUSIC) { audioIns.push('-i', MUSIC); }
if (VOICE) { audioIns.push('-i', VOICE); }
const base = ['-i', path.join(WORK, 'phone.mp4'), '-i', path.join(WORK, 'door.mp4'), ...audioIns];
let graph = `[0:v][1:v]xfade=transition=fade:duration=0.35:offset=${DOOR_AT.toFixed(3)},format=yuv420p[v]`;
const maps = ['-map', '[v]'];
if (MUSIC || VOICE) {
  let k = 2;
  const tracks = [];
  if (MUSIC) { audioGraph.push(`[${k}:a]atrim=0:${TOTAL.toFixed(3)},volume=${VOICE ? 0.35 : 0.9},afade=t=out:st=${(TOTAL - 1.5).toFixed(3)}:d=1.5[mus]`); tracks.push('[mus]'); k++; }
  if (VOICE) { audioGraph.push(`[${k}:a]adelay=400|400,volume=1.0[vo]`); tracks.push('[vo]'); }
  audioGraph.push(tracks.length > 1 ? `${tracks.join('')}amix=inputs=2:duration=first:normalize=0[a]` : `${tracks[0]}anull[a]`);
  graph += ';' + audioGraph.join(';');
  maps.push('-map', '[a]', '-c:a', 'aac', '-b:a', '192k');
}
ff([...base, '-filter_complex', graph, ...maps, '-t', TOTAL.toFixed(3), ...enc, '-movflags', '+faststart', OUT]);
// Where each voice-over line starts, for mixing the narration elsewhere.
const voiceAt = [['intro', 0.25], ...slots.map((s) => [s.name, s.i === 0 ? s.at + INTRO + 0.4 : s.at + 0.15]), ['outro', DOOR_AT + 0.6]];
fs.writeFileSync(OUT.replace(/\.mp4$/, '.voice.json'), JSON.stringify({ total: TOTAL, lines: voiceAt.map(([n, at]) => ({ n, at: Number(at.toFixed(3)) })) }, null, 2));
console.log(`done: ${OUT} (${TOTAL.toFixed(1)} s)`);
