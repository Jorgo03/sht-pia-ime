// Types for typewriter.js, so the phone app (TypeScript) can import it.
export interface HeroPhrase {
  lead: string;
  accent: string;
  full: string;
  graphemes: string[];
  leadLength: number;
}
export interface TypewriterState {
  index: number;
  count: number;
  phase: 'typing' | 'pause' | 'deleting' | 'gap';
}
export function segmentByRules(text: string): string[];
export function segmentGraphemes(text: string): string[];
export function preparePhrases(phrases: unknown): HeroPhrase[];
export function visibleParts(phrase: HeroPhrase, count: number): { lead: string; accent: string };
export function advance(state: TypewriterState, phrases: HeroPhrase[]): TypewriterState;
export function stepDelay(state: TypewriterState, phrases: HeroPhrase[], random: number): number;
export function isRtlLanguage(language: string | null | undefined): boolean;
