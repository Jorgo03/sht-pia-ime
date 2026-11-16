#!/usr/bin/env node
// Production website build on Vercel (DECISIONS.md W6): the Expo app's web
// export plus scripts/expo-web-postbuild.mjs, into dist/. Called from the root
// vercel.json (whose buildCommand may not exceed 256 characters).
//
// Reuses the project's VITE_SUPABASE_* variables (the old Vite site's) when
// the EXPO_PUBLIC_ ones are not set, so the Vercel project needs no change.
// Only public, anon-safe values: EXPO_PUBLIC_ ends up in the browser.
import { execSync } from 'node:child_process';

const env = { ...process.env, NODE_ENV: 'production' };
env.EXPO_PUBLIC_SUPABASE_URL ||= process.env.VITE_SUPABASE_URL || '';
env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||= process.env.VITE_SUPABASE_ANON_KEY || '';
env.EXPO_PUBLIC_SITE_URL ||= 'https://real-estate-app-hazel-seven.vercel.app';

if (!env.EXPO_PUBLIC_SUPABASE_URL || !env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('vercel-build: no Supabase URL or anon key (EXPO_PUBLIC_ or VITE_ variables)');
  process.exit(1);
}

const run = (cmd) => execSync(cmd, { stdio: 'inherit', env });
run('npm run build:web-expo -- --output-dir dist');
run('node scripts/expo-web-postbuild.mjs dist');
