import { useId } from 'react';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/**
 * Era's portrait, the same drawing as the website's
 * (website/src/features/era/EraAvatar.jsx). Decorative: her name is always
 * written next to it or carried by the button's label.
 */
export function EraAvatar({ size = 48 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs>
        <LinearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#ffc08f" />
          <Stop offset="1" stopColor="#ff7d1a" />
        </LinearGradient>
        <ClipPath id={`${id}clip`}>
          <Circle cx="32" cy="32" r="32" />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${id}clip)`}>
        <Rect width="64" height="64" fill={`url(#${id}bg)`} />
        <Path d="M13.5 36 C11 18 21 9.5 32 9.5 C43 9.5 53 18 50.5 36 C52 44 53 52 54 60 L10 60 C11 52 12 44 13.5 36 Z" fill="#3a2317" />
        <Path d="M8 64 C10 51 20 46.5 32 46.5 C44 46.5 54 51 56 64 Z" fill="#0c4a57" />
        <Path d="M26.5 46.8 L32 53 L37.5 46.8 Z" fill="#f0bf9b" />
        <Rect x="28" y="37" width="8" height="11" rx="3.5" fill="#e9b38e" />
        <Ellipse cx="32" cy="29" rx="11" ry="12.5" fill="#f4c9a6" />
        <Path d="M20.2 29 C19.5 17.5 26.5 13 33 13 C40.5 13 45.2 18.5 43.9 28 C40.5 21.5 33.5 18.8 27 21.2 C23.8 22.4 21.4 25.4 20.2 29 Z" fill="#3a2317" />
        <Path d="M26 30.2 q1.7 -1.8 3.4 0 M34.6 30.2 q1.7 -1.8 3.4 0" fill="none" stroke="#3a2317" strokeWidth={1.5} strokeLinecap="round" />
        <Circle cx="25" cy="33.6" r="2.1" fill="#ff8f7a" opacity={0.38} />
        <Circle cx="39" cy="33.6" r="2.1" fill="#ff8f7a" opacity={0.38} />
        <Path d="M28.8 35.6 q3.2 2.8 6.4 0" fill="none" stroke="#b4513a" strokeWidth={1.5} strokeLinecap="round" />
        <Circle cx="20.9" cy="33" r="1.3" fill="#ffd57e" />
        <Circle cx="43.1" cy="33" r="1.3" fill="#ffd57e" />
      </G>
    </Svg>
  );
}
