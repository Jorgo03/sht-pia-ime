#!/usr/bin/env node
// Builds the app's website (the same build the e2e tests use: fake Supabase,
// never production) once, then serves it on http://localhost:4174 for the
// scene recorder. Run from the app folder: node ad-tools/serve-app.mjs
import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(APP, 'dist-e2e-expo');
const env = { ...process.env, CI: '1', EXPO_PUBLIC_SUPABASE_URL: 'https://e2e.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'e2e-anon-key', EXPO_PUBLIC_SITE_URL: '' };
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: APP, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
if (!fs.existsSync(path.join(OUT, 'index.html')) || process.argv.includes('--rebuild')) {
  run('npx', ['expo', 'export', '-p', 'web', '--clear', '--output-dir', 'dist-e2e-expo']);
  run('node', ['scripts/expo-web-postbuild.mjs', 'dist-e2e-expo']);
}
console.log('Serving the app on http://localhost:4174 (Ctrl+C to stop)');
spawn('node', ['scripts/expo-web/serve.cjs', 'dist-e2e-expo', '4174'], { cwd: APP, env, stdio: 'inherit' });
