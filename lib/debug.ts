// Development-only diagnostics: a no-op in production builds, so nothing is
// printed on a user's phone. Messages go through the error reporter's
// redaction (emails, phone numbers, tokens and ids are masked).
import { redact } from '@/src/lib/errorReport';

export function debugWarn(label: string, error: unknown): void {
  if (!__DEV__) return;
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.warn(`[${label}]`, redact(text));
}
