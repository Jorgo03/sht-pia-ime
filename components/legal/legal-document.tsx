import { Link, useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { AppHeader } from '@/components/ui/app-header';
import { GradientBackground } from '@/components/ui/gradient-background';
import { type AtticoPalette, Fonts } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { LEGAL_CONTACT_EMAIL } from '@/lib/legal';
import * as en from '@/src/features/legal/content/en';
import * as sq from '@/src/features/legal/content/sq';
import type { LegalContact, LegalSection } from '@/src/features/legal/content/types';
import { useReadableColumn } from '@/hooks/use-responsive';

type Doc = 'privacy' | 'terms';

const TITLE_KEYS: Record<Doc, string> = { privacy: 'legal.privacyPolicy', terms: 'legal.termsOfService' };

// The same documents the website showed (src/features/legal/content):
// Albanian is the governing text and English its translation; every other
// language reads the English one with a note saying so.
//
// The date is numeric (14.10.2026) in every language: these pages are
// pre-rendered in Node, which has Albanian month names, while many browsers
// do not, and a date that renders differently in the two breaks hydration.
function formatUpdated(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function LegalDocument({ doc }: { doc: Doc }) {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  // A centred column on an unfolded Fold or a spanned Duo (hooks/use-responsive).
  const readable = useReadableColumn();
  const lang = (i18n.resolvedLanguage || i18n.language || 'sq').slice(0, 2);
  const content = lang === 'sq' ? sq : en;
  const body = content[doc];
  const other: Doc = doc === 'privacy' ? 'terms' : 'privacy';

  return (
    <GradientBackground>
      <SafeAreaView style={[styles.container, readable]} edges={['top']}>
        <AppHeader onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title} accessibilityRole="header">{t(TITLE_KEYS[doc])}</Text>
          <Text style={styles.updated}>{t('legal.lastUpdated', { date: formatUpdated(content.UPDATED) })}</Text>
          {lang !== 'sq' && lang !== 'en' && <Text style={styles.note}>{t('legal.languageNote')}</Text>}
          {body.intro.map((text, i) => (
            <Text key={i} style={styles.intro}>{text}</Text>
          ))}
          {body.sections.map((section) => (
            <Section key={section.h} section={section} contact={content.contact} styles={styles} />
          ))}
          <View style={styles.footer}>
            <Link href={`/${other}` as Href} style={styles.link}>{t(TITLE_KEYS[other])}</Link>
          </View>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

function Section({ section, contact, styles }: { section: LegalSection; contact: LegalContact; styles: Styles }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{section.h}</Text>
      {section.p?.map((text, i) => <Text key={`p${i}`} style={styles.paragraph}>{text}</Text>)}
      {section.ul?.map((text, i) => (
        <View key={`li${i}`} style={styles.bulletRow}>
          <Text style={styles.paragraph}>•</Text>
          <Text style={[styles.paragraph, styles.bulletText]}>{text}</Text>
        </View>
      ))}
      {section.p2?.map((text, i) => <Text key={`q${i}`} style={styles.paragraph}>{text}</Text>)}
      {section.contact &&
        (LEGAL_CONTACT_EMAIL ? (
          <Text style={styles.paragraph}>
            {contact.withEmail}
            {/* The address is plain, selectable text too: a mailto link does
                nothing on a device with no mail app. */}
            <Text style={styles.link} selectable onPress={() => Linking.openURL(`mailto:${LEGAL_CONTACT_EMAIL}`)}>
              {LEGAL_CONTACT_EMAIL}
            </Text>
          </Text>
        ) : (
          <Text style={styles.paragraph}>{contact.withoutEmail}</Text>
        ))}
    </View>
  );
}

type Styles = ReturnType<typeof createStyles>;

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48, gap: 14 },
  title: { fontFamily: Fonts?.serif, fontSize: 28, fontWeight: '500', color: colors.textPrimary },
  updated: { fontFamily: Fonts?.sans, fontSize: 13, color: colors.textFaint },
  note: {
    fontFamily: Fonts?.sans,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  intro: { fontFamily: Fonts?.sans, fontSize: 15, lineHeight: 23, color: colors.textPrimary },
  section: { gap: 8, marginTop: 10 },
  sectionTitle: { fontFamily: Fonts?.serif, fontSize: 18, fontWeight: '500', color: colors.textPrimary },
  paragraph: { fontFamily: Fonts?.sans, fontSize: 15, lineHeight: 23, color: colors.textSecondary },
  bulletRow: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  bulletText: { flex: 1 },
  footer: { marginTop: 18, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  link: { fontFamily: Fonts?.sans, fontSize: 15, color: colors.accentText, textDecorationLine: 'underline' },
});
