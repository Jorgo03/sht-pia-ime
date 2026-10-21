// Types for authErrors.js, so the phone app (TypeScript) can import it.
type Translate = (key: string) => string;
type AuthError = { message?: string; code?: string } | null | undefined;
export const EMAIL_RE: RegExp;
export function friendlyError(err: AuthError, t: Translate): string;
export function retryAfterSeconds(err: AuthError): number | null;
