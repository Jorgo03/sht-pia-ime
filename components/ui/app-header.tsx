import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, Radii, Shadows, type AtticoPalette } from '@/constants/theme';
import { useAuth } from '@/contexts/auth-context';
import { useTheme } from '@/contexts/theme-context';
import { supabase } from '@/lib/supabase';

/** Same list, same native-language labels as web's Header.jsx LANGUAGES. */
const LANGUAGES = [
  { code: 'sq', name: 'Shqip', flag: '🇦🇱' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
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
export function AppHeader({
  /** Right-most slot — web puts the avatar (signed in) or a person icon
   *  (signed out) here. Omit it on the account screen itself, where it would
   *  only navigate to where the user already is. */
  trailing,
  /** Pushed screens pass this to get a back chevron in the left slot. Web has
   *  no equivalent — the browser's own back button covers it — but a stack
   *  screen with no way back is a dead end on a phone. */
  onBack,
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
}: {
  trailing?: ReactNode;
  onBack?: () => void;
  title?: string;
  avatar?: ReactNode;
  subtitle?: ReactNode;
  floating?: boolean;
  showControls?: boolean;
  onDark?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { theme, colors, toggle: toggleTheme } = useTheme();
  const styles = useMemo(
    () => createStyles(colors, onDark || floating, !!onBack, floating),
    [colors, onDark, onBack, floating],
  );
  const [langOpen, setLangOpen] = useState(false);

  const currentFlag =
    LANGUAGES.find((l) => l.code === i18n.language)?.flag ?? LANGUAGES[0].flag;

  // Mirrors web's Header.jsx changeLanguage(): i18next's own storage-backed
  // detector persists the choice, and it's also written to the profile row so
  // the preference follows the account across devices.
  const changeLanguage = async (next: string) => {
    await i18n.changeLanguage(next);
    setLangOpen(false);
    if (user) {
      await supabase.from('profiles').update({ preferred_language: next }).eq('id', user.id);
    }
  };

  return (
    <View style={styles.header}>
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

      <View style={styles.leading}>
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
        {avatar}
        {title ? (
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle}
          </View>
        ) : !onBack ? (
          /* `.header-brand`: serif 22/600 in orange, with `.ime` a lighter
             weight. These are static per-weight files, so the pair is
             Newsreader 600 + 500 rather than one family at two weights. */
          <Text style={styles.brand}>
            Shtëpia<Text style={styles.brandIme}>.ime</Text>
          </Text>
        ) : null}
      </View>

      {/* Pushed screens with no title of their own (viewings, my-listings,
          saved-searches, agent-dashboard, the property-detail hero) used to
          show the wordmark crammed right against the back chevron. Centering
          it over the full bar — the standard back/title/actions nav-bar
          layout — reads as an intentional page title instead of branding
          that got shoved into a corner. Screens with their own `title` are
          untouched; that block still sits next to the chevron. */}
      {!title && onBack && (
        <View style={styles.brandCentered} pointerEvents="none">
          <Text style={styles.brand}>
            Shtëpia<Text style={styles.brandIme}>.ime</Text>
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        {showControls && (
          <>
            {/* No accessibilityLabel: the visible code is the name, same as
                web's `.lang-btn`, which has no aria-label either. */}
            <Pressable
              style={styles.langBtn}
              onPress={() => setLangOpen(true)}
              accessibilityRole="button">
              <Text style={styles.langCode}>{currentFlag}</Text>
              <MaterialIcons name="expand-more" size={14} color={styles.langCode.color} />
            </Pressable>

            <Pressable
              style={styles.iconBtn}
              onPress={toggleTheme}
              accessibilityRole="button"
              accessibilityLabel={t('common.toggleTheme')}>
              <MaterialIcons
                name={theme === 'dark' ? 'light-mode' : 'dark-mode'}
                size={17}
                color={styles.langCode.color}
              />
            </Pressable>
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
        <Pressable style={styles.langBackdrop} onPress={() => setLangOpen(false)}>
          <Pressable style={styles.langCard} onPress={(e) => e.stopPropagation()}>
            {LANGUAGES.map((lang) => {
              const active = lang.code === i18n.language;
              return (
                <Pressable
                  key={lang.code}
                  style={styles.langRowWrap}
                  onPress={() => changeLanguage(lang.code)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}>
                  {active ? (
                    <LinearGradient
                      colors={[colors.accent, colors.accentEnd]}
                      style={styles.langRow}>
                      <Text style={styles.langRowCode}>{lang.flag}</Text>
                      <Text style={[styles.langRowName, styles.langRowActive]}>{lang.name}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={styles.langRow}>
                      <Text style={styles.langRowCode}>{lang.flag}</Text>
                      <Text style={styles.langRowName}>{lang.name}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
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
      paddingHorizontal: 20,
      paddingVertical: 10,
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
    // own. Insets are fixed rather than measured against the actual chevron/
    // actions width — that's the standard nav-bar trade-off (Slack, iOS
    // Mail, etc. all do the same): a screen with no trailing controls won't
    // be pixel-perfect optically centered, but it's still dead-centered on
    // the bar itself, which reads as intentional. 56 clears the chevron on
    // one side and a two-icon action group (share + favorite, ~88px) on the
    // other with room to spare.
    brandCentered: {
      position: 'absolute',
      left: 56,
      right: 56,
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backBtn: {
      width: 28,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
    },
    brand: {
      fontFamily: Fonts?.serifSemiBold,
      fontSize: 22,
      letterSpacing: -0.44,
      color: colors.accent,
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
      paddingVertical: 7,
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
      fontSize: 16,
      lineHeight: 18,
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
      paddingTop: 96,
      paddingHorizontal: 20,
    },
    langCard: {
      // Web's min-width: 170px — sized to its content, not full-bleed.
      minWidth: 190,
      backgroundColor: colors.primaryLight,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radii.md,
      padding: 4,
      gap: 2,
      ...Shadows.card,
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
      fontSize: 18,
      lineHeight: 20,
      width: 24,
      textAlign: 'center',
    },
    langRowName: {
      fontFamily: Fonts?.sansMedium,
      fontSize: 14,
      color: colors.textPrimary,
    },
    langRowActive: {
      color: '#fff',
    },
  });
};
