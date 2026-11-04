export interface LoginThrottle {
  check(email: string): { allowed: boolean; waitMs: number };
  fail(email: string): void;
  succeed(email: string): void;
}
export declare function createLoginThrottle(options?: {
  now?: () => number;
  perAccount?: number;
  perDevice?: number;
  windowMs?: number;
  maxDelayMs?: number;
  load?: () => string | null;
  save?: (value: string) => void;
}): LoginThrottle;
export declare function tooManyAttemptsError(waitMs: number): Error & { code: string; waitSeconds: number };
export declare function isWrongPassword(error: unknown): boolean;
export declare const THROTTLE_STORAGE_KEY: string;
