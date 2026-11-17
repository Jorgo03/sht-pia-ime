// Types for doorLogo.js, so the phone app (TypeScript) can import it.
export const ARCH: string;
export const DOOR: string;
export const KNOB: string;
export const DOORWAY: string;
export const DOOR_COLOR: string;
export const SPLASH: { viewBox: number; x: number; y: number; scale: number };
export const SPLASH_IMAGE_WIDTH: number;
export const HINGE: { x: number; y: number };
export function toSplashBox(point: { x: number; y: number }, size?: number): { x: number; y: number };
export const TIMELINE: {
  doorStart: number;
  doorEnd: number;
  enterStart: number;
  fadeStart: number;
  end: number;
  reducedHold: number;
  reducedFade: number;
  skipFade: number;
};
export const DOOR_OPEN_DEG: number;
