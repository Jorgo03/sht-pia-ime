// The website bundles only Albanian (the language every page is first drawn
// in, see i18n/index.ts) and fetches another language the first time it is
// chosen. The eight files are ~316KB; most visitors use one of them.
import sq from '../src/i18n/locales/sq.json';

export const bundledResources = {
  sq: { translation: sq },
};

const loaders: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  en: () => import('../src/i18n/locales/en.json'),
  de: () => import('../src/i18n/locales/de.json'),
  it: () => import('../src/i18n/locales/it.json'),
  es: () => import('../src/i18n/locales/es.json'),
  pl: () => import('../src/i18n/locales/pl.json'),
  ru: () => import('../src/i18n/locales/ru.json'),
  fr: () => import('../src/i18n/locales/fr.json'),
};

export const loadLocale: ((lng: string) => Promise<Record<string, unknown>>) | null = async (lng) => {
  if (lng === 'sq') return sq;
  const load = loaders[lng];
  if (!load) throw new Error(`No locale ${lng}`);
  const mod = await load();
  return mod.default ?? mod;
};
