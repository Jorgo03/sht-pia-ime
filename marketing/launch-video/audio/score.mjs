// The launch video's music, synthesized from nothing: no samples, no licence.
// Timed to the scenes in index.html, 100 BPM (a bar = 2.4 s).
//
//   node marketing/launch-video/audio/score.mjs [out.wav]
//
// Deterministic (a seeded noise generator), so the same file every run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] ?? path.join(here, 'score.wav');
const SR = 44100;
const LENGTH = 25;
const N = SR * LENGTH;
const L = new Float32Array(N);
const R = new Float32Array(N);
const send = [new Float32Array(N), new Float32Array(N)]; // reverb bus

const BEAT = 0.6;
const midi = (m) => 440 * 2 ** ((m - 69) / 12);
let seed = 7;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32) * 2 - 1;

const smooth = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
// Piecewise-linear automation through [time, value] points.
const env = (pts) => (t) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i][0]) {
      const [t0, v0] = pts[i - 1];
      const [t1, v1] = pts[i];
      return v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
    }
  }
  return pts[pts.length - 1][1];
};

function add(i, l, r, wet) {
  if (i < 0 || i >= N) return;
  L[i] += l; R[i] += r;
  send[0][i] += l * wet; send[1][i] += r * wet;
}

// Warm pad: detuned saws through a one-pole low-pass that opens over time.
function pad(notes, t0, t1, gain, cutoff, wet = 0.5) {
  const a = Math.floor(t0 * SR), b = Math.floor(t1 * SR);
  for (const [k, m] of notes.entries()) {
    const voices = [-0.08, 0.0, 0.07].map((d) => midi(m + d));
    let lp = 0;
    const pan = ((k % 2) * 2 - 1) * 0.35;
    const ph = voices.map((_, v) => (k * 0.37 + v * 0.21) % 1);
    for (let i = a; i < b; i++) {
      const t = i / SR;
      let s = 0;
      voices.forEach((f, v) => { ph[v] = (ph[v] + f / SR) % 1; s += ph[v] * 2 - 1; });
      const fc = cutoff(t);
      lp += (s / 3 - lp) * (1 - Math.exp((-2 * Math.PI * fc) / SR));
      const fade = Math.min(1, (t - t0) / 0.9, (t1 - t) / 0.9);
      const g = gain(t) * Math.max(0, fade) / notes.length;
      add(i, lp * g * (1 - pan), lp * g * (1 + pan), wet);
    }
  }
}

// Felt-piano / pluck: a few decaying harmonics with a soft attack.
function pluck(m, t, gain, decay = 1.6, pan = 0, wet = 0.45, bright = 1) {
  const f = midi(m);
  const a = Math.floor(t * SR), len = Math.floor(decay * 2.2 * SR);
  const harm = [[1, 1], [2, 0.42 * bright], [3, 0.16 * bright], [4.01, 0.07 * bright]];
  for (let j = 0; j < len; j++) {
    const tt = j / SR;
    let s = 0;
    for (const [h, amp] of harm) s += Math.sin(2 * Math.PI * f * h * tt) * amp * Math.exp((-tt * h) / decay);
    const att = Math.min(1, tt / 0.004);
    const v = s * gain * att;
    add(a + j, v * (1 - pan), v * (1 + pan), wet);
  }
}

// Soft kick: a sine dropping in pitch.
function kick(t, gain) {
  const a = Math.floor(t * SR);
  let ph = 0;
  for (let j = 0; j < 0.45 * SR; j++) {
    const tt = j / SR;
    ph += (2 * Math.PI * (45 + 90 * Math.exp(-tt * 28))) / SR;
    const v = Math.sin(ph) * Math.exp(-tt * 7) * gain;
    add(a + j, v, v, 0.05);
  }
}

// Filtered noise: hats, whooshes, risers.
function noise(t0, dur, gain, { hp = 0.9, shape = (x) => Math.exp(-x * 40), pan = 0, wet = 0.3 } = {}) {
  const a = Math.floor(t0 * SR), len = Math.floor(dur * SR);
  let prev = 0, lp = 0;
  for (let j = 0; j < len; j++) {
    const n = rand();
    const h = n - prev * hp; prev = n;
    lp += (h - lp) * 0.5;
    const v = lp * gain * shape(j / len);
    add(a + j, v * (1 - pan), v * (1 + pan), wet);
  }
}

// Sub swell under everything (D1), louder at the start and the end.
function sub(t0, t1, m, gain) {
  const a = Math.floor(t0 * SR), b = Math.floor(t1 * SR), f = midi(m);
  for (let i = a; i < b; i++) {
    const t = i / SR;
    const v = Math.sin(2 * Math.PI * f * t) * gain(t);
    add(i, v, v, 0);
  }
}

// ---- The score ----------------------------------------------------------
// Chords (MIDI). D major, hopeful: D – Bm – G – A.
const D = [50, 57, 62, 64, 66, 69];   // Dadd9
const Bm = [47, 54, 59, 62, 66, 69];  // Bm7-ish
const G = [43, 50, 55, 59, 62, 66];   // Gmaj7
const A = [45, 52, 57, 61, 64, 69];   // A(add9)

