import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// The public address of the site, used for absolute URLs in index.html
// (link previews need them), robots.txt and sitemap.xml. Set VITE_SITE_URL in
// Vercel once a custom domain is live; until then it is the current Vercel
// deployment.
process.env.VITE_SITE_URL = (process.env.VITE_SITE_URL || 'https://real-estate-app-hazel-seven.vercel.app').replace(/\/+$/, '')

// Routes that only make sense signed in; kept out of search results.
const PRIVATE_ROUTES = ['/profile', '/messages', '/favorites', '/my-listings', '/new-listing', '/viewings', '/saved-searches', '/agent-dashboard', '/auth/']
const PUBLIC_ROUTES = ['/', '/search', '/privacy', '/terms']

/**
 * Emits robots.txt and sitemap.xml at build time. The sitemap lists every
 * active listing so Google finds them without crawling the search page; it
 * reads public, RLS-filtered data with the anon key, the same as any visitor.
 * If the database cannot be reached (CI, e2e, offline) the build still
 * succeeds with the fixed pages only.
 */
function seoFiles() {
  let env = {}
  return {
    name: 'seo-files',
    apply: 'build',
    configResolved(config) {
      env = config.env
    },
    async generateBundle() {
      const site = process.env.VITE_SITE_URL
      let listings = []
      try {
        // Supabase caps a response at 1000 rows by default, so page through.
        for (let offset = 0; offset < 50000; offset += 1000) {
          const res = await fetch(
            `${env.VITE_SUPABASE_URL}/rest/v1/properties?select=id,updated_at&status=eq.active&order=updated_at.desc&limit=1000&offset=${offset}`,
            { headers: { apikey: env.VITE_SUPABASE_ANON_KEY }, signal: AbortSignal.timeout(8000) },
          )
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const page = await res.json()
          listings.push(...page)
          if (page.length < 1000) break
        }
      } catch (e) {
        listings = []
        this.warn(`sitemap: listings left out (${e.message})`)
      }
      const url = (loc, lastmod) => `  <url><loc>${site}${loc}</loc>${lastmod ? `<lastmod>${lastmod.slice(0, 10)}</lastmod>` : ''}</url>`
      const sitemap = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...PUBLIC_ROUTES.map((r) => url(r)),
        ...listings.map((l) => url(`/property/${l.id}`, l.updated_at)),
        '</urlset>',
        '',
      ].join('\n')
      const robots = [
        'User-agent: *',
        'Allow: /',
        ...PRIVATE_ROUTES.map((r) => `Disallow: ${r}`),
        '',
        `Sitemap: ${site}/sitemap.xml`,
        '',
      ].join('\n')
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap })
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: robots })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), seoFiles()],
  server: { port: 5173, host: true },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
})
