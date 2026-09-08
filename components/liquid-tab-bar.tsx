// expo-router's <Tabs tabBar={...}> passes its own BottomTabBarProps, not
// @react-navigation/bottom-tabs's — same shape, but the header-options
// branch deep inside `descriptors` types `tintColor` differently
// (ColorValue vs string) between the two packages, so importing from
// @react-navigation/bottom-tabs directly doesn't structurally match what
// Tabs actually provides.
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs/types';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, usePathname, type Href } from 'expo-router';
import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Shadows } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { useUnreadMessages } from '@/hooks/use-unread-messages';

/** The pill's own height and its offset from the bottom edge — exported so
 *  scrollable tab screens can reserve the right amount of space instead of
 *  hardcoding a guess that's wrong on any device whose home-indicator inset
 *  differs from the one it was eyeballed on. */
export const TAB_BAR_HEIGHT = 62;
export const TAB_BAR_BOTTOM_OFFSET = 18;

/** The centre "+" button, and how far it rides above the pill's top edge.
 *  Derived the same way CSS resolves web's `.nav-add`: with `align-items:
 *  center`, a `margin-top: -22px` on a 58px circle inside a 62px row puts the
 *  circle's top 9px proud of the row. */
const NAV_ADD_SIZE = 58;
const NAV_ADD_OVERHANG = Math.ceil((NAV_ADD_SIZE - 22 - TAB_BAR_HEIGHT) / 2 + 22);

/**
 * Total vertical space the floating nav occupies, measured up from the
 * bottom of the screen. Every tab screen's scroll container must reserve at
 * least this much `paddingBottom`, or its last row renders underneath the
 * nav (the pill floats above the content — it doesn't push it up the way a
 * docked tab bar would).
 */
export function useTabBarClearance(extraGap: number = 12) {
  const insets = useSafeAreaInsets();
  return insets.bottom + TAB_BAR_BOTTOM_OFFSET + TAB_BAR_HEIGHT + extraGap;
}

/**
 * Matches web's liquid-nav.css exactly: a floating frosted pill (not a
 * docked full-width bar), Home/Search/Profile as plain icons, an elevated
 * gradient "+" circle in the center going straight to the listing wizard,
 * and a Messages icon with an unread badge — same 5-item layout as
 * src/shared/BottomNav.jsx. Home/Search/Profile are real tabs (state
 * preserved by the underlying Tabs navigator); Create and Messages are
 * stack pushes on top of it, exactly like BottomNav.jsx's own `/new-listing`
 * and `/messages` links aren't separate router "tabs" on web either.
 */
export function LiquidTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const pathname = usePathname();
  const { colors, theme } = useTheme();
  const insets = useSafeAreaInsets();
  const unread = useUnreadMessages();

  const activeRouteName = state.routes[state.index].name;
  // Web's active nav-link color differs by theme (--fho-orange-1 in light,
  // the lighter --fho-orange-soft in dark — see src/styles/liquid-nav.css)
  // instead of the same accent regardless of theme.
  const activeColor = theme === 'dark' ? colors.accentLight : colors.accent;

  const go = (routeName: string) => {
    const isFocused = activeRouteName === routeName;
    const event = navigation.emit({ type: 'tabPress', target: state.routes.find((r) => r.name === routeName)?.key, canPreventDefault: true });
    if (!isFocused && !event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  };

  const iconColor = (active: boolean) => (active ? activeColor : colors.textSecondary);
  // Messages is a stack push outside the Tabs navigator, so it never appears
  // in `state` — web's NavLink highlights it by URL match instead, so this
  // does the same via the actual route pathname.
  const messagesActive = pathname?.startsWith('/messages') ?? false;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + TAB_BAR_BOTTOM_OFFSET }]}>
      <View style={[styles.pill, { borderColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)' }]}>
        {/* The frosting has to be clipped to the pill's rounded shape, but the
            "+" button deliberately overhangs the pill's top edge (web's
            `.nav-add { margin-top: -22px }`). Putting `overflow: hidden` on
            the pill itself clipped the button along with the blur — it
            rendered with a flat top and no shadow. Clipping the background
            layer instead keeps the frosting contained and lets the button
            overhang. */}
        <View style={styles.pillBg} pointerEvents="none">
          <BlurView
            intensity={40}
            tint={theme === 'dark' ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor:
                  theme === 'dark' ? 'rgba(20,18,16,0.55)' : 'rgba(250,246,239,0.55)',
              },
            ]}
          />
        </View>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => go('index')}
          accessibilityLabel={descriptors[state.routes.find((r) => r.name === 'index')!.key]?.options.title}>
          <Feather name="home" size={22} strokeWidth={1.8} color={iconColor(activeRouteName === 'index')} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => go('explore')}
          accessibilityLabel={descriptors[state.routes.find((r) => r.name === 'explore')!.key]?.options.title}>
          <Feather name="search" size={22} strokeWidth={1.8} color={iconColor(activeRouteName === 'explore')} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navAdd}
          activeOpacity={0.85}
          // The wizard, not the single-scroll form — `listing/create` stays
          // reachable by route while the wizard is being verified against real
          // submissions, but this is the entry point users actually take.
          onPress={() => router.push('/listing/new' as Href)}
          accessibilityLabel={t('listing.newListing')}>
          <LinearGradient
            // Matches web's --fho-orange-1 → --fho-orange-2 gradient exactly
            // (src/styles/theme.css); RN's palette only exposes the first stop.
            colors={[colors.accent, colors.accentEnd]}
            style={styles.navAddGradient}>
            <Feather name="plus" size={26} strokeWidth={2.5} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => router.push('/messages' as Href)}
          accessibilityLabel={t('common.messages')}>
          <Feather name="message-circle" size={22} strokeWidth={1.8} color={iconColor(messagesActive)} />
          {unread > 0 && (
            <View style={[styles.navBadge, { backgroundColor: colors.accent }]}>
              <Text style={styles.navBadgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => go('profile')}
          accessibilityLabel={descriptors[state.routes.find((r) => r.name === 'profile')!.key]?.options.title}>
          <Feather name="user" size={22} strokeWidth={1.8} color={iconColor(activeRouteName === 'profile')} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    // Reserves the strip the "+" overhangs into. Without it the button is
    // painted outside the wrapper's layout bounds, and Android drops touches
    // that land outside a parent's bounds — the top of the circle looked
    // tappable but wasn't. `pointerEvents="box-none"` keeps this padding from
    // swallowing taps meant for the screen behind it.
    paddingTop: NAV_ADD_OVERHANG,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 448,
    height: TAB_BAR_HEIGHT,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    ...Shadows.nav,
  },
  pillBg: {
    ...StyleSheet.absoluteFill,
    borderRadius: 999,
    overflow: 'hidden',
  },
  navItem: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navAdd: {
    width: NAV_ADD_SIZE,
    height: NAV_ADD_SIZE,
    borderRadius: NAV_ADD_SIZE / 2,
    // Web's `.nav-add { margin-top: -22px }`. Yoga applies the same margin-box
    // centring CSS does, so the circle lands in the same place.
    marginTop: -22,
    // Android draws by elevation, not paint order — at the pill's own
    // elevation the button disappeared behind the pill's background.
    zIndex: 1,
    ...Shadows.cta,
    elevation: 14,
  },
  navAddGradient: {
    flex: 1,
    borderRadius: NAV_ADD_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  navBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
});
