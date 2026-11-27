import Svg, { Path } from 'react-native-svg';

// The door symbol from the approved logo (assets/brand/symbol-orange.svg),
// drawn in code so it takes the theme's colour. It sits in front of the
// "Shtëpia.ime" wordmark in the top bar, as the website's lockup does.
const DOOR =
  'M50,231V99A78,78 0 0 1 206,99V231H184V99A56,56 0 0 0 72,99V231ZM126.00,101.67A4,4 0 0 1 128.46,97.97L168.46,81.31A4,4 0 0 1 174.00,85.00L174.00,227.00A4,4 0 0 1 170.00,231.00L130.00,231.00A4,4 0 0 1 126.00,227.00ZM131,163a10,10 0 1 0 20,0a10,10 0 1 0 -20,0Z';

export function BrandMark({ size = 26, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 256 256" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d={DOOR} fill={color} fillRule="evenodd" />
    </Svg>
  );
}
