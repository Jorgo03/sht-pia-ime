// Every language the app and the website ship, Albanian first (the default
// and the language every web page is pre-rendered in). One list for the app,
// the website's language links and the tests; the locale files live in
// src/i18n/locales/<code>.json and are shared with the Vite site.
export const LANGUAGES = ['sq', 'en', 'de', 'it', 'es', 'pl', 'ru', 'fr', 'el', 'tr'];

export const DEFAULT_LANGUAGE = 'sq';

export const isLanguage = (lng) => typeof lng === 'string' && LANGUAGES.includes(lng);
