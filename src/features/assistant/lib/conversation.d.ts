// Types for conversation.js, so the phone app can import it.
export interface AssistantTurn {
  role: 'user' | 'assistant';
  content: string;
}
export const HISTORY_TURNS: number;
export const STORE_LIMIT: number;
export const MAX_AGE_MS: number;
export const MAX_QUESTION_CHARS: number;
export function storageKey(userId: string | null | undefined): string;
export function historyFor(
  messages: readonly { role: string; content?: string; failed?: unknown }[] | null | undefined,
  question: string,
): AssistantTurn[];
export function toStored<M, S>(messages: M[], state: S | null, now?: number): { v: 1; savedAt: number; messages: M[]; state: S | null };
export function fromStored<M = unknown, S = unknown>(raw: unknown, now?: number): { messages: M[]; state: S | null } | null;
