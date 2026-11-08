// Types for headlineFonts.js, so the phone app (TypeScript) can import it.
export type HeadlineRole = 'serif' | 'serifSemiBold' | 'serifItalic';
export function needsHeadlineFallback(language: string | null | undefined): boolean;
export function headlineFont(role: HeadlineRole, language: string | null | undefined): string;
export const HEADLINE_FONT_FILES: string[];
