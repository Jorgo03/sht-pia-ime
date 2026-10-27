#!/usr/bin/env node
// Free Albanian voice-over with Microsoft's neural voices (the same service as
// Edge's "Read aloud"): no account, no key. Needs internet.
//   node ad-tools/voiceover.mjs "Teksti këtu." [--voice sq-AL-IlirNeural] [--out ad-tools/voice.mp3]
// Albanian voices: sq-AL-AnilaNeural (female, default), sq-AL-IlirNeural (male).
import fs from 'node:fs';
import path from 'node:path';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const text = process.argv[2];
if (!text || text.startsWith('--')) {
  console.error('Usage: node ad-tools/voiceover.mjs "Teksti këtu." [--voice sq-AL-AnilaNeural] [--out voice.mp3]');
  process.exit(1);
}
const out = path.resolve(arg('out', 'ad-tools/voice.mp3'));
const dir = fs.mkdtempSync(path.join(path.dirname(out), '.tts-'));
const tts = new MsEdgeTTS();
await tts.setMetadata(arg('voice', 'sq-AL-AnilaNeural'), OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
const { audioFilePath } = await tts.toFile(dir, text);
tts.close();
fs.renameSync(audioFilePath, out);
fs.rmSync(dir, { recursive: true, force: true });
console.log(`voice-over: ${out}`);
