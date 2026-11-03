import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Native bundles every language; the web bundles Albanian and fetches the
// others on first use (i18n/locales.ts and locales.web.ts).
import { bundledResources, loadLocale } from './locales';

const STORAGE_KEY = 'fho_lang';
const SUPPORTED = ['sq', 'en', 'de', 'it', 'es', 'pl', 'ru', 'fr'] as const;
const isSSR = typeof window === 'undefined';

function getDeviceLanguage(): string {
  if (isSSR) return 'sq';
  try {
    const locales = getLocales();
    const deviceLang = locales[0]?.languageCode ?? 'sq';
    if ((SUPPORTED as readonly string[]).includes(deviceLang)) return deviceLang;
  } catch {}
  return 'sq';
}

const isSupported = (lng: string | null | undefined): lng is string =>
  !!lng && (SUPPORTED as readonly string[]).includes(lng);

// The website is pre-rendered in Albanian, and React needs the first render
// in the browser to match that HTML exactly. So on the web every page starts
// in Albanian and switches to the saved or device language only once the
// page has hydrated (applyPreferredLanguage, called from the root layout).
// Until then nothing is written back, so the start-up language never
// overwrites a saved choice. Native apps detect the language up front.
const deferToHydration = Platform.OS === 'web';
let languageReady = !deferToHydration;

async function preferredLanguage(): Promise<string> {
  const saved = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
  return isSupported(saved) ? saved : getDeviceLanguage();
}

const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: (callback: (lng: string) => void) => {
    if (isSSR || deferToHydration) {
      callback('sq');
      return;
    }
    preferredLanguage().then(callback);
  },
  init: () => {},
  cacheUserLanguage: (lng: string) => {
    if (!isSSR && languageReady) AsyncStorage.setItem(STORAGE_KEY, lng);
  },
};

// Web: keep <html lang> in step with the language shown, so screen readers
// read the page with the right voice (the HTML is pre-rendered as "sq").
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  i18n.on('languageChanged', (lng) => {
    document.documentElement.lang = lng;
  });
}

/** Web: switch to the visitor's language after hydration. No-op on native. */
export async function applyPreferredLanguage(): Promise<void> {
  if (!deferToHydration || languageReady) return;
  const lng = await preferredLanguage();
  languageReady = true;
  if (lng !== i18n.language) await i18n.changeLanguage(lng);
}

// i18next's backend hook: asked for a language that is not bundled, it
// loads it before changeLanguage resolves, so the page keeps its current
// language until the new one is in (useSuspense is off: nothing blanks).
const localeBackend = {
  type: 'backend' as const,
  init: () => {},
  read: (lng: string, _ns: string, callback: (err: unknown, data: Record<string, unknown> | null) => void) => {
    if (!loadLocale) return callback(new Error('no loader'), null);
    loadLocale(lng).then((data) => callback(null, data), (err) => callback(err, null));
  },
};

if (loadLocale) i18n.use(localeBackend);

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: bundledResources,
    // With a backend, languages missing from `resources` are fetched.
    partialBundledLanguages: !!loadLocale,
    fallbackLng: 'sq',
    supportedLngs: [...SUPPORTED],
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
