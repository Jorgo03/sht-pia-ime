import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Platform, StyleSheet, Text, View, type LayoutChangeEvent, type TextStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import {
  advance,
  isRtlLanguage,
  preparePhrases,
  stepDelay,
  visibleParts,
  type TypewriterState,
} from '@/src/features/home/lib/typewriter';

const BLINK_MS = 530;

/**
 * The Home headline, typed and deleted phrase by phrase. Knows nothing about
 * any language: the words come from the translation files, characters are
 * whole graphemes, and the cursor is the last character of the same run of
 * text, so it lands on the correct side in left-to-right and right-to-left
 * text alike with no positioning here. Parent gives it `key={language}`.
 *
 * The space is reserved for the tallest phrase, by measuring every phrase
 * invisibly, so the search bar below never moves. With reduced motion on it
 * is simply the first phrase. The website's first frame is that phrase in
 * full too: the page is pre-rendered, so it must not start blank.
 */
export function HeroTypewriter({
  phrases: raw,
  language,
  textStyle,
  accentStyle,
  cursorColor,
}: {
  phrases: unknown;
  language: string;
  textStyle: TextStyle;
  accentStyle: TextStyle;
  cursorColor: string;
}) {
  const phrases = useMemo(() => preparePhrases(raw), [raw]);
  const reduceMotion = useReducedMotion();
  const animated = !reduceMotion && phrases.length > 0;

  const [state, setState] = useState<TypewriterState>(() =>
    Platform.OS === 'web'
      ? { index: 0, count: phrases[0]?.graphemes.length ?? 0, phase: 'pause' }
      : { index: 0, count: 0, phase: 'typing' },
  );
  const [cursorOn, setCursorOn] = useState(true);
  const [height, setHeight] = useState(0);

  // Only while it can be seen: Home stays mounted behind the other tabs.
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState !== 'background');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  const running = animated && focused && active;

  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => setState((s) => advance(s, phrases)), stepDelay(state, phrases, Math.random()));
    return () => clearTimeout(timer);
  }, [running, state, phrases]);

  // Solid while typing; blinks only while resting on a finished phrase.
  const resting = state.phase === 'pause' || state.phase === 'gap';
  useEffect(() => {
    if (!running || !resting) return;
    const timer = setInterval(() => setCursorOn((on) => !on), BLINK_MS);
    return () => {
      clearInterval(timer);
      setCursorOn(true);
    };
  }, [running, resting]);

  if (phrases.length === 0) return null;

  const first = phrases[0];
  const parts = animated ? visibleParts(phrases[state.index], state.count) : { lead: `${first.lead}${first.accent ? ' ' : ''}`, accent: first.accent };
  // iOS honours this; Android and the web read the direction from the text and the page.
  const direction: TextStyle = Platform.OS === 'ios' ? { writingDirection: isRtlLanguage(language) ? 'rtl' : 'ltr' } : {};
  const cursor = animated ? (
    <Text style={{ color: cursorOn ? cursorColor : 'transparent' }} accessibilityElementsHidden importantForAccessibility="no">|</Text>
  ) : null;

  const measure = (e: LayoutChangeEvent) => {
    const h = Math.ceil(e.nativeEvent.layout.height);
    setHeight((prev) => (h > prev ? h : prev));
  };
  // Longest first in the flow, so the very first layout is already about right.
  const byLength = [...phrases].sort((a, b) => b.graphemes.length - a.graphemes.length);

  return (
    <View style={height ? { minHeight: height } : undefined}>
      <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" style={styles.reserve}>
        {byLength.map((p, i) => (
          <View key={p.full} style={i === 0 ? undefined : styles.overlay} onLayout={measure}>
            <Text style={[textStyle, direction]}>
              {p.lead}
              {p.accent ? <Text style={accentStyle}> {p.accent}</Text> : null}
              {animated ? '|' : null}
            </Text>
          </View>
        ))}
      </View>
      {/* The heading's name is the whole first phrase: a screen reader should
          not read a sentence as it is being typed. */}
      <Text
        style={[textStyle, direction, styles.overlay]}
        accessibilityRole="header"
        accessibilityLabel={animated ? first.full : undefined}>
        {parts.lead}
        {parts.accent ? <Text style={accentStyle}>{parts.accent}</Text> : null}
        {cursor}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  reserve: { opacity: 0 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
});
