import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { AppHeader, LanguageOptions } from '@/components/ui/app-header';
import { ThemeToggleButton } from '@/components/ui/theme-toggle-button';
import { Fonts, type AtticoPalette } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { useHydrated } from '@/hooks/use-hydrated';
import { useUnreadMessages } from '@/hooks/use-unread-messages';

/** The website's menu, in order. */
export const SITE_LINKS: { href: string; key: string }[] = [
  { href: '/', key: 'common.home' },
  { href: '/explore', key: 'site.nav.search' },
  { href: '/wanted', key: 'wanted.homeTitle' },
  { href: '/agents', key: 'site.nav.agencies' },
  { href: '/guide', key: 'legal.buyingGuide' },
];

/** Below this browser width the links fold into a menu button. */
const FULL_MENU_MIN_WIDTH = 980;

/**
 * The website's header (DECISIONS.md W5): a classic site header across the
 * whole browser, on every page, in place of the phone app's bottom tab bar.
 * Brand on the left; the menu; then language/currency, notifications and
 * theme (the app header's own controls), "List your home" and the account.
 * Web only: mounted by the root layout's web frame.
 */
export function SiteHeader() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  // The pre-rendered page has no width: it draws the full menu, and the
  // browser folds it after the first draw if the window is narrow.
  const hydrated = useHydrated();
  const wide = !hydrated || width >= FULL_MENU_MIN_WIDTH;
  // A phone: logo, notifications and the menu button only; everything else
  // (list your home, messages, account, language and currency, theme) is in
  // the menu, so the bar fits a 280px foldable cover screen.
  const narrow = hydrated && width < 640;
  const [menuOpen, setMenuOpen] = useState(false);
  const unread = useUnreadMessages();

  const go = (href: string) => {
    setMenuOpen(false);
    router.push(href as Href);
  };
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  const account = (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={user ? t('common.profile') : t('common.signIn')}
      onPress={() => go('/profile')}
      style={({ pressed }) => [styles.account, pressed && styles.pressed]}>
      <MaterialIcons name={user ? 'account-circle' : 'login'} size={20} color={colors.textPrimary} />
      {wide && <Text style={styles.accountText}>{user ? t('common.profile') : t('common.signIn')}</Text>}
    </Pressable>
  );

  const listCta = (
    <Pressable accessibilityRole="link" accessibilityLabel={t('site.listHome')} onPress={() => go('/listing/new')} style={({ pressed }) => [styles.cta, pressed && styles.pressed]}>
      <LinearGradient colors={[colors.accent, colors.accentEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <MaterialIcons name="add" size={18} color="#fff" />
      {wide && <Text style={styles.ctaText}>{t('site.listHome')}</Text>}
    </Pressable>
  );

  const trailing = (
    <View style={styles.trailing}>
      {wide && (
        <View style={styles.links} accessibilityRole="navigation">
          {SITE_LINKS.map((l) => (
            <Pressable key={l.href} accessibilityRole="link" onPress={() => go(l.href)} style={styles.link}>
              <Text style={[styles.linkText, isActive(l.href) && styles.linkActive]}>{t(l.key)}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {user && !narrow && (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('common.messages')}
          onPress={() => go('/messages')}
          style={styles.iconBtn}>
          <MaterialIcons name="chat-bubble-outline" size={20} color={colors.textPrimary} />
          {unread > 0 && <View style={styles.dot} />}
        </Pressable>
      )}
      {!narrow && listCta}
      {!narrow && account}
      {!wide && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('site.menu')}
          accessibilityState={{ expanded: menuOpen }}
          onPress={() => setMenuOpen(true)}
          style={styles.iconBtn}>
          <MaterialIcons name="menu" size={24} color={colors.textPrimary} />
        </Pressable>
      )}
    </View>
  );

  return (
    <View style={styles.bar}>
      <AppHeader site compact={narrow} trailing={trailing} />
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)}>
          <ScrollView style={styles.menu} contentContainerStyle={styles.menuContent} accessibilityRole="menu">
            {narrow && (
              <>
                <Pressable accessibilityRole="menuitem" onPress={() => go('/listing/new')} style={styles.menuItem}>
                  <Text style={[styles.menuText, styles.linkActive]}>{t('site.listHome')}</Text>
                </Pressable>
                {user && (
                  <Pressable accessibilityRole="menuitem" onPress={() => go('/messages')} style={styles.menuItem}>
                    <Text style={styles.menuText}>{t('common.messages')}</Text>
                  </Pressable>
                )}
                <Pressable accessibilityRole="menuitem" onPress={() => go('/profile')} style={styles.menuItem}>
                  <Text style={styles.menuText}>{user ? t('common.profile') : t('common.signIn')}</Text>
                </Pressable>
              </>
            )}
            {SITE_LINKS.map((l) => (
              <Pressable key={l.href} accessibilityRole="menuitem" onPress={() => go(l.href)} style={styles.menuItem}>
                <Text style={[styles.menuText, isActive(l.href) && styles.linkActive]}>{t(l.key)}</Text>
              </Pressable>
            ))}
            {narrow && (
              <>
                <View style={styles.menuDivider} />
                <Text style={styles.menuLabel}>{t('common.language')}</Text>
                <LanguageOptions onChosen={() => setMenuOpen(false)} />
                <View style={styles.menuItem}>
                  <ThemeToggleButton style={styles.iconBtn} iconColor={colors.textPrimary} />
                </View>
              </>
            )}
          </ScrollView>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    bar: { width: '100%', zIndex: 10 },
    trailing: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 8 },
    links: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8 },
    link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
    linkText: { fontFamily: Fonts.sansMedium, fontSize: 15, color: colors.textSecondary },
    linkActive: { color: colors.accentText, fontFamily: Fonts.sansSemiBold },
    iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
    dot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
    cta: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      borderRadius: 20,
      overflow: 'hidden',
    },
    ctaText: { fontFamily: Fonts.sansBold, fontSize: 14, color: '#fff' },
    account: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    accountText: { fontFamily: Fonts.sansSemiBold, fontSize: 14, color: colors.textPrimary },
    pressed: { opacity: 0.8 },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', alignItems: 'flex-end', paddingTop: 70, paddingRight: 16 },
    menu: { minWidth: 240, maxHeight: '85%', flexGrow: 0, borderRadius: 16, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    menuContent: { padding: 6 },
    menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 6 },
    menuLabel: { fontFamily: Fonts.sansSemiBold, fontSize: 12, color: colors.textSecondary, paddingHorizontal: 16, paddingVertical: 6 },
    menuItem: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16 },
    menuText: { fontFamily: Fonts.sansMedium, fontSize: 16, color: colors.textPrimary },
  });
