// Types for oauthRelay.js, so the phone app (TypeScript) can import it.
export function isAppCallback(u: URL | null | undefined): boolean;
export function buildRelayTarget(search: string, hash: string): string | null;
export function isAllowedRelayTarget(url: unknown): boolean;
