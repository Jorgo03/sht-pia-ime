#!/usr/bin/env node
// Production website build on Vercel, called from the root vercel.json.
// Since 2026-11-24 (DECISIONS.md W10) the website is the new, separate
// project in website/, built by scripts/build-website.mjs; it no longer
// exports the Expo app for the web.
import { execSync } from 'node:child_process';

execSync('node scripts/build-website.mjs dist', { stdio: 'inherit' });
