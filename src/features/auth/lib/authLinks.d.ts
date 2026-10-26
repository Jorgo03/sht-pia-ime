// Types for authLinks.js, so the phone app (TypeScript) can import it.
export type EmailLinkType = 'email' | 'signup' | 'magiclink' | 'invite' | 'recovery' | 'email_change';
export const EMAIL_LINK_TYPES: EmailLinkType[];
export function emailLinkFrom(href: string): { tokenHash: string; type: EmailLinkType } | null;
export function authRedirectError(href: string): { error: string | null; code: string | null; description: string | null } | null;
export function hasAuthCode(href: string): boolean;
export function linkErrorKey(err: { code?: string | null; error?: string | null } | null | undefined): string;
export function providerEnabled(client: unknown, provider: string): Promise<boolean | null>;
