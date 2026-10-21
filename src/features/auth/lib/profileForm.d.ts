// Types for profileForm.js, so the phone app (TypeScript) can import it.
export interface ProfileFields {
  full_name?: string | null;
  agency_name?: string | null;
  phone?: string | null;
}

export type ProfileError = 'nameRequired' | 'tooLong' | 'phoneInvalid';
export type SaveResult = 'saved' | 'unchanged' | 'failed';

type Client = { from: (table: string) => any };

export const PROFILE_LIMITS: { full_name: number; agency_name: number; phone: number };
export function isValidPhone(value: string | null | undefined): boolean;
export function profilePatch(
  current: ProfileFields | null | undefined,
  form: ProfileFields,
  options?: { isAgent?: boolean },
): { patch: ProfileFields; error: ProfileError | null };
export function saveProfile(client: Client, userId: string, patch: ProfileFields): Promise<SaveResult>;
