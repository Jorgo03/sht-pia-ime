// Types for assistantHistory.js, so the phone app (TypeScript) can import it.
export const ASSISTANT_HISTORY_LIMIT: number;
export function assistantHistory(
  messages: readonly { role: 'user' | 'assistant'; content: string; failed?: boolean }[],
  question: string,
): { role: 'user' | 'assistant'; content: string }[];
