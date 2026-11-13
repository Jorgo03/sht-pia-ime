// Types for oauthOptions.js, so the phone app (TypeScript) can import it.
export function oauthQueryParams(provider: string): Record<string, string> | undefined;

/** Whether "Continue with Apple" is shown (provider must be on in Supabase). */
export const APPLE_SIGN_IN_ENABLED: boolean;
