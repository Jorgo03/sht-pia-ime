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
import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
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

/** The glass lens that sits behind the active tab and glides between tabs. */
const LENS_WIDTH = 54;
const LENS_HEIGHT = 46;
/** A soft spring: arrives quickly, overshoots a touch, settles without wobble. */
const LENS_SPRING = { damping: 20, stiffness: 200, mass: 0.9 };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type TabKey = 'index' | 'explore' | 'messages' | 'profile';
type FeatherName = ComponentProps<typeof Feather>['name'];

/**
 * One tab icon. Grows and lifts slightly while active and springs on press;
 * with Reduce Motion on it only changes colour.
 */
function NavItem({
  icon,
  active,
  color,
  label,
  onPress,
  onLayout,
  children,
}: {
  icon: FeatherName;
  active: boolean;
  color: string;
  label?: string;
  onPress: () => void;
  onLayout: (e: LayoutChangeEvent) => void;
  children?: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const lift = useSharedValue(active ? 1 : 0);
  const press = useSharedValue(1);

  useEffect(() => {
    lift.set(reduceMotion ? (active ? 1 : 0) : withSpring(active ? 1 : 0, LENS_SPRING));
  }, [active, reduceMotion, lift]);

  const iconStyle = useAnimatedStyle(() =>
    reduceMotion
      ? {}
      : {
          transform: [
            { translateY: -1.5 * lift.value },
            { scale: (1 + 0.1 * lift.value) * press.value },
          ],
        },
  );

  return (
    <Pressable
      style={styles.navItem}
      onLayout={onLayout}
      onPressIn={() => {
        if (!reduceMotion) press.set(withTiming(0.84, { duration: 90 }));
      }}
      onPressOut={() => {
        if (!reduceMotion) press.set(withSpring(1, { damping: 10, stiffness: 300 }));
      }}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}>
      <Animated.View style={iconStyle}>
        <Feather name={icon} size={22} strokeWidth={1.8} color={color} />
      </Animated.View>
      {children}
    </Pressable>
  );
}

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
  const activeKey: TabKey = messagesActive ? 'messages' : (activeRouteName as TabKey);

  // Where each tab sits inside the pill, measured on layout, so the lens can
  // travel to it whatever the screen width.
  const [slots, setSlots] = useState<Partial<Record<TabKey, { x: number; width: number }>>>({});
  const measure = (key: TabKey) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setSlots((prev) => (prev[key]?.x === x && prev[key]?.width === width ? prev : { ...prev, [key]: { x, width } }));
  };

  const reduceMotion = useReducedMotion();
  const lensX = useSharedValue(0);
  const lensStretch = useSharedValue(1);
  const lensVisible = useSharedValue(0);
  const target = slots[activeKey];

  useEffect(() => {
    if (!target) return;
    const x = target.x + target.width / 2 - LENS_WIDTH / 2;
    if (lensVisible.get() === 0 || reduceMotion) {
      // First placement, or Reduce Motion: no glide, no stretch.
      lensX.set(x);
      lensVisible.set(reduceMotion ? 1 : withTiming(1, { duration: 220 }));
      return;
    }
    // Liquid: stretch in proportion to the distance, glide, then settle round.
    const distance = Math.abs(x - lensX.get());
    lensStretch.set(withSequence(
      withTiming(1 + Math.min(distance / 220, 0.55), { duration: 140 }),
      withSpring(1, LENS_SPRING),
    ));
    lensX.set(withSpring(x, LENS_SPRING));
  }, [target, reduceMotion, lensX, lensStretch, lensVisible]);

  const lensStyle = useAnimatedStyle(() => ({
    opacity: lensVisible.value,
    transform: [
      { translateX: lensX.value },
      { scaleX: lensStretch.value },
      { scaleY: 1 - (lensStretch.value - 1) * 0.25 },
    ],
  }));

  const select = (key: TabKey, action: () => void) => {
    if (key !== activeKey) Haptics.selectionAsync().catch(() => {});
    action();
  };
  const isDark = theme === 'dark';

  const addPress = useSharedValue(1);
  const addStyle = useAnimatedStyle(() => ({ transform: [{ scale: addPress.value }] }));

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + TAB_BAR_BOTTOM_OFFSET }]}>
      <View
        accessibilityRole="tablist"
        style={[styles.pill, { borderColor: theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)' }]}>
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
          {/* The glass lens behind the active tab: brighter frost, a light top
             highlight and a soft accent glow. It lives inside this clipped
             layer so the spring's overshoot can never poke out of the bar. */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.lens,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.72)',
                borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.95)',
                shadowColor: colors.accent,
              },
              lensStyle,
            ]}>
            <LinearGradient
              colors={isDark ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.9)', 'rgba(255,255,255,0)']}
              style={styles.lensShine}
            />
          </Animated.View>
        </View>


        <NavItem
          icon="home"
          active={activeKey === 'index'}
          color={iconColor(activeKey === 'index')}
          label={descriptors[state.routes.find((r) => r.name === 'index')!.key]?.options.title}
          onLayout={measure('index')}
          onPress={() => select('index', () => go('index'))}
        />

        <NavItem
          icon="search"
          active={activeKey === 'explore'}
          color={iconColor(activeKey === 'explore')}
          label={descriptors[state.routes.find((r) => r.name === 'explore')!.key]?.options.title}
          onLayout={measure('explore')}
          onPress={() => select('explore', () => go('explore'))}
        />

        {/* Keeps the "+" button's place between the tabs. The button itself
            is rendered after the pill (below), so the tablist holds only
            tabs: a button inside a tablist is invalid for screen readers
            (axe aria-required-children / aria-required-parent, L31). */}
        <View style={styles.navAddSlot} />

        <NavItem
          icon="message-circle"
          active={activeKey === 'messages'}
          color={iconColor(activeKey === 'messages')}
          label={t('common.messages')}
          onLayout={measure('messages')}
          onPress={() => select('messages', () => router.push('/messages' as Href))}>
          {unread > 0 && (
            <View style={[styles.navBadge, { backgroundColor: colors.accent }]}>
              <Text style={styles.navBadgeText}>{unread > 9 ? '9+' : unread}</Text>
            </View>
          )}
        </NavItem>

        <NavItem
          icon="user"
          active={activeKey === 'profile'}
          color={iconColor(activeKey === 'profile')}
          label={descriptors[state.routes.find((r) => r.name === 'profile')!.key]?.options.title}
          onLayout={measure('profile')}
          onPress={() => select('profile', () => go('profile'))}
        />
      </View>

      <AnimatedPressable
        style={[styles.navAdd, styles.navAddFloating, addStyle]}
        onPressIn={() => {
          if (!reduceMotion) addPress.set(withTiming(0.9, { duration: 90 }));
        }}
        onPressOut={() => {
          if (!reduceMotion) addPress.set(withSpring(1, { damping: 9, stiffness: 260 }));
        }}
        // The listing wizard (the old `listing/create` route redirects here too).
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          router.push('/listing/new' as Href);
        }}
        accessibilityRole="button"
        accessibilityLabel={t('listing.newListing')}>
        <LinearGradient
          // Matches web's --fho-orange-1 → --fho-orange-2 gradient exactly
          // (src/styles/theme.css); RN's palette only exposes the first stop.
          colors={[colors.accent, colors.accentEnd]}
          style={styles.navAddGradient}>
          <Feather name="plus" size={26} strokeWidth={2.5} color="#fff" />
        </LinearGradient>
      </AnimatedPressable>
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
  lens: {
    position: 'absolute',
    left: 0,
    top: (TAB_BAR_HEIGHT - 2 - LENS_HEIGHT) / 2,
    width: LENS_WIDTH,
    height: LENS_HEIGHT,
    borderRadius: LENS_HEIGHT / 2,
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
  },
  lensShine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: LENS_HEIGHT / 2,
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
  navAddSlot: {
    width: NAV_ADD_SIZE,
    height: NAV_ADD_SIZE,
  },
  // Same spot the button had as the pill's middle child: horizontally
  // centred (the four tabs are symmetric around it) and, from the margin-box
  // centring above, (TAB_BAR_HEIGHT - NAV_ADD_SIZE - 22) / 2 below the pill's
  // top edge, which sits NAV_ADD_OVERHANG below the wrapper's.
  navAddFloating: {
    position: 'absolute',
    left: '50%',
    marginLeft: -NAV_ADD_SIZE / 2,
    top: NAV_ADD_OVERHANG + (TAB_BAR_HEIGHT - NAV_ADD_SIZE - 22) / 2,
    marginTop: 0,
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
