import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { usePathname, useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';

import { AppHeader, LanguageOptions } from '@/components/ui/app-header';
import { ThemeToggleButton } from '@/components/ui/theme-toggle-button';
import { Fonts, Site, siteGutter, type AtticoPalette } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { useHydrated } from '@/hooks/use-hydrated';
import { useUnreadMessages } from '@/hooks/use-unread-messages';
import { getOverHero, subscribeOverHero } from '@/lib/web/hero-state';

/** react-native-web adds hovered/focused to a Pressable's state; RN's types do not. */
type WebState = PressableStateCallbackType & { hovered?: boolean; focused?: boolean };
const states = (fn: (s: WebState) => StyleProp<ViewStyle>) => (s: PressableStateCallbackType) => fn(s as WebState);

/** The website's menu, in order. */
export const SITE_LINKS: { href: string; key: string }[] = [
  { href: '/', key: 'common.home' },
  { href: '/explore', key: 'site.nav.search' },
  { href: '/wanted', key: 'wanted.homeTitle' },
  { href: '/agents', key: 'site.nav.agencies' },
  { href: '/guide', key: 'legal.buyingGuide' },
];

/** Below this browser width the links fold into a menu button. */
const FULL_MENU_MIN_WIDTH = 1140;

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
  const gutter = hydrated ? siteGutter(width) : siteGutter(1440);
  // The phone menu is a drawer from the right (the reference's pattern):
  // 300 ms ease-out, or no movement at all with reduced motion.
  const [slide] = useState(() => new Animated.Value(0));
  const [drawerShown, setDrawerShown] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (menuOpen) setDrawerShown(true);
      Animated.timing(slide, {
        toValue: menuOpen ? 1 : 0,
        duration: reduce ? 0 : Site.motion.base,
        easing: Easing.bezier(...Site.motion.ease),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished && !menuOpen && !cancelled) setDrawerShown(false);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [menuOpen, slide]);
  const unread = useUnreadMessages();
  // Home's full-screen hero: transparent bar, white text, until scrolled past.
  const overHero = useSyncExternalStore(subscribeOverHero, getOverHero, () => true);
  const overlay = pathname === '/' && overHero;
  // A dark bar on every page (owner's reference, 2026-11-17): white text,
  // the current page in orange. Over Home's photo it stays see-through.
  const ink = '#fff';

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
      style={states(({ pressed, hovered, focused }) => [styles.account, hovered && styles.accountHover, focused && styles.focusRing, pressed && styles.pressed])}>
      <MaterialIcons name={user ? 'account-circle' : 'login'} size={20} color={ink} />
      {wide && <Text style={[styles.accountText, { color: ink }]}>{user ? t('common.profile') : t('common.signIn')}</Text>}
    </Pressable>
  );

  const listCta = (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t('site.listHome')}
      onPress={() => go('/listing/new')}
      style={states(({ pressed, hovered, focused }) => [styles.cta, hovered && styles.ctaHover, focused && styles.focusRing, pressed && styles.pressed])}>
      {/* Dark text on the orange: 6.25:1 (white was 3.5:1). */}
      {!wide && <MaterialIcons name="add" size={18} color={Site.onAccent} />}
      {wide && <Text style={styles.ctaText}>{t('site.listHome')}</Text>}
    </Pressable>
  );

  const trailing = (
    <View style={styles.trailing}>
      {wide && (
        <View style={styles.links} accessibilityRole="navigation">
          {SITE_LINKS.map((l) => {
            const active = isActive(l.href);
            return (
              <Pressable
                key={l.href}
                accessibilityRole="link"
                accessibilityLabel={t(l.key)}
                accessibilityState={{ selected: active }}
                {...(active ? ({ 'aria-current': 'page' } as object) : {})}
                onPress={() => go(l.href)}
                style={states(({ focused }) => [styles.link, focused && styles.focusRing])}>
                {(st: PressableStateCallbackType) => (
                  <Text style={[styles.linkText, (active || (st as WebState).hovered) && styles.linkTextOn]}>{t(l.key)}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
      {user && !narrow && (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t('common.messages')}
          onPress={() => go('/messages')}
          style={states(({ hovered, focused }) => [styles.iconBtn, hovered && styles.iconHover, focused && styles.focusRing])}>
          <MaterialIcons name="chat-bubble-outline" size={20} color={ink} />
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
          style={states(({ hovered, focused }) => [styles.iconBtn, hovered && styles.iconHover, focused && styles.focusRing])}>
          <MaterialIcons name="menu" size={26} color={ink} />
        </Pressable>
      )}
    </View>
  );

  return (
    // testID once hydrated: the final layout is drawn (tests wait for it).
    <View style={[styles.bar, overlay ? styles.barOverlay : styles.barDark]} testID={hydrated ? 'site-header' : undefined}>
      <AppHeader
        site
        floating={overlay}
        onDark
        compact={narrow}
        trailing={trailing}
        gutter={gutter}
        height={hydrated && width < 1024 ? Site.headerHeightCompact : Site.headerHeight}
      />
      <Modal visible={drawerShown} transparent animationType="none" onRequestClose={() => setMenuOpen(false)}>
        <Animated.View style={[styles.backdrop, { opacity: slide }]}>
          <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => setMenuOpen(false)} />
        </Animated.View>
        <Animated.View
          style={[styles.drawer, { transform: [{ translateX: slide.interpolate({ inputRange: [0, 1], outputRange: [360, 0] }) }] }]}
          accessibilityViewIsModal>
          <View style={styles.drawerHead}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={() => setMenuOpen(false)}
              {...({ autoFocus: true } as object)}
              style={states(({ hovered, focused }) => [styles.iconBtn, hovered && styles.iconHover, focused && styles.focusRing])}>
              <MaterialIcons name="close" size={26} color={Site.onInk} />
            </Pressable>
          </View>
          <ScrollView style={styles.menu} contentContainerStyle={styles.menuContent} accessibilityRole="menu">
            {narrow && (
              <>
                <Pressable accessibilityRole="menuitem" onPress={() => go('/listing/new')} style={states(({ hovered, focused }) => [styles.menuItem, hovered && styles.menuItemHover, focused && styles.focusRing])}>
                  <Text style={[styles.menuText, styles.linkActive]}>{t('site.listHome')}</Text>
                </Pressable>
                {user && (
                  <Pressable accessibilityRole="menuitem" onPress={() => go('/messages')} style={states(({ hovered, focused }) => [styles.menuItem, hovered && styles.menuItemHover, focused && styles.focusRing])}>
                    <Text style={styles.menuText}>{t('common.messages')}</Text>
                  </Pressable>
                )}
                <Pressable accessibilityRole="menuitem" onPress={() => go('/profile')} style={states(({ hovered, focused }) => [styles.menuItem, hovered && styles.menuItemHover, focused && styles.focusRing])}>
                  <Text style={styles.menuText}>{user ? t('common.profile') : t('common.signIn')}</Text>
                </Pressable>
              </>
            )}
            {SITE_LINKS.map((l) => (
              <Pressable key={l.href} accessibilityRole="menuitem" onPress={() => go(l.href)} style={states(({ hovered, focused }) => [styles.menuItem, hovered && styles.menuItemHover, focused && styles.focusRing])}>
                <Text style={[styles.menuText, isActive(l.href) && styles.linkActive]}>{t(l.key)}</Text>
              </Pressable>
            ))}
            {narrow && (
              <>
                <View style={styles.menuDivider} />
                <Text style={styles.menuLabel}>{t('common.language')}</Text>
                <LanguageOptions onChosen={() => setMenuOpen(false)} />
                <View style={styles.menuItem}>
                  <ThemeToggleButton style={styles.iconBtn} iconColor={Site.onInk} />
                </View>
              </>
            )}
          </ScrollView>
        </Animated.View>
      </Modal>
    </View>
  );
}

const focusRing = { outlineStyle: 'solid', outlineWidth: 2, outlineColor: '#ff6b00', outlineOffset: 2 } as object;

// Every number from the website tokens (constants/theme Site), measured from
// the owner's reference: plain links 28px apart, square-ish controls, a dark
// drawer behind a 60% overlay. Focus: the orange ring, 7.4:1 on the black bar.
const createStyles = (colors: AtticoPalette) =>
  StyleSheet.create({
    bar: { width: '100%', zIndex: 10 },
    // Over Home's hero: no bar, the photo shows through (a soft shade keeps
    // the white text readable on a light photo).
    barOverlay: { backgroundColor: 'rgba(0,0,0,0.18)' },
    barDark: { backgroundColor: Site.ink },
    trailing: { flexDirection: 'row', alignItems: 'center', gap: Site.space.sm, marginLeft: Site.space.sm },
    links: { flexDirection: 'row', alignItems: 'center', gap: Site.nav.gap, marginRight: Site.space.xl },
    link: { minHeight: 44, justifyContent: 'center', borderRadius: Site.radius.sm },
    linkText: { fontFamily: Fonts.sansMedium, fontSize: Site.nav.fontSize, lineHeight: Site.nav.lineHeight, color: Site.onInk },
    // Current page and hover: the brand orange, 7.4:1 on the black bar.
    linkTextOn: { color: colors.accent },
    focusRing,
    iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: Site.radius.sm },
    iconHover: { backgroundColor: 'rgba(255,255,255,0.10)' },
    dot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
    cta: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Site.space.sm,
      paddingHorizontal: Site.control.paddingX,
      borderRadius: Site.control.radius,
      backgroundColor: colors.accent,
    },
    ctaHover: { backgroundColor: colors.accentLight },
    ctaText: { fontFamily: Fonts.sansBold, fontSize: 15, color: Site.onAccent },
    account: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Site.space.sm,
      paddingHorizontal: Site.space.md,
      borderRadius: Site.control.radius,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.4)',
    },
    accountHover: { borderColor: Site.onInk, backgroundColor: 'rgba(255,255,255,0.08)' },
    accountText: { fontFamily: Fonts.sansSemiBold, fontSize: 15, color: Site.onInk },
    pressed: { opacity: 0.8 },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: Site.overlay },
    drawer: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: 360,
      maxWidth: '88%',
      backgroundColor: Site.ink,
      paddingTop: Site.space.md,
    },
    drawerHead: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: Site.space.md, paddingBottom: Site.space.sm },
    menu: { flex: 1 },
    menuContent: { paddingHorizontal: Site.space.xl, paddingBottom: Site.space['3xl'] },
    menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: Site.space.lg },
    menuLabel: { fontFamily: Fonts.sansSemiBold, fontSize: 13, letterSpacing: 0.6, color: Site.onInkMuted, paddingVertical: Site.space.sm },
    menuItem: { minHeight: 52, justifyContent: 'center', borderRadius: Site.radius.sm },
    menuItemHover: { backgroundColor: 'rgba(255,255,255,0.06)' },
    menuText: { fontFamily: Fonts.sansMedium, fontSize: 18, lineHeight: 24, color: Site.onInk },
    linkActive: { color: colors.accent, fontFamily: Fonts.sansBold },
  });
