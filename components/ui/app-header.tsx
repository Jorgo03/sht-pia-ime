import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import { useIsFocused, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationBell } from '@/components/notifications/notification-bell';
import { BrandMark } from '@/components/ui/brand-mark';
import { ThemeToggleButton } from '@/components/ui/theme-toggle-button';
import { Fonts, Radii, Shadows, type AtticoPalette } from '@/constants/theme';
import { IS_WEB, WEB_MAX_WIDTH } from '@/constants/web-frame';
import { useAuth } from '@/contexts/auth-context';
import { useCurrency } from '@/contexts/currency-context';
import { DISPLAY_CURRENCIES } from '@/lib/currency';
import { useHydrated } from '@/hooks/use-hydrated';
import { useTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';

/** Same list, same native-language labels as web's Header.jsx LANGUAGES. */
/** The bar's side padding: the app's page gutter. */
const HEADER_GUTTER = 20;
/** Space between the phone's status bar and the bar's controls. */
const HEADER_TOP_PADDING = 16;
/** Minimum space between the centred wordmark and the controls either side. */
const BRAND_CLEARANCE = 8;

const LANGUAGES = [
  { code: 'sq', name: 'Shqip', flag: '🇦🇱' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'el', name: 'Ελληνικά', flag: '🇬🇷' },
  { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
];

/**
 * Port of web's `.app-header` (src/styles/header.css + polish.css:183) — the
 * bar above every web screen: the Shtëpia.ime wordmark on the left, language
 * and theme controls on the right, frosted over whatever is behind it with a
 * hairline bottom border.
 *
 * The language menu lives in here rather than in each screen. Web gets that
 * for free by rendering one shared <Header/> in its layout; on mobile each
 * screen mounts its own header, so keeping the picker (and the profile-row
 * sync that goes with it) inside the component is what stops three screens
 * growing three copies of the same dropdown.
 *
 * `onDark` is for the auth screen, where this sits over the DuskHero art in
 * both themes. Everywhere else it follows the palette, exactly like web's
 * theme-driven `--fho-surface`.
 */
/**
 * Light clock and battery icons over a dark header. The app-wide status bar
 * (app/_layout.tsx) follows the theme, so in light mode it drew dark icons on
 * the always-dark sign-in screen and over listing photos. Only while focused:
 * tabs stay mounted, and a hidden screen must not keep the icons white.
 */
function LightStatusBarWhileFocused() {
  const focused = useIsFocused();
  return focused ? <StatusBar style="light" /> : null;
}

/** From this browser width a titleless screen shows no bar of its own. */
const WEB_DESKTOP_BAR_MIN = 768;

export function AppHeader({
  /** Right-most slot — web puts the avatar (signed in) or a person icon
   *  (signed out) here. Omit it on the account screen itself, where it would
   *  only navigate to where the user already is. */
  trailing,
  /** Pushed screens pass this to get a back chevron in the left slot. Web has
   *  no equivalent — the browser's own back button covers it — but a stack
   *  screen with no way back is a dead end on a phone. */
  onBack: onBackProp,
  /** Only for pushed screens whose title lives in the header rather than in a
   *  hero below it. Replaces the wordmark: a chevron, wordmark, title and two
   *  controls do not fit across 375px. */
  title,
  /** Rendered between the chevron and the title — the message thread's
   *  correspondent avatar. */
  avatar,
  /** Optional second line under the title (the thread's property link). */
  subtitle,
  /** Drops the bar's own background and border so the header can sit over a
   *  full-bleed hero image instead of above it. Implies `onDark`. */
  floating = false,
  /** Language + theme controls. Off where the screen's own contextual actions
   *  own the right side — six controls do not fit across a phone, and on a
   *  property hero share/save matter more than switching language. */
  showControls = true,
  onDark = false,
  titleIsHeading = false,
  onIdentityPress,
  identityLabel,
  site = false,
  compact = false,
  gutter,
  height,
}: {
  /** The website's side gutter and bar height (constants/theme Site). */
  gutter?: number;
  height?: number;
  /** Notifications only, without language and theme (the site header on a
   *  phone, whose menu holds those two). */
  compact?: boolean;
  /** The website's own top header (components/web/site-header). */
  site?: boolean;
  trailing?: ReactNode;
  onBack?: () => void;
  title?: string;
  avatar?: ReactNode;
  subtitle?: ReactNode;
  floating?: boolean;
  showControls?: boolean;
  onDark?: boolean;
  /** The title is the screen's only heading (an <h1> on the web, a heading
   *  for VoiceOver/TalkBack). Off where the screen has its own headline. */
  titleIsHeading?: boolean;
  /** Makes the avatar and the title (not the subtitle) open something: the
   *  message thread opens the other person's profile. The avatar is the
   *  button screen readers get, labelled `identityLabel`; the title stays a
   *  heading and is also tappable. */
  onIdentityPress?: () => void;
  identityLabel?: string;
}) {
  const { t, i18n } = useTranslation();
  const { theme, colors } = useTheme();
  // Website: the site header (components/web/site-header, which passes
  // `site`) shows the brand, menu and controls once at the top of every
  // page. A screen's own header then only keeps what is specific to it: a
  // back button, a title, or the actions over a listing's photos.
  const router = useRouter();
  const onWebScreen = IS_WEB && !site;
  if (onWebScreen) showControls = false;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // On a desktop browser a screen with no title of its own drops its bar:
  // the site header and the browser's Back cover it, and a back arrow and a
  // second logo under the site menu made every page look like the phone app.
  // After hydration only, so the pre-rendered page and the first draw agree.
  const hydrated = useHydrated();
  const onBack = onWebScreen && hydrated && !title && !floating && windowWidth >= WEB_DESKTOP_BAR_MIN ? undefined : onBackProp;
  const styles = useMemo(
    () => createStyles(colors, onDark || floating, !!onBack, floating),
    [colors, onDark, onBack, floating],
  );
  const [langOpen, setLangOpen] = useState(false);
  // Where the language menu hangs: under its own button (measured when it
  // opens), kept inside the window so it never runs off a 390px phone.
  const langBtnRef = useRef<{ measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void } | null>(null);
  const [langAnchor, setLangAnchor] = useState<{ top: number; right: number } | null>(null);
  const openLang = () => {
    const node = langBtnRef.current;
    if (!node?.measureInWindow) return setLangOpen(true);
    node.measureInWindow((x, y, w, h) => {
      setLangAnchor({ top: y + h + 6, right: Math.max(8, windowWidth - (x + w)) });
      setLangOpen(true);
    });
  };
  const insets = useSafeAreaInsets();
  // The menu hangs under the bar: the top inset, the bar's 54 (10 + 34 + 10)
  // and web's 6px gap. A fixed 96 put it over the header on notched iPhones,
  // and its 8 rows (~358) ran off a 360x380 Flip cover, so it now scrolls
  // within the window. On the web the Modal covers the whole browser window,
  // not the 480 column, so the menu is anchored to the column's right edge.
  const menuTop = insets.top + 66;
  const menuMaxHeight = Math.max(120, windowHeight - menuTop - insets.bottom - 24);
  const menuRight = IS_WEB && !site
    ? Math.max(HEADER_GUTTER, (windowWidth - WEB_MAX_WIDTH) / 2 + HEADER_GUTTER)
    : HEADER_GUTTER;
  // Widths of the bar, its two sides and the wordmark, so the centred
  // wordmark is shown only when it fits between equal insets. Fixed insets
  // assumed an 88px control group; language + theme is ~106px, and at 320-
  // 360px the wordmark slid under the controls.
  const [box, setBox] = useState({ bar: 0, lead: 0, act: 0, brand: 0 });
  const track = (key: keyof typeof box) => (e: LayoutChangeEvent) => {
    const w = Math.ceil(e.nativeEvent.layout.width);
    setBox((b) => (b[key] === w ? b : { ...b, [key]: w }));
  };
  const side = Math.max(box.lead, box.act);
  const brandFits = box.bar > 0 && box.brand > 0 && box.brand <= box.bar - 2 * (HEADER_GUTTER + side + BRAND_CLEARANCE);

  // Nothing of its own to show on a website page: the site header covers it.
  const empty = onWebScreen && !onBack && !title && !floating && !trailing;

  const currentFlag =
    LANGUAGES.find((l) => l.code === i18n.language)?.flag ?? LANGUAGES[0].flag;


  if (empty) return null;

  return (
    // Reaches up behind the clock and battery, so the bar's colour runs to the
    // top of the screen instead of leaving the page's darker ground above it.
    <View
      style={[
        styles.header,
        !floating && { marginTop: -insets.top, paddingTop: insets.top + HEADER_TOP_PADDING },
        gutter != null && { paddingHorizontal: gutter },
        height != null && { minHeight: height, paddingTop: 0, paddingBottom: 0 },
      ]}
      onLayout={track('bar')}>
      {(onDark || floating) && <LightStatusBarWhileFocused />}
      {/* A floating header lets the hero image show through, so it gets no
          blur layer and no tint — only the controls sit on top. */}
      {!floating && (
        <>
          <BlurView
            intensity={18}
            tint={onDark || theme === 'dark' ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, styles.tint]} />
        </>
      )}

      <View style={[styles.leading, site && { flexShrink: 0 }]} onLayout={track('lead')}>
        {onBack && (
          <Pressable
            style={styles.backBtn}
            onPress={onBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}>
            <MaterialIcons name="chevron-left" size={26} color={styles.langCode.color} />
          </Pressable>
        )}
        {avatar && onIdentityPress ? (
          <Pressable
            onPress={onIdentityPress}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={identityLabel}
            style={({ pressed }) => pressed && styles.identityPressed}>
            {avatar}
          </Pressable>
        ) : (
          avatar
        )}
        {title ? (
          <View style={styles.titleBlock}>
            <Text
              style={styles.title}
              numberOfLines={1}
              accessibilityRole={titleIsHeading ? 'header' : undefined}
              onPress={onIdentityPress}
              suppressHighlighting>
              {title}
            </Text>
            {subtitle}
          </View>
        ) : !onBack ? (
          /* `.header-brand`: serif 22/600 in orange, with `.ime` a lighter
             weight. These are static per-weight files, so the pair is
             Newsreader 600 + 500 rather than one family at two weights. */
          <View style={styles.brandRow}>
            <BrandMark color={colors.accent} />
            <Text
              style={styles.brand}
              accessibilityRole={site ? 'link' : undefined}
              onPress={site ? () => router.push('/' as Href) : undefined}>
              Shtëpia<Text style={styles.brandIme}>.ime</Text>
            </Text>
          </View>
        ) : null}
      </View>

      {/* Pushed screens with no title of their own (viewings, my-listings,
          saved-searches, agent-dashboard, the property-detail hero) used to
          show the wordmark crammed right against the back chevron. Centering
          it over the full bar — the standard back/title/actions nav-bar
          layout — reads as an intentional page title instead of branding
          that got shoved into a corner. Screens with their own `title` are
          untouched; that block still sits next to the chevron. */}
      {/* Not on the website: the site header above already shows the logo. */}
      {!title && onBack && !onWebScreen && (
        <View
          style={[styles.brandCentered, !floating && { top: insets.top }, !brandFits && styles.brandHidden]}
          pointerEvents="none"
          accessibilityElementsHidden={!brandFits}
          importantForAccessibility={brandFits ? 'auto' : 'no-hide-descendants'}>
          <View style={styles.brandRow} onLayout={track('brand')}>
            <BrandMark color={colors.accent} />
            <Text style={styles.brand} numberOfLines={1}>
              Shtëpia<Text style={styles.brandIme}>.ime</Text>
            </Text>
          </View>
        </View>
      )}

      <View style={styles.actions} onLayout={track('act')}>
        {showControls && (
          <>
            {/* Labelled: the visible content is only a flag emoji, which a
                screen reader reads as "flag" rather than "Language". */}
            {!compact && (
            <Pressable
                ref={langBtnRef as never}
                style={({ hovered, focused }: { hovered?: boolean; focused?: boolean }) => [styles.langBtn, hovered && styles.langBtnHover, focused && styles.focusRing]}
                hitSlop={6}
                onPress={openLang}
                accessibilityRole="button"
                accessibilityLabel={t('common.language')}
                accessibilityState={{ expanded: langOpen }}
                aria-haspopup="menu">
                <Text style={styles.langCode}>{currentFlag}</Text>
                <MaterialIcons name="expand-more" size={14} color={styles.langCode.color} />
              </Pressable>
            )}

            <NotificationBell style={styles.iconBtn} iconColor={styles.langCode.color} />
            {!compact && <ThemeToggleButton style={styles.iconBtn} iconColor={styles.langCode.color} />}
          </>
        )}

        {trailing}
      </View>

      {/* Anchored under the language button, matching web's `.lang-dropdown`
          (`position: absolute; top: calc(100% + 6px); right: 0`) rather than
          a centred sheet. */}
      <Modal
        visible={langOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLangOpen(false)}>
        <Pressable
          style={[
            styles.langBackdrop,
            langAnchor && IS_WEB
              ? { paddingTop: langAnchor.top, paddingRight: langAnchor.right, paddingHorizontal: 0, backgroundColor: 'transparent' }
              : { paddingTop: menuTop, paddingRight: menuRight },
          ]}
          onPress={() => setLangOpen(false)}>
          <Pressable style={styles.langCard} onPress={(e) => e.stopPropagation()}>
            {/* flexGrow 0: a ScrollView grows by default, which stretched the
                card to menuMaxHeight (the whole screen) on iOS instead of
                fitting its rows; it still scrolls when the rows don't fit. */}
            <ScrollView
              style={{ flexGrow: 0, maxHeight: menuMaxHeight }}
              contentContainerStyle={styles.langList}
              bounces={false}
              accessibilityRole="menu"
              // Web: ↑/↓ move between the choices (Tab still works; Esc and a
              // click outside close it through the Modal).
              {...(IS_WEB ? ({ onKeyDown: menuArrowKeys } as object) : {})}>
              <LanguageOptions onChosen={() => setLangOpen(false)} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}


/**
 * The language list and the price-currency choice: the app header's
 * dropdown, and the website's menu on a phone (components/web/site-header).
 */
export function LanguageOptions({ onChosen, onDark = false }: { onChosen?: () => void; onDark?: boolean }) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { colors } = useTheme();
  const { currency, setCurrency } = useCurrency();
  const styles = useMemo(() => createStyles(colors, false, false, false), [colors]);
  // Mirrors web's Header.jsx changeLanguage(): i18next's own storage-backed
  // detector persists the choice, and it's also written to the profile row so
  // the preference follows the account across devices.
  const changeLanguage = async (next: string) => {
    await i18n.changeLanguage(next);
    onChosen?.();
    if (user) {
      await supabase.from('profiles').update({ preferred_language: next }).eq('id', user.id);
    }
  };
  return (
    <>
              {LANGUAGES.map((lang) => {
                const active = lang.code === i18n.language;
                return (
                  <Pressable
                    key={lang.code}
                    style={({ hovered, focused }: { hovered?: boolean; focused?: boolean }) => [styles.langRowWrap, (hovered || focused) && (onDark ? styles.langRowHoverDark : styles.langRowHover), active && styles.langRowCurrent, focused && styles.focusRing]}
                    onPress={() => changeLanguage(lang.code)}
                    accessibilityRole={IS_WEB ? ('menuitemradio' as 'menuitem') : 'button'}
                    accessibilityState={{ selected: active, checked: active }}
                    // The current language takes the focus when the menu opens.
                    {...(IS_WEB && active ? ({ autoFocus: true } as object) : {})}>
                    {/* The current one: a tinted row in the darker orange
                        text (AA) with a tick, not white on orange (3.1:1). */}
                    <View style={styles.langRow}>
                      <Text style={[styles.langRowCode, onDark && !active && styles.onDarkMuted]}>{lang.flag}</Text>
                      <Text style={[styles.langRowName, onDark && !active && styles.onDarkText, active && styles.langRowCurrentText]}>{lang.name}</Text>
                      {active ? <MaterialIcons name="check" size={16} color={colors.accentText} style={styles.langRowCheck} /> : null}
                    </View>
                  </Pressable>
                );
              })}
              {/* Price currency (ALL / EUR / USD / GBP) for visitors from
                  abroad; in the same menu as the language, since both are
                  "show me this in my terms". */}
              <Text style={[styles.currencyLabel, onDark && styles.onDarkMuted]}>{t('currency.title')}</Text>
              <View style={styles.currencyRow}>
                {([null, ...DISPLAY_CURRENCIES] as const).map((c) => {
                  const active = c === currency;
                  return (
                    <Pressable
                      key={c ?? 'listed'}
                      onPress={() => setCurrency(c)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={c ?? t('currency.asListed')}
                      style={[styles.currencyChip, onDark && styles.currencyChipDark, active && { backgroundColor: colors.accent, borderColor: colors.accent }]}>
                      <Text style={[styles.currencyChipText, onDark && styles.onDarkText, active && styles.currencyChipTextActive]}>{c ?? t('currency.asListedShort')}</Text>
                    </Pressable>
                  );
                })}
              </View>
    </>
  );
}

/**
 * ↑ / ↓ (and Home / End) move the focus between a web menu's choices, as
 * the ARIA menu pattern expects; Tab, Enter, Space and Esc keep working.
 */
function menuArrowKeys(e: { key: string; currentTarget: unknown; preventDefault: () => void }) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
  const root = e.currentTarget as HTMLElement;
  const items = Array.from(root.querySelectorAll<HTMLElement>('[role^="menuitem"], [role="button"]'));
  if (!items.length) return;
  e.preventDefault();
  const at = items.indexOf(document.activeElement as HTMLElement);
  const next =
    e.key === 'Home' ? 0
    : e.key === 'End' ? items.length - 1
    : e.key === 'ArrowDown' ? (at + 1) % items.length
    : (at - 1 + items.length) % items.length;
  items[next]?.focus();
}

const createStyles = (
  colors: AtticoPalette,
  onDark: boolean,
  hasBack: boolean,
  floating: boolean,
) => {
  // Over the dusk artwork every control has to read against a dark backdrop
  // regardless of the app theme; elsewhere they follow the palette, same as
  // web's theme-driven `--fho-*` tokens.
  const fg = onDark ? colors.cream100 : colors.textPrimary;
  const line = onDark ? 'rgba(255,255,255,0.14)' : colors.border;
  const fill = onDark ? 'rgba(255,255,255,0.06)' : colors.glass;

  return StyleSheet.create({
    header: {
      // The property-detail hero wraps this in a `flexDirection: 'row'`
      // SafeAreaView (see property/[id].tsx's `imageHeader`) so it can
      // pin the whole bar to the top of the image — but a row parent sizes
      // a lone child to its own content width by default, not the parent's
      // full width, which silently shrink-wrapped this to just the visible
      // controls. `width: '100%'` makes it fill its container regardless of
      // which parent (row or column) it's dropped into.
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      // Without a floor, `justifyContent: 'space-between'` lets a long
      // wordmark/title grow right up against the actions with zero
      // breathing room — `leading`'s `flexShrink: 1` only kicks in once
      // they're already touching.
      gap: 8,
      paddingHorizontal: HEADER_GUTTER,
      // More above than below: clear of the phone's clock and battery.
      paddingTop: HEADER_TOP_PADDING,
      paddingBottom: 10,
      // The floating variant is chrome over a photo — a border would draw a
      // line across the image.
      borderBottomWidth: floating ? 0 : StyleSheet.hairlineWidth,
      borderBottomColor: line,
      overflow: 'hidden',
    },
    // Web's header is `--fho-surface` at 72% behind an 18px blur. That token
    // is `colors.primaryLight` here, not `colors.surface` — the latter is
    // hardcoded pure white in both palettes (unrelated to theme), which was
    // rendering the header as a flat white/gray bar that never matched the
    // cream (light) or dark-brown (dark) page background behind it.
    tint: {
      backgroundColor: onDark ? 'rgba(20,17,14,0.45)' : colors.primaryLight + 'b8',
    },
    leading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      // Lets a long title ellipsize instead of pushing the controls off-screen.
      flexShrink: 1,
      // The chevron's own optical inset, so the wordmark still lines up with
      // the 20px page gutter when there's no back button.
      marginLeft: hasBack ? -6 : 0,
    },
    // The centered wordmark for a back-button screen with no title of its
    // own: dead-centre on the bar (the standard back/title/actions layout).
    // It spans the whole bar so the text measures at its natural width; the
    // component hides it when that width doesn't fit between the two sides.
    brandCentered: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brandHidden: { opacity: 0 },
    backBtn: {
      width: 28,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // The door symbol, then the wordmark (the logo's horizontal lockup).
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    brand: {
      fontFamily: Fonts?.serifSemiBold,
      fontSize: 22,
      letterSpacing: -0.44,
      color: colors.accent,
    },
    identityPressed: {
      opacity: 0.6,
    },
    titleBlock: {
      flexShrink: 1,
      minWidth: 0,
    },
    // Screens whose title sits in the header rather than a hero below it.
    title: {
      fontFamily: Fonts?.serif,
      fontSize: 18,
      color: fg,
    },
    brandIme: {
      fontFamily: Fonts?.serif,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    // `.lang-btn`: pill, 7px/11px, hairline border, faint fill.
    langBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      // The height of the buttons beside it, so its contents centre in it.
      height: 34,
      paddingHorizontal: 11,
      borderRadius: Radii.pill,
      borderWidth: 1,
      borderColor: line,
      backgroundColor: fill,
    },
    // `.lang-code`: mono 11, uppercase, 0.05em. Also the source of `fg` for
    // the sibling icon button, so their tints can never drift apart.
    // Holds the trigger's flag glyph. Also the shared color reference the
    // header's other icons (theme toggle, back chevron) read via
    // `styles.langCode.color`, so this stays even though it's no longer
    // rendering a text code.
    langCode: {
      fontFamily: Fonts.sans,
      fontSize: 16,
      // No lineHeight: squeezing the line pushed the flag emoji up on iPhone.
      includeFontPadding: false,
      color: fg,
    },
    // `.theme-btn` / `.account-signin-btn`: 34px square, r-sm.
    iconBtn: {
      width: 34,
      height: 34,
      borderRadius: Radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: line,
      backgroundColor: fill,
    },

    langBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'flex-end',
      justifyContent: 'flex-start',
      // paddingTop and paddingRight are set inline, from the insets and window.
      paddingHorizontal: HEADER_GUTTER,
    },
    langCard: {
      // Web's min-width: 170px — sized to its content, not full-bleed.
      minWidth: 190,
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.md,
      padding: 4,
      ...Shadows.card,
    },
    langList: {
      gap: 2,
    },
    langRowWrap: {
      borderRadius: 10,
      overflow: 'hidden',
    },
    langRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderRadius: 10,
    },
    langRowCode: {
      fontFamily: Fonts.sans,
      fontSize: 18,
      lineHeight: 20,
      width: 24,
      textAlign: 'center',
      // Where a browser has no flag glyphs (Windows) the flag shows as its
      // two letters, so it needs a text colour that reads on the menu: in
      // the dark phone drawer it was black on black for every row but the
      // current one.
      color: colors.textSecondary,
    },
    langRowName: {
      fontFamily: Fonts?.sansMedium,
      fontSize: 14,
      color: colors.textPrimary,
    },
    langRowActive: {
      color: '#fff',
    },
    langRowHover: { backgroundColor: colors.glass },
    langRowHoverDark: { backgroundColor: 'rgba(255,255,255,0.08)' },
    // The website's dark drawer (components/web/site-header).
    onDarkText: { color: '#ffffff' },
    onDarkMuted: { color: '#d9d4cc' },
    currencyChipDark: { borderColor: 'rgba(255,255,255,0.3)' },
    // Dark on the orange chip: 6.25:1 (white was 3.1:1).
    currencyChipTextActive: { color: '#1a1714', fontFamily: Fonts.sansBold },
    langRowCurrent: { backgroundColor: colors.accentTint },
    langRowCurrentText: { color: colors.accentText, fontFamily: Fonts.sansBold },
    langRowCheck: { marginLeft: 'auto' },
    langBtnHover: { borderColor: onDark ? 'rgba(255,255,255,0.5)' : colors.borderStrong },
    // Visible keyboard focus (WCAG 2.4.7): 4.7:1 on cream, 7.4:1 on black.
    focusRing: IS_WEB ? ({ outlineStyle: 'solid', outlineWidth: 2, outlineColor: onDark ? '#ff6b00' : '#b34700', outlineOffset: 2 } as object) : {},
    currencyLabel: {
      fontFamily: Fonts.sansSemiBold,
      fontSize: 12,
      color: colors.textSecondary,
      paddingHorizontal: 14,
      paddingTop: 10,
      paddingBottom: 4,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      marginTop: 4,
    },
    currencyRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      paddingHorizontal: 10,
      paddingBottom: 8,
      maxWidth: 220,
    },
    currencyChip: {
      minHeight: 36,
      minWidth: 44,
      paddingHorizontal: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    currencyChipText: {
      fontFamily: Fonts.sansMedium,
      fontSize: 13,
      color: colors.textPrimary,
    },
  });
};
