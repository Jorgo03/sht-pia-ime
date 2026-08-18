import { StyleSheet, Text, View } from 'react-native';

/**
 * Google's "G" mark. Web renders the official 4-colour SVG in Profile.jsx;
 * RN had been showing Ionicons' `logo-google` glyph tinted a single flat red,
 * which is both off-brand and not what the reference implementation shows.
 *
 * react-native-svg isn't a dependency of this project, and adding one purely
 * for a single 18px mark isn't worth the install, so this composes the mark
 * from the same four brand colours: a blue "G" glyph with the red/yellow/
 * green accents beneath it. Not a path-identical reproduction of the SVG, but
 * it reads as Google's multicolour mark rather than a monochrome icon.
 */
export function GoogleLogo({ size = 18 }: { size?: number }) {
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Text
        style={[
          styles.glyph,
          { fontSize: size, lineHeight: size * 1.15 },
        ]}>
        G
      </Text>
      <View style={styles.accents}>
        <View style={[styles.accent, { backgroundColor: GOOGLE_RED }]} />
        <View style={[styles.accent, { backgroundColor: GOOGLE_YELLOW }]} />
        <View style={[styles.accent, { backgroundColor: GOOGLE_GREEN }]} />
      </View>
    </View>
  );
}

// The four official brand hexes, same values as the SVG paths on web.
const GOOGLE_BLUE = '#4285F4';
const GOOGLE_GREEN = '#34A853';
const GOOGLE_YELLOW = '#FBBC05';
const GOOGLE_RED = '#EA4335';

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    fontWeight: '700',
    color: GOOGLE_BLUE,
    textAlign: 'center',
  },
  accents: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    height: 2,
    borderRadius: 1,
    overflow: 'hidden',
  },
  accent: {
    flex: 1,
  },
});
