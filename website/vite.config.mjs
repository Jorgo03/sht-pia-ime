// The website (DECISIONS.md W10): its own Vite app, separate from the phone
// apps, reading the same Supabase project with the public anon key.
// Built by scripts/build-website.mjs; `npm run website:dev` serves it locally.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: here,
  publicDir: path.join(here, 'public'),
  // .env / .env.local live at the repo root; Vercel already has the
  // EXPO_PUBLIC_ names from the phone app's web build, so both are read.
  envDir: path.join(here, '..'),
  envPrefix: ['VITE_', 'EXPO_PUBLIC_'],
  plugins: [react()],
  resolve: {
    alias: { '@': path.join(here, '..') },
  },
  server: { port: 5180 },
  // Pre-bundled up front so the dev server never re-optimises mid-visit
  // (which loads a second copy of React).
  optimizeDeps: { include: ['react-leaflet', 'leaflet'] },
  build: {
    emptyOutDir: true,
    sourcemap: false,
    // Libraries and the place list change rarely: separate files, so a site
    // update does not make returning visitors download them again.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react'
          if (/node_modules[\\/]@supabase[\\/]/.test(id)) return 'supabase'
          if (/features[\\/]properties[\\/]data[\\/]locations\.js$/.test(id)) return 'places'
        },
      },
    },
  },
})
