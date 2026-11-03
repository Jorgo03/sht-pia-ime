// Phones and tablets: every language is in the app bundle, so switching
// language is instant and works offline. The web gets locales.web.ts.
import sq from '../src/i18n/locales/sq.json';
import en from '../src/i18n/locales/en.json';
import de from '../src/i18n/locales/de.json';
import it from '../src/i18n/locales/it.json';
import es from '../src/i18n/locales/es.json';
import pl from '../src/i18n/locales/pl.json';
import ru from '../src/i18n/locales/ru.json';
import fr from '../src/i18n/locales/fr.json';

export const bundledResources = {
  sq: { translation: sq },
  en: { translation: en },
  de: { translation: de },
  it: { translation: it },
  es: { translation: es },
  pl: { translation: pl },
  ru: { translation: ru },
  fr: { translation: fr },
};

/** Loads a language that is not bundled; null when every language is. */
export const loadLocale: ((lng: string) => Promise<Record<string, unknown>>) | null = null;
