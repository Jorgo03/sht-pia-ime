import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState, type ReactNode } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { Fonts, Motion, Radii, type AtticoPalette } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';

/**
 * Field + RoleToggle from the design handoff §17.
 *
 * Field: 54px tall, 14px radius, leading icon, optional trailing slot, and a
 * focus border that turns orange (§3's auth spec). `onDark` variants target
 * the glass auth card, where the field sits on a dark translucent surface
 * rather than cream.
 */
export function Field({
  icon,
  trailing,
  onDark = false,
  style,
  ...inputProps
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  trailing?: ReactNode;
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
} & TextInputProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [focused, setFocused] = useState(false);

  const placeholderColor = onDark ? 'rgba(255,255,255,0.35)' : colors.textSecondary;
  const iconColor = focused ? colors.accent : placeholderColor;

  return (
    <View
      style={[
        styles.field,
        onDark && styles.fieldOnDark,
        focused && styles.fieldFocused,
        style,
      ]}>
      <MaterialIcons name={icon} size={18} color={iconColor} />
      <TextInput
        {...inputProps}
        onFocus={(e) => {
          setFocused(true);
          inputProps.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          inputProps.onBlur?.(e);
        }}
        placeholderTextColor={placeholderColor}
        style={[styles.input, onDark && styles.inputOnDark]}
      />
      {trailing}
    </View>
  );
}

/**
 * RoleToggle — animated sliding-pill segmented control (Client / Agent).
 * The pill translates rather than cross-fading, which is what makes it read
 * as one moving object instead of two states (§17, §6).
 */
export function RoleToggle<T extends string>({
  options,
  value,
  onChange,
  onDark = false,
}: {
  options: { value: T; label: string; icon?: keyof typeof MaterialIcons.glyphMap }[];
  value: T;
  onChange: (value: T) => void;
  onDark?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [trackWidth, setTrackWidth] = useState(0);
  const activeIndex = Math.max(0, options.findIndex((o) => o.value === value));
  const offset = useSharedValue(0);

  // Segment width excludes the track's 4px padding on each side.
  const segmentWidth = trackWidth > 0 ? (trackWidth - 8) / options.length : 0;

  const onTrackLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  // Drive the pill from the active index whenever either it or the measured
  // width changes — a plain style calc would jump instead of sliding.
  const pillStyle = useAnimatedStyle(() => {
    offset.value = withTiming(activeIndex * segmentWidth, {
      duration: Motion.fast,
      easing: Easing.bezier(...Motion.easeOut),
    });
    return {
      width: segmentWidth,
      transform: [{ translateX: offset.value }],
    };
  }, [activeIndex, segmentWidth]);

  return (
    <View
      style={[styles.toggleTrack, onDark && styles.toggleTrackOnDark]}
      onLayout={onTrackLayout}>
      {segmentWidth > 0 && (
        <Animated.View style={[styles.togglePill, pillStyle]}>
          <LinearGradient
            colors={[colors.accent, colors.accentEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[StyleSheet.absoluteFillObject, { borderRadius: Radii.pill }]}
          />
        </Animated.View>
      )}
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            style={styles.toggleSegment}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}>
            {opt.icon ? (
              <MaterialIcons
                name={opt.icon}
                size={15}
                color={active ? '#fff' : onDark ? 'rgba(255,255,255,0.6)' : colors.textSecondary}
              />
            ) : null}
            <Text
              style={[
                styles.toggleLabel,
                onDark && styles.toggleLabelOnDark,
                active && styles.toggleLabelActive,
              ]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const createStyles = (colors: AtticoPalette) => StyleSheet.create({
  field: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  fieldOnDark: {
    borderColor: colors.glassOnDarkBorder,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  fieldFocused: {
    borderColor: colors.accent,
  },
  input: {
    flex: 1,
    fontFamily: Fonts?.sans,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 14,
  },
  inputOnDark: {
    color: colors.cream100,
  },
  toggleTrack: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: Radii.pill,
    backgroundColor: colors.glass,
    position: 'relative',
  },
  toggleTrackOnDark: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  togglePill: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: Radii.pill,
    overflow: 'hidden',
  },
  toggleSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
  },
  toggleLabel: {
    fontFamily: Fonts?.sansSemiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  toggleLabelOnDark: {
    color: 'rgba(255,255,255,0.6)',
  },
  toggleLabelActive: {
    color: '#fff',
  },
});
