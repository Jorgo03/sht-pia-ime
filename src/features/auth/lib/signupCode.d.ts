export declare const CODE_TTL_S: number;
export declare const MAX_CODE_ATTEMPTS: number;
export declare function codeExpiry(now?: number): number;
export declare function secondsLeft(expiresAt: number | null, now?: number): number | null;
export declare function formatCountdown(seconds: number): string;
export declare function blockedCodeKey(state: {
  expiresAt: number | null;
  attempts: number;
  now?: number;
}): string | null;
export declare function rejectedCodeKey(
  error: unknown,
  state: { expiresAt: number | null; attempts: number; now?: number },
): string | null;
export declare function isExistingAccount(data: unknown): boolean;
export declare function existingAccountError(): Error & { code: string };
export declare function isUnverifiedEmailUser(user: unknown): boolean;
