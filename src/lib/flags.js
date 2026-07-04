// Feature flags for AI features. Priority: localStorage override > env > default.
// Toggle at runtime from the browser console, e.g.:
//   localStorage.setItem('fho_flags', JSON.stringify({ aiSearch: false }))
// or at build time in .env.local: VITE_FLAG_AI_SEARCH=false

const DEFAULTS = {
  aiListingGenerator: true, // Feature A — wizard copy generation
  aiSearch: true,           // Feature B — natural-language search parsing
  aiAssistant: true,        // Feature C — per-listing buyer chat
  autoTranslate: true,      // Feature E — one-click 8-language listing translation
}

const ENV_NAMES = {
  aiListingGenerator: 'VITE_FLAG_AI_LISTING_GENERATOR',
  aiSearch: 'VITE_FLAG_AI_SEARCH',
  aiAssistant: 'VITE_FLAG_AI_ASSISTANT',
  autoTranslate: 'VITE_FLAG_AUTO_TRANSLATE',
}

function localOverrides() {
  try {
    return JSON.parse(localStorage.getItem('fho_flags') || '{}')
  } catch {
    return {}
  }
}

export function isEnabled(flag) {
  const local = localOverrides()
  if (typeof local[flag] === 'boolean') return local[flag]
  const env = import.meta.env[ENV_NAMES[flag]]
  if (env === 'false') return false
  if (env === 'true') return true
  return DEFAULTS[flag] ?? false
}
