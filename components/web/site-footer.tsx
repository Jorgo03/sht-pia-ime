import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, type AtticoPalette } from '@/constants/theme';
import { IS_WEB } from '@/constants/web-frame';
import { useTheme } from '@/contexts/theme-context';
import { useAppDimensions } from '@/hooks/use-app-dimensions';
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal';

const COLUMNS: { title: string; links: { href: string; key: string }[] }[] = [
  {
    title: 'site.footer.explore',
    links: [
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

/**
 * The website's footer (DECISIONS.md W5), at the end of each public page's
 * scroll: brand line, link columns and the legal small print. Nothing on the
 * phone apps, which have their own navigation.
 */
export function SiteFooter() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useAppDimensions();
  if (!IS_WEB) return null;
  const stacked = width < 720;

  return (
    <View style={styles.footer} accessibilityRole="contentinfo">
      <View style={[styles.top, stacked && styles.topStacked]}>
        <View style={styles.brandCol}>
          <Text style={styles.brand}>
            Shtëpia<Text style={styles.brandIme}>.ime</Text>
          </Text>
          <Text style={styles.tagline}>{t('site.footer.tagline')}</Text>
          {LEGAL_CONTACT_EMAIL ? <Text style={styles.small} selectable>{LEGAL_CONTACT_EMAIL}</Text> : null}
        </View>
        {COLUMNS.map((col) => (
          <View key={col.title} style={styles.col}>
            <Text style={styles.colTitle}>{t(col.title)}</Text>
            {col.links.map((l) => (
              <Pressable key={l.href} accessibilityRole="link" onPress={() => router.push(l.href as Href)} style={styles.linkHit}>
                <Text style={styles.link}>{t(l.key)}</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </View>
      <Text style={styles.small}>{t('site.footer.copyright', { year: new Date().getFullYear() })}</Text>
    </View>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    footer: { marginTop: 48, paddingTop: 32, paddingBottom: 24, gap: 24, borderTopWidth: 1, borderTopColor: colors.border },
    top: { flexDirection: 'row', gap: 32, flexWrap: 'wrap' },
    topStacked: { flexDirection: 'column', gap: 20 },
    brandCol: { flex: 2, minWidth: 220, gap: 8 },
    brand: { fontFamily: Fonts.serifSemiBold, fontSize: 24, color: colors.accentText },
    brandIme: { fontFamily: Fonts.serif },
    tagline: { fontFamily: Fonts.sans, fontSize: 14, lineHeight: 21, color: colors.textSecondary, maxWidth: 320 },
    col: { flex: 1, minWidth: 150, gap: 2 },
    colTitle: { fontFamily: Fonts.sansBold, fontSize: 13, letterSpacing: 0.5, color: colors.textPrimary, marginBottom: 6, textTransform: 'uppercase' },
    linkHit: { minHeight: 32, justifyContent: 'center' },
    link: { fontFamily: Fonts.sans, fontSize: 14, color: colors.textSecondary },
    small: { fontFamily: Fonts.sans, fontSize: 12, color: colors.textFaint },
  });
