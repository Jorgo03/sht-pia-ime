// Types for avatar.js, so the phone app (TypeScript) can import it.
type Client = { from: (table: string) => any; storage: { from: (bucket: string) => any } };

export const AVATAR_BUCKET: string;
export const AVATAR_MAX_BYTES: number;
export const AVATAR_SOURCE_TYPES: string[];
export const AVATAR_SOURCE_MAX_BYTES: number;
export const AVATAR_SIZE_PX: number;

export function avatarSourceError(file?: { type?: string | null; size?: number | null }): 'type' | 'size' | null;
export function newAvatarPath(userId: string, now?: number): string;
export function ownAvatarPath(url: string | null | undefined, userId: string): string | null;
export function bodySize(body: Blob | ArrayBuffer | null | undefined): number | null;
export function saveAvatar(
  client: Client,
  userId: string,
  /** A Blob on the website, an ArrayBuffer in the phone app. */
  body: Blob | ArrayBuffer,
  previousUrl: string | null | undefined,
): Promise<{ status: 'saved'; url: string } | { status: 'failed' | 'tooLarge' }>;
export function removeAvatar(client: Client, userId: string, previousUrl: string | null | undefined): Promise<'saved' | 'failed'>;
