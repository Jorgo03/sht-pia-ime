import Head from 'expo-router/head';
import { usePathname, useSegments } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { IS_WEB } from '@/constants/web-frame';
import { SITE_URL } from '@/lib/site';
import { isPrivatePath, languageLinks } from '@/lib/web-seo';

const SITE = 'Shtëpia.ime';

/**
 * <title> and description for the website (the app's web build). Rendered
 * into each page's static HTML at export time, so search engines and link
 * previews see it without running the app. Nothing on native.
 *
 * `title` omitted gives the site title (the home page).
 */
export function PageHead({ title, description }: { title?: string | null; description?: string | null }) {
  const { t, i18n } = useTranslation();
  const pathname = usePathname();
  if (!IS_WEB) return null;
  const full = title ? `${title} | ${SITE}` : t('seo.siteTitle');
  const text = description || t('seo.siteDescription');
  // Public pages: a canonical address and one link per language, so search
  // engines index every language (hreflang). Signed-in pages get neither.
  // Listing pages are pre-rendered from the "[id]" template, so the build
  // (scripts/expo-web/seo.mjs applyHead) writes their real links instead.
  const links = isPrivatePath(pathname) ? null : languageLinks(SITE_URL, pathname, i18n.language);
  return (
    <Head>
      <title>{full}</title>
      <meta name="description" content={text} />
      <meta property="og:title" content={full} />
      <meta property="og:description" content={text} />
      {links ? <link rel="canonical" href={links.canonical} /> : null}
      {links ? <meta property="og:url" content={links.canonical} /> : null}
      {links?.alternates.map((a) => <link key={a.hreflang} rel="alternate" hrefLang={a.hreflang} href={a.href} />)}
    </Head>
  );
}

// Route (expo-router segments joined by '/') → locale key of its title.
// Listing and agent pages set their own from their data.
const ROUTE_TITLES: Record<string, string> = {
  '(tabs)/explore': 'search.title',
  '(tabs)/profile': 'common.profile',
  favorites: 'common.favorites',
  notifications: 'notifications.title',
  '(tabs)/messages': 'common.messages',
  'messages/[id]': 'common.messages',
  'my-listings': 'listing.myListings',
  'listing/new': 'listing.newListing',
  'listing/create': 'listing.newListing',
  'listing/[id]/edit': 'listing.editListing',
  'listing/[id]/analytics': 'dashboard.title',
  viewings: 'viewings.kicker',
  'saved-searches': 'saved.kicker',
  'agent-dashboard': 'agentDashboard.title',
  privacy: 'legal.privacyPolicy',
  terms: 'legal.termsOfService',
  cookies: 'legal.cookiePolicy',
  guide: 'legal.buyingGuide',
  wanted: 'wanted.homeTitle',
  pricing: 'pricing.title',
  moderation: 'moderation.title',
  '+not-found': 'notFound.title',
};

/** The current route's default title; mounted once in the root layout. */
export function RouteHead() {
  const { t } = useTranslation();
  const segments = useSegments() as string[];
  const key = ROUTE_TITLES[segments.join('/')];
  return <PageHead title={key ? t(key) : null} />;
}
