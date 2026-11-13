// Types for attachments.js, so the phone app (TypeScript) can import it.
export type AttachmentKind = 'image' | 'file';
export interface Attachment {
  path: string;
  name: string;
  mime: string;
  size: number | null;
  kind: AttachmentKind;
}
export const MAX_ATTACHMENT_MB: number;
export const MAX_ATTACHMENT_BYTES: number;
export const ATTACHMENT_TYPES: Readonly<Record<string, { ext: string; kind: AttachmentKind }>>;
export const DOCUMENT_PICKER_TYPES: readonly string[];
export function attachmentType(mime: string | null | undefined, name: string | null | undefined): string | null;
export function checkAttachment(file: {
  mime: string | null | undefined;
  name: string | null | undefined;
  size: number | null | undefined;
}): 'type' | 'size' | null;
export function attachmentPath(
  conversationId: string,
  mime: string,
  options?: { now?: number; random?: string },
): string;
export function displayName(name: string | null | undefined, mime: string, fallback?: string): string;
export function attachmentRecord(file: { path: string; name: string; mime: string; size: number }): Attachment;
export function readAttachment(value: unknown): Attachment | null;
export function formatBytes(bytes: number | null | undefined, locale?: string): string;
