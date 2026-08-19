import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { usePressScale } from '@/components/ui/motion';
import { Fonts, Motion, Radii, Shadows, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

/**
 * PrimaryCTA + GhostBtn from the design handoff §17/§5.
 *
 * `ActionButton` (components/ui/action-button.tsx) predates these and paints a
 * flat accent fill; the spec's primary CTA is an orange *gradient* pill with
 * the `cta` shadow and an optional trailing icon. New work should use
 * PrimaryCTA — ActionButton is left in place because several screens still
 * call it and swapping them all is a separate, mechanical pass.
 */

export function PrimaryCTA({
  label,
  onPress,
  /** Trailing glyph — the spec's CTAs read "Step inside →", "Schedule a viewing →". */
  icon = 'arrow-forward',
  disabled = false,
  loading = false,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof MaterialIcons.glyphMap | null;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { pressStyle, onPressIn, onPressOut } = usePressScale(Motion.pressScaleButton);
  const inert = disabled || loading;

  return (
    <Animated.View style={[!inert && pressStyle, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={inert ? undefined : onPressIn}
        onPressOut={inert ? undefined : onPressOut}
        disabled={inert}
        accessibilityRole="button"
        accessibilityState={{ disabled: inert }}
        style={[styles.cta, inert && styles.ctaDisabled]}>
        <LinearGradient
          colors={[colors.accent, colors.accentEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Text style={styles.ctaLabel}>{label}</Text>
        {icon && !loading ? <MaterialIcons name={icon} size={18} color="#fff" /> : null}
      </Pressable>
    </Animated.View>
  );
}

/** Translucent secondary button — used in the dark/glass auth context and as
 *  the wizard's "Back" action. */
export function GhostBtn({
  label,
  onPress,
  icon = null,
  onDark = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: keyof typeof MaterialIcons.glyphMap | null;
  /** true when sitting on the auth hero / a dark sheet rather than cream. */
  onDark?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { pressStyle, onPressIn, onPressOut } = usePressScale(Motion.pressScaleButton);

  return (
    <Animated.View style={[!disabled && pressStyle, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={disabled ? undefined : onPressIn}
        onPressOut={disabled ? undefined : onPressOut}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        style={[styles.ghost, onDark && styles.ghostOnDark, disabled && styles.ctaDisabled]}>
        {icon ? (
          <MaterialIcons
            name={icon}
            size={16}
            color={onDark ? colors.cream100 : colors.textPrimary}
          />
        ) : null}
        <Text style={[styles.ghostLabel, onDark && styles.ghostLabelOnDark]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  // §3: "orange gradient pill ... with the cta shadow", 54px tall.
  cta: {
    height: 54,
    borderRadius: Radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
    ...Shadows.cta,
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  ctaLabel: {
    fontFamily: Fonts?.sansBold,
    fontSize: 16,
    color: '#fff',
  },
  ghost: {
    height: 54,
    borderRadius: Radii.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  ghostOnDark: {
    borderColor: colors.glassOnDarkBorder,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  ghostLabel: {
    fontFamily: Fonts?.sansSemiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
  ghostLabelOnDark: {
    color: colors.cream100,
  },
});
