// The Shtëpia.ime door (assets/brand/symbol-orange.svg), split into the parts
// the launch animation moves (components/brand/door-splash.tsx). Pure, for
// `npm test`, which checks that ARCH + DOOR + KNOB is the original path
// character for character: the logo is reused, never redrawn.
//
// Coordinates are the symbol's own 256-unit box. The door is drawn ajar: its
// right edge (x = 174) is the tall one, nearest the viewer, so that is the
// hinge; the knob sits by the free edge on the left.

/** The fixed outer arch. */
export const ARCH = 'M50,231V99A78,78 0 0 1 206,99V231H184V99A56,56 0 0 0 72,99V231Z'
/** The door panel. */
export const DOOR = 'M126.00,101.67A4,4 0 0 1 128.46,97.97L168.46,81.31A4,4 0 0 1 174.00,85.00L174.00,227.00A4,4 0 0 1 170.00,231.00L130.00,231.00A4,4 0 0 1 126.00,227.00Z'
/** The knob: a hole in the door (even-odd fill), so it moves with the door. */
export const KNOB = 'M131,163a10,10 0 1 0 20,0a10,10 0 1 0 -20,0Z'
/** The opening the door stands in: the inside of the arch. */
export const DOORWAY = 'M72,231V99A56,56 0 0 1 184,99V231Z'

export const DOOR_COLOR = '#FF5F1F'

/** How splash-icon.svg places the symbol in its 1024 box (the native splash image). */
export const SPLASH = { viewBox: 1024, x: 128, y: 130, scale: 3 }
/** app.json expo-splash-screen imageWidth: the native splash draws the 1024 box this wide. */
export const SPLASH_IMAGE_WIDTH = 200

/** The hinge: the door's right edge, at the door's vertical middle. */
export const HINGE = { x: 174, y: (81.31 + 231) / 2 }

/** A symbol point, in points inside a splash box `size` wide. */
export function toSplashBox(point, size = SPLASH_IMAGE_WIDTH) {
  const k = size / SPLASH.viewBox
  return { x: (SPLASH.x + SPLASH.scale * point.x) * k, y: (SPLASH.y + SPLASH.scale * point.y) * k }
}

/** Milliseconds from the moment the native splash hides. */
export const TIMELINE = {
  doorStart: 400,
  doorEnd: 1400,
  enterStart: 1400,
  fadeStart: 1700,
  end: 2000,
  /** Reduced motion: a short fade only. */
  reducedHold: 150,
  reducedFade: 250,
  /** A tap skips to the app. */
  skipFade: 180,
}

/** How far the door swings, in degrees (negative: inward, away from the viewer). */
export const DOOR_OPEN_DEG = -72
