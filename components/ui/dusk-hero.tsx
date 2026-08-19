import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/contexts/theme-context';

/**
 * RN port of web's DuskHero (src/features/auth/components/DuskHero.{jsx,css})
 * — the dusk-sky gradient behind the sign-in screen with a skyline of
 * buildings and lit windows. Not a photograph: web draws it entirely in CSS,
 * and the design brief explicitly says to use that layered approach rather
 * than hand-drawn SVG, so this reproduces it with Views.
 *
 * Colour stops, building widths/heights, and the window opacity pattern are
 * the same values as the stylesheet, per theme.
 */

// .dusk-sky's 7 gradient stops, light theme and [data-theme="dark"].
// `as const` so these are readonly tuples — LinearGradient's props require
// at least two entries at the type level, which a plain string[] can't prove.
const SKY_LIGHT = ['#1a1520', '#2d1f3a', '#4a2848', '#8b4a3a', '#cc7040', '#e8944a', '#f0a050'] as const;
const SKY_DARK = ['#0a0810', '#1a1228', '#2a1830', '#5a2a28', '#8a4828', '#a06030', '#b87038'] as const;
const SKY_LOCATIONS = [0, 0.25, 0.45, 0.65, 0.8, 0.9, 1] as const;

/** .b1–.b5: width in px, height as a fraction of the buildings band, and the
 *  window-grid column count. Window counts match DuskHero.jsx's markup. */
const BUILDINGS = [
  { width: 38, heightPct: 0.45, columns: 2, windows: 6 },
  { width: 44, heightPct: 0.65, columns: 2, windows: 8 },
  { width: 34, heightPct: 0.35, columns: 2, windows: 4 },
  { width: 40, heightPct: 0.55, columns: 2, windows: 6 },
  { width: 48, heightPct: 0.70, columns: 3, windows: 9 },
];

/** Reproduces the CSS nth-child rules: odd windows are brightest, every 3rd
 *  is mid, the rest are nearly dark. Web's `:nth-child` is 1-based. */
function windowOpacity(index: number, isDark: boolean): string {
  const oneBased = index + 1;
  if (oneBased % 2 === 1) return isDark ? 'rgba(255,200,100,0.45)' : 'rgba(255,200,100,0.6)';
  if (oneBased % 3 === 0) return 'rgba(255,180,80,0.4)';
  return 'rgba(255,200,100,0.15)';
}

export function DuskHero({ bandHeight = 260 }: { bandHeight?: number }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <View style={styles.hero} pointerEvents="none">
      <LinearGradient
        colors={isDark ? SKY_DARK : SKY_LIGHT}
        locations={SKY_LOCATIONS}
        style={StyleSheet.absoluteFill}
      />

      {/* .dusk-buildings — bottom-anchored, centered row, 4px gaps. */}
      <View style={[styles.buildings, { height: bandHeight * 0.55 }]}>
        {BUILDINGS.map((b, bi) => (
          <View
            key={bi}
            style={[
              styles.building,
              {
                width: b.width,
                height: `${b.heightPct * 100}%`,
                backgroundColor: isDark ? '#0e0c14' : '#1a1520',
              },
            ]}>
            {Array.from({ length: b.windows }, (_, wi) => (
              <View
                key={wi}
                style={[
                  styles.window,
                  {
                    backgroundColor: windowOpacity(wi, isDark),
                    // Two/three per row, matching each building's grid.
                    width: b.columns === 3 ? 6 : 8,
                  },
                ]}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  buildings: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
  },
  building: {
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    paddingTop: 8,
    paddingHorizontal: 6,
    justifyContent: 'center',
  },
  window: {
    height: 10,
    borderRadius: 1.5,
  },
});
