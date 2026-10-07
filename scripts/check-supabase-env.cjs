/**
 * Says, before Metro starts, which Supabase project the phone app will talk to.
 *
 * Expo inlines EXPO_PUBLIC_SUPABASE_URL into the bundle from whichever .env*
 * file wins, and `.env.local` beats `.env`. `vercel env pull` writes
 * `.env.local`, and Vercel's Supabase integration provisioned a second,
 * separate project (`@jorgo03/real-estate-app-…`) whose URL it hands out
 * under these same EXPO_PUBLIC_ names. Pointed at that project — paused and
 * empty — the app opened, made no request the real database ever saw, and
 * showed loading skeletons with nothing behind them. Nothing on screen or in
 * the terminal named the cause, so this names it.
 *
 * Warns, never blocks: pointing at another project on purpose (a staging
 * copy, a local stack) is legitimate, and the warning says how to read it.
 */

const path = require('path');

const { requireFromExpo } = require('./require-from-expo.cjs');

/** Production project — see CLAUDE.md "Supabase project ref". */
const EXPECTED_REF = 'xzzzhlwmzotibrxdqmcm';

function projectRef(url) {
  const match = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/i.exec(url ?? '');
  return match ? match[1] : null;
}

/** First file (in Expo's precedence order) that defines `key`, or the shell. */
function sourceOf(key, files, expoEnv) {
  if (process.env[key] != null) return 'shell environment';
  for (const file of files) {
    const { env } = expoEnv.parseEnvFiles([file], { systemEnv: {} });
    if (env[key] != null) return path.basename(file);
  }
  return null;
}

function checkSupabaseEnv(projectRoot = path.resolve(__dirname, '..')) {
  // Ships inside expo itself; if it is missing, `expo start` could not run
  // either, and requireFromExpo exits with the `npm install` instruction.
  const expoEnv = requireFromExpo('@expo/env', 'supabase');

  const { env, files } = expoEnv.parseProjectEnv(projectRoot, {
    mode: 'development',
    silent: true,
    systemEnv: process.env,
  });
  const merged = { ...env, ...process.env };
  const url = merged.EXPO_PUBLIC_SUPABASE_URL;

  if (!url) {
    console.warn(
      '[supabase] EXPO_PUBLIC_SUPABASE_URL is not set in any .env file — the app will ' +
        'stop at launch with "Missing Supabase env vars". See .env.example.',
    );
    return;
  }

  const ref = projectRef(url);
  const source = sourceOf('EXPO_PUBLIC_SUPABASE_URL', files, expoEnv);
  console.log(`[supabase] Phone app uses project ${ref ?? url} (from ${source}).`);

  if (ref !== EXPECTED_REF) {
    console.warn(
      `[supabase] WARNING: that is not the production project (${EXPECTED_REF}). ` +
        'If listings never load, this is why: the app is reading a different — possibly ' +
        `paused or empty — database. Fix EXPO_PUBLIC_SUPABASE_URL and ` +
        `EXPO_PUBLIC_SUPABASE_ANON_KEY in ${source}, then run npm start again.`,
    );
  }

  const webRef = projectRef(merged.VITE_SUPABASE_URL);
  if (webRef && ref && webRef !== ref) {
    console.warn(
      `[supabase] WARNING: the web app (VITE_SUPABASE_URL) uses ${webRef} but the phone ` +
        `app uses ${ref}. They are meant to share one backend.`,
    );
  }
}

module.exports = { checkSupabaseEnv, projectRef, EXPECTED_REF };
