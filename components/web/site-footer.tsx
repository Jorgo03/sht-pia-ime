import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Fonts } from '@/constants/theme';
import { IS_WEB } from '@/constants/web-frame';
import { useTheme } from '@/contexts/theme-context';
import { useAppDimensions } from '@/hooks/use-app-dimensions';
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal';

const COLUMNS: { title: string; links: { href: string; key: string }[] }[] = [
  {
    title: 'site.footer.explore',
    links: [
      { href: '/', key: 'common.home' },
      { href: '/explore', key: 'site.nav.search' },
      { href: '/wanted', key: 'wanted.homeTitle' },
      { href: '/agents', key: 'site.nav.agencies' },
      { href: '/compare', key: 'compare.add' },
    ],
  },
  {
    title: 'site.footer.sell',
    links: [
      { href: '/listing/new', key: 'site.listHome' },
      { href: '/pricing', key: 'pricing.title' },
      { href: '/guide', key: 'legal.buyingGuide' },
    ],
  },
  {
    title: 'site.footer.legal',
    links: [
      { href: '/privacy', key: 'legal.privacyPolicy' },
      { href: '/terms', key: 'legal.termsOfService' },
      { href: '/cookies', key: 'legal.cookiePolicy' },
    ],
  },
];

// The brand symbol (assets/brand/symbol-orange.svg), drawn large at the
// footer's corner as the reference site draws its own mark.
const SYMBOL =
  'M50,231V99A78,78 0 0 1 206,99V231H184V99A56,56 0 0 0 72,99V231ZM126.00,101.67A4,4 0 0 1 128.46,97.97L168.46,81.31A4,4 0 0 1 174.00,85.00L174.00,227.00A4,4 0 0 1 170.00,231.00L130.00,231.00A4,4 0 0 1 126.00,227.00ZM131,163a10,10 0 1 0 20,0a10,10 0 1 0 -20,0Z';

const INK = '#000000';
const ON_INK = '#fbfbfb';
const ON_INK_SOFT = 'rgba(251,251,251,0.6)';

/**
 * The website's footer (DECISIONS.md W5, W9): black, after the reference site.
 * A large headline and the main call to action on the left, link columns and
 * contact on the right, the brand symbol large in the corner, and the small
 * print. Drawn edge to edge under each public page. Nothing on the phone
 * apps, which have their own navigation.
 */
export function SiteFooter() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useAppDimensions();
  if (!IS_WEB) return null;
  const stacked = width < 900;
  const phone = width < 600;
  const go = (href: string) => router.push(href as Href);

  return (
    <View style={styles.footer} accessibilityRole="contentinfo">
      <View style={styles.inner}>
        <View style={[styles.top, stacked && styles.topStacked]}>
          <View style={styles.lead}>
            {/* Not the closing band's question again: the site's own line. */}
            <Text style={[styles.headline, phone && styles.headlinePhone]}>{t('site.footer.tagline')}</Text>
            <View style={styles.ctaRow}>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t('site.listHome')}
                onPress={() => go('/listing/new')}
                style={({ pressed }) => [styles.pill, { backgroundColor: colors.accentEnd }, pressed && styles.pressed]}>
                <Text style={styles.pillText}>{t('site.listHome').toUpperCase()}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel={t('site.cta.search')}
                onPress={() => go('/explore')}
                style={({ pressed }) => [styles.round, { backgroundColor: colors.accentEnd }, pressed && styles.pressed]}>
                <MaterialIcons name="arrow-forward" size={20} color="#fff" />
              </Pressable>
            </View>
          </View>
          <View style={[styles.columns, phone && styles.columnsPhone]}>
            {COLUMNS.map((col) => (
              <View key={col.title} style={[styles.col, phone && styles.colPhone]}>
                <Text style={styles.colTitle}>{t(col.title).toUpperCase()}</Text>
                {col.links.map((l) => (
                  <Pressable key={l.href} accessibilityRole="link" onPress={() => go(l.href)} style={styles.linkHit}>
                    <Text style={styles.link}>{t(l.key)}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
            {LEGAL_CONTACT_EMAIL ? (
              <View style={[styles.col, phone && styles.colPhone]}>
                <Text style={styles.colTitle}>{t('site.footer.contact').toUpperCase()}</Text>
                <Text style={styles.link} selectable>{LEGAL_CONTACT_EMAIL}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={[styles.bottom, stacked && styles.bottomStacked]}>
          <Svg width={phone ? 140 : 220} height={phone ? 140 : 220} viewBox="0 0 256 256" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Path d={SYMBOL} fill={colors.accentEnd} fillRule="evenodd" />
          </Svg>
          <Text style={styles.small}>{t('site.footer.copyright', { year: new Date().getFullYear() })}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { width: '100%', backgroundColor: INK, paddingTop: 88, paddingBottom: 32, marginTop: 0 },
  inner: { width: '100%', maxWidth: 1280, alignSelf: 'center', paddingHorizontal: 24, gap: 56 },
  top: { flexDirection: 'row', gap: 48 },
  topStacked: { flexDirection: 'column' },
  lead: { flex: 1, gap: 18, minWidth: 260 },
  headline: { fontFamily: Fonts.sans, fontSize: 56, lineHeight: 58, letterSpacing: -1.7, color: ON_INK, maxWidth: 560 },
  headlinePhone: { fontFamily: Fonts.sans, fontSize: 38, lineHeight: 41, letterSpacing: -1 },
  tagline: { fontFamily: Fonts.sans, fontSize: 16, lineHeight: 24, color: ON_INK_SOFT, maxWidth: 420 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  pill: { minHeight: 46, paddingHorizontal: 22, borderRadius: 40, justifyContent: 'center' },
  pillText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, letterSpacing: 0.5, color: '#fff' },
  round: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.85 },
  columns: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 40 },
  columnsPhone: { gap: 28 },
  col: { minWidth: 150, gap: 4 },
  colPhone: { minWidth: 130 },
  colTitle: { fontFamily: Fonts.sansMedium, fontSize: 12, letterSpacing: 1.2, color: ON_INK_SOFT, marginBottom: 8 },
  linkHit: { minHeight: 30, justifyContent: 'center' },
  link: { fontFamily: Fonts.sans, fontSize: 15, color: ON_INK },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24 },
  bottomStacked: { flexDirection: 'column', alignItems: 'flex-start' },
  small: { fontFamily: Fonts.sans, fontSize: 12, color: ON_INK_SOFT },
});
