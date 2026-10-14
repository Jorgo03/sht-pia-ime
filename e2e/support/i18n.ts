import de from '../../src/i18n/locales/de.json' with { type: 'json' };
import en from '../../src/i18n/locales/en.json' with { type: 'json' };
import sq from '../../src/i18n/locales/sq.json' with { type: 'json' };

// Specs look strings up in the app's own locale files instead of hardcoding
// Albanian text, so a copy change does not break a test, and a missing key does.

type Tree = { [key: string]: string | Tree };

const LOCALES: Record<string, Tree> = { sq, en, de };

export function t(key: string, lang = 'sq'): string {
  const value = key.split('.').reduce<string | Tree | undefined>((node, part) => (typeof node === 'object' ? node[part] : undefined), LOCALES[lang]);
  if (typeof value !== 'string') throw new Error(`Missing locale key ${lang}:${key}`);
  return value;
}
