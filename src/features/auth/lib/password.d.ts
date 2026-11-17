// Types for password.js, so the phone app (TypeScript) can import it.
import type { SupabaseClient, User } from '@supabase/supabase-js';

export const PASSWORD_MIN_LENGTH: number;
export const PASSWORD_MAX_BYTES: number;
export function passwordStrengthError(password: string): string | null;
export function newPasswordError(password: string, confirm: string, options?: { current?: string }): string | null;
export function signInMethods(user: User | null | undefined): string[];
export function hasPasswordSignIn(user: User | null | undefined): boolean;
export function providerLabels(user: User | null | undefined): string[];
export type ChangePasswordResult =
  | { status: 'changed'; othersSignedOut: boolean }
  | { status: 'wrongCurrent' }
  | { status: 'failed'; error: unknown };
export function changePassword(
  client: SupabaseClient,
  args: { email: string; currentPassword: string; newPassword: string },
): Promise<ChangePasswordResult>;
export function signOutOtherDevices(client: SupabaseClient): Promise<boolean>;
