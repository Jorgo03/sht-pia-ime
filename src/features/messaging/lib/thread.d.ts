// Types for thread.js, so the phone app (TypeScript) can import it.
export const MESSAGE_HISTORY_LIMIT: number;
export function loadThreadMessages<T = Record<string, unknown>>(
  client: unknown,
  conversationId: string,
): Promise<{ messages: T[]; error: null } | { messages: null; error: unknown }>;
export function isNotFound(error: unknown): boolean;
