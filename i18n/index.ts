import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: (callback: (lng: string) => void) => {
    if (isSSR) {
      callback('sq');
      return;
    }
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      callback(saved && (SUPPORTED as readonly string[]).includes(saved) ? saved : getDeviceLanguage());
    });
  },
  init: () => {},
  cacheUserLanguage: (lng: string) => {
    if (!isSSR) AsyncStorage.setItem(STORAGE_KEY, lng);
  },
};

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
