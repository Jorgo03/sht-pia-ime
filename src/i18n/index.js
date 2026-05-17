import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import sq from './locales/sq.json'
import en from './locales/en.json'
import de from './locales/de.json'
import it from './locales/it.json'
import es from './locales/es.json'
import pl from './locales/pl.json'
import ru from './locales/ru.json'
import fr from './locales/fr.json'

i18n
  .use(LanguageDetector)
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
    supportedLngs: ['sq', 'en', 'de', 'it', 'es', 'pl', 'ru', 'fr'],
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'fho_lang',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
