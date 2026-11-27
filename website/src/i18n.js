// The website reads the same shared locale files as the phone app
// (src/i18n/locales). Albanian is bundled; other languages load on demand.
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import sq from '@/src/i18n/locales/sq.json'
import { DEFAULT_LANGUAGE, LANGUAGES, isLanguage } from '../../i18n/languages.js'

export { LANGUAGES }

// Each language's own name, for the switcher.
export const LANGUAGE_NAMES = {
  sq: 'Shqip', en: 'English', de: 'Deutsch', it: 'Italiano', es: 'Español',
  pl: 'Polski', ru: 'Русский', fr: 'Français', el: 'Ελληνικά', tr: 'Türkçe',
}

const loaders = import.meta.glob(['../../src/i18n/locales/*.json', '!../../src/i18n/locales/sq.json'])
// Same storage key as the earlier website on this address, so returning
// visitors keep their language.
const STORAGE_KEY = 'fho_lang'

function initialLanguage() {
  // A link that names its language (?lang=en, as the old site and the
  // hreflang alternates write) opens in it, and the choice is kept.
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('lang')
    if (isLanguage(fromUrl)) {
      try {
        localStorage.setItem(STORAGE_KEY, fromUrl)
      } catch {
        // Not remembered, still shown.
      }
      return fromUrl
    }
  } catch {
    // No usable address: fall through.
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (isLanguage(saved)) return saved
  } catch {
    // Storage blocked (private mode, policy): fall back to the browser.
  }
  for (const tag of navigator.languages ?? [navigator.language]) {
    const code = String(tag).slice(0, 2).toLowerCase()
    if (isLanguage(code)) return code
  }
  return DEFAULT_LANGUAGE
}

async function ensureLoaded(lng) {
  if (i18n.hasResourceBundle(lng, 'translation')) return
  const load = loaders[`../../src/i18n/locales/${lng}.json`]
  if (!load) return
  const mod = await load()
  i18n.addResourceBundle(lng, 'translation', mod.default ?? mod, true, true)
}

export async function setLanguage(lng) {
  if (!isLanguage(lng)) return
  await ensureLoaded(lng)
  await i18n.changeLanguage(lng)
  document.documentElement.lang = lng
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    // Not remembered, still switched.
  }
}

i18n.use(initReactI18next).init({
  resources: { sq: { translation: sq } },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: LANGUAGES,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
})

const first = initialLanguage()
if (first !== DEFAULT_LANGUAGE) setLanguage(first)

export default i18n
