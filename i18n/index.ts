import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import sq from '../src/i18n/locales/sq.json';
import en from '../src/i18n/locales/en.json';
import de from '../src/i18n/locales/de.json';
import it from '../src/i18n/locales/it.json';
import es from '../src/i18n/locales/es.json';
import pl from '../src/i18n/locales/pl.json';
import ru from '../src/i18n/locales/ru.json';
import fr from '../src/i18n/locales/fr.json';

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

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      sq: { translation: sq },
      en: { translation: en },
      de: { translation: de },
      it: { translation: it },
      es: { translation: es },
      pl: { translation: pl },
      ru: { translation: ru },
      fr: { translation: fr },
    },
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