// 0–3 s: dark pad and sub, the light rising.
pad(D, 0, 7.4, env([[0, 0], [2.5, 0.5], [6.5, 0.55], [7.4, 0.3]]), env([[0, 180], [3, 700], [7, 1200]]));
sub(0, 7.2, 26, env([[0, 0], [2.2, 0.16], [3.2, 0.1], [7.2, 0]]));
noise(1.2, 1.9, 0.07, { hp: 0.6, shape: (x) => x * x * Math.exp(-(1 - x) * 0.1) * (x < 0.95 ? 1 : (1 - x) * 20), wet: 0.5 });

// 3 s: the reveal — a low hit and a felt-piano motif.
kick(3.0, 0.5);
const motif = [[69, 0], [66, 0.6], [74, 1.2], [73, 1.8], [69, 2.4], [71, 3.0]];
for (const [m, at] of motif) pluck(m, 3.05 + at, 0.11, 1.8, 0.15, 0.6, 0.8);

// 7–17 s: the pulse. Bars of 2.4 s from 7.0.
const bars = [[7.0, Bm], [9.4, G], [11.8, D], [14.2, A], [16.6, G], [19.0, A]];
for (const [t, ch] of bars) {
  pad(ch, t - 0.05, t + 2.5, env([[t, 0.42], [t + 2.4, 0.42]]), env([[7, 900], [16.6, 2600], [21, 4200]]), 0.45);
}
for (const [b, [t, ch]] of bars.slice(0, 5).entries()) {
  const tones = [ch[2], ch[3], ch[4], ch[5]];
  for (let s = 0; s < 8; s++) {
    const at = t + s * (BEAT / 2);
    if (at > 20.85) break;
    const m = tones[(s * 3 + b) % 4] + 12;
    pluck(m, at, s % 2 ? 0.045 : 0.065, 0.35, s % 2 ? 0.35 : -0.35, 0.35, 0.5);
  }
  for (let k = 0; k < 4; k++) {
    const at = t + k * BEAT;
    if (b >= 1 || k >= 2) kick(at, b >= 3 ? 0.42 : 0.3);
    if (b >= 1) noise(at + BEAT / 2, 0.06, 0.05, { pan: 0.2, wet: 0.15 });
  }
}
// 12 s: daylight opens — a short whoosh into the beat.
noise(11.1, 0.95, 0.12, { hp: 0.4, shape: (x) => x ** 3 * (x < 0.97 ? 1 : (1 - x) * 33), wet: 0.6 });
// 17–21 s: the lift — the motif comes back an octave up, over the strings.
for (const [m, at] of motif.slice(0, 5)) pluck(m + 12, 16.6 + at, 0.07, 1.4, -0.1, 0.65, 0.6);
// Riser into the final hit.
noise(19.2, 1.75, 0.16, { hp: 0.3, shape: (x) => x ** 2.5 * (x < 0.98 ? 1 : (1 - x) * 50), wet: 0.6 });

// 21 s: the brand — one wide chord, a boom, and a long tail to the end.
kick(20.95, 0.75);
sub(20.95, 25, 26, env([[20.95, 0.28], [22.5, 0.12], [25, 0]]));
pad([...D, 74, 78], 20.95, 25, env([[20.95, 0.75], [22, 0.55], [25, 0]]), env([[20.95, 3800], [25, 900]]), 0.7);
for (const [k, m] of [62, 66, 69, 74, 78].entries()) pluck(m, 20.95 + k * 0.035, 0.09, 2.6, (k - 2) * 0.2, 0.75, 0.7);

// ---- Reverb (Schroeder: 4 combs + 2 all-passes per side) -----------------
function reverb(input, combs, aps, fb = 0.84, damp = 0.25) {
  const outBuf = new Float32Array(N);
  for (const d of combs) {
    const buf = new Float32Array(d); let idx = 0, lp = 0;
    for (let i = 0; i < N; i++) {
      const y = buf[idx];
      lp = y * (1 - damp) + lp * damp;
      buf[idx] = input[i] + lp * fb;
      outBuf[i] += y / combs.length;
      idx = (idx + 1) % d;
    }
  }
  for (const d of aps) {
    const buf = new Float32Array(d); let idx = 0;
    for (let i = 0; i < N; i++) {
      const bv = buf[idx];
      const y = -outBuf[i] + bv;
      buf[idx] = outBuf[i] + bv * 0.5;
      outBuf[i] = y;
      idx = (idx + 1) % d;
    }
  }
  return outBuf;
}
const revL = reverb(send[0], [1557, 1617, 1491, 1422], [225, 556]);
const revR = reverb(send[1], [1580, 1640, 1514, 1445], [248, 579]);

// ---- Mix, master, write ---------------------------------------------------
let peak = 0;
for (let i = 0; i < N; i++) {
  L[i] += revL[i] * 0.55; R[i] += revR[i] * 0.55;
  // Gentle saturation, then fade the last half-second to silence.
  const fadeOut = Math.min(1, (N - i) / (0.5 * SR));
  L[i] = Math.tanh(L[i] * 1.2) * fadeOut;
  R[i] = Math.tanh(R[i] * 1.2) * fadeOut;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = 0.89 / peak; // about -1 dBFS
const data = Buffer.alloc(N * 4);
for (let i = 0; i < N; i++) {
  data.writeInt16LE(Math.round(L[i] * norm * 32767), i * 4);
  data.writeInt16LE(Math.round(R[i] * norm * 32767), i * 4 + 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVE', 8);
header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22);
header.writeUInt32LE(SR, 24); header.writeUInt32LE(SR * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
header.write('data', 36); header.writeUInt32LE(data.length, 40);
fs.writeFileSync(out, Buffer.concat([header, data]));
console.log(`Wrote ${out}`);
