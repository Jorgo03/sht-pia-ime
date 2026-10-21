import Head from 'expo-router/head';
import { useSegments } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { IS_WEB } from '@/constants/web-frame';

const SITE = 'Shtëpia.ime';

/**
 * <title> and description for the website (the app's web build). Rendered
 * into each page's static HTML at export time, so search engines and link
 * previews see it without running the app. Nothing on native.
 *
 * `title` omitted gives the site title (the home page).
 */
export function PageHead({ title, description }: { title?: string | null; description?: string | null }) {
  const { t } = useTranslation();
  if (!IS_WEB) return null;
  const full = title ? `${title} | ${SITE}` : t('seo.siteTitle');
  const text = description || t('seo.siteDescription');
  return (
    <Head>
      <title>{full}</title>
      <meta name="description" content={text} />
      <meta property="og:title" content={full} />
      <meta property="og:description" content={text} />
    </Head>
  );
}

// Route (expo-router segments joined by '/') → locale key of its title.
// Listing and agent pages set their own from their data.
const ROUTE_TITLES: Record<string, string> = {
  '(tabs)/explore': 'search.title',
  '(tabs)/profile': 'common.profile',
  favorites: 'common.favorites',
  messages: 'common.messages',
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
