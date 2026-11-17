// Types for forgetToken.js, so the phone app (TypeScript) can import it.
export function forgetToken(input: {
  readToken: () => Promise<string | null>;
  deleteRow: (token: string) => PromiseLike<{ error: unknown } | null | undefined>;
  clearToken: () => Promise<void>;
  retryDelayMs?: number;
  wait?: (ms: number) => Promise<void>;
}): Promise<'removed' | 'kept' | 'none'>;
