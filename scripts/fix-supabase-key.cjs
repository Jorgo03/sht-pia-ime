#!/usr/bin/env node

/**
 * `npm run fix:supabase-key` — puts the production Supabase URL and anon key
 * into .env.local and .env, taken from the clipboard.
 *
 * Why a script instead of instructions: on 2026-10-07 the key was copied out
 * of a chat window that masks secrets, so the file received `eyJhbGci` plus
 * placeholder characters (saved as '?'), and every request failed with
 * 401 Invalid API key. Hand-editing two files with Notepad is exactly where
 * that goes wrong again. The key itself is never stored in this repository:
 * it comes from the owner's clipboard after they click Copy in the dashboard,
 * and it is validated before anything is written.
 *
 * Accepts a legacy anon JWT, whose payload must name the production project
 * with role "anon" (a service_role key is refused outright), or a modern
 * sb_publishable_ key.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync, spawn } = require('child_process');

const { jwtClaims, EXPECTED_REF } = require('./check-supabase-env.cjs');

const ROOT = path.resolve(__dirname, '..');
const URL = `https://${EXPECTED_REF}.supabase.co`;
const DASHBOARD = `https://supabase.com/dashboard/project/${EXPECTED_REF}/settings/api-keys`;

function openBrowser(url) {
  const command =
    process.platform === 'win32'
      ? `start "" "${url}"`
      : process.platform === 'darwin'
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  spawn(command, { shell: true, stdio: 'ignore', detached: true }).unref();
}

function readClipboard() {
  try {
    if (process.platform === 'win32') {
      return execSync('powershell -NoProfile -Command Get-Clipboard', { encoding: 'utf8' });
    }
    if (process.platform === 'darwin') return execSync('pbpaste', { encoding: 'utf8' });
  } catch {
    // Fall through to the typed prompt.
  }
  return null;
}

// One interface for every prompt: a second one would miss input the first
// already buffered (piped stdin, or a fast paste).
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const lines = rl[Symbol.asyncIterator]();

async function ask(question) {
  process.stdout.write(question);
  const { value } = await lines.next();
  return value ?? '';
}

/** Returns an error message, or null when the key is usable. */
function validate(key) {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return null;
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) {
    return key.startsWith('eyJ')
      ? 'The copied key is damaged (it contains characters a real key never has). ' +
          'Copy it again with the Copy button in the dashboard, not from a chat or screenshot.'
      : 'The clipboard does not hold a Supabase key. Click Copy next to the anon key first.';
  }
  const claims = jwtClaims(key);
  if (!claims) return 'The copied key could not be read. Copy it again from the dashboard.';
  if (claims.role === 'service_role') {
    return 'That is the service_role key — it must never go in an app. Copy the "anon" "public" key instead.';
  }
  if (claims.ref !== EXPECTED_REF) {
    return `That key belongs to project ${claims.ref}, not ${EXPECTED_REF}. Copy the key from the fho-marketplace project.`;
  }
  if (claims.role !== 'anon') return `That key has role "${claims.role}"; the app needs the "anon" key.`;
  return null;
}

/** Sets KEY=value on its existing line, or appends it; keeps everything else. */
function upsert(lines, name, value) {
  const index = lines.findIndex((l) => l.startsWith(`${name}=`));
  if (index >= 0) lines[index] = `${name}=${value}`;
  else lines.push(`${name}=${value}`);
}

function writeEnv(file, entries) {
  const full = path.join(ROOT, file);
  const original = fs.existsSync(full) ? fs.readFileSync(full, 'utf8').replace(/^﻿/, '') : '';
  const eol = original.includes('\r\n') ? '\r\n' : '\n';
  const lines = original ? original.split(/\r?\n/) : [];
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  for (const [name, value] of entries) upsert(lines, name, value);
  fs.writeFileSync(full, lines.join(eol) + eol, 'utf8');
}

async function main() {
  console.log('\nThis fixes the Supabase key the app uses. Two steps:\n');
  console.log(`  1. Your browser opens the Supabase dashboard (${DASHBOARD}).`);
  console.log('     Open the "Legacy API Keys" tab and click Copy next to "anon" "public".');
  console.log('  2. Come back here and press Enter.\n');
  openBrowser(DASHBOARD);
  await ask('Press Enter once you have clicked Copy... ');

  let key = (readClipboard() ?? '').trim();
  if (!key) key = (await ask('Paste the key here and press Enter: ')).trim();
  key = key.replace(/^["']|["']$/g, '');

  const problem = validate(key);
  if (problem) {
    console.error(`\n[fix:supabase-key] ${problem}\nNothing was changed. Run npm run fix:supabase-key again.\n`);
    rl.close();
    process.exit(1);
  }
  rl.close();

  writeEnv('.env.local', [
    ['EXPO_PUBLIC_SUPABASE_URL', URL],
    ['EXPO_PUBLIC_SUPABASE_ANON_KEY', key],
    ['VITE_SUPABASE_URL', URL],
    ['VITE_SUPABASE_ANON_KEY', key],
  ]);
  if (fs.existsSync(path.join(ROOT, '.env'))) {
    writeEnv('.env', [
      ['EXPO_PUBLIC_SUPABASE_URL', URL],
      ['EXPO_PUBLIC_SUPABASE_ANON_KEY', key],
    ]);
  }

  console.log(`\n[fix:supabase-key] Done. The key is valid for ${EXPECTED_REF} and is now in .env.local and .env.`);
  console.log('[fix:supabase-key] Next: close any other running npm start, then run:\n');
  console.log('    npm start -- --clear\n');
}

main();
