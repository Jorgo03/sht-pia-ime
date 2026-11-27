// Types for era.js, so the phone app can import it.
export const PAGE_SIZE: number;
export function fold(text: unknown): string;
export type EraRead =
  | { kind: 'search'; criteria: Record<string, unknown>; refine: boolean }
  | { kind: 'similar'; criteria: Record<string, unknown> }
  | { kind: 'more' }
  | { kind: 'topic'; topic: string };
export function readQuestion(question: string): EraRead;
export interface EraAnswer {
  reply: string;
  cards: any[];
  comparison: null;
  screens: { key: string; route: string }[];
  state: Record<string, unknown> | null;
}
export function askEra(args: {
  db: any;
  question: string;
  state: Record<string, unknown> | null;
  t: (key: string, options?: Record<string, unknown>) => string;
  propertyId?: string | null;
}): Promise<EraAnswer>;
