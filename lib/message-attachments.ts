import { useQuery } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';
import { prepareListingImage } from '@/lib/upload';
import { readBytes } from '@/src/features/listings/lib/mediaUpload';
import {
  ATTACHMENT_TYPES,
  DOCUMENT_PICKER_TYPES,
  MAX_ATTACHMENT_BYTES,
  attachmentPath,
  attachmentRecord,
  attachmentType,
  checkAttachment,
  displayName,
  type Attachment,
  type AttachmentKind,
} from '@/src/features/messaging/lib/attachments';

// Photos and documents in a chat (app/messages/[id].tsx). The rules are in
// src/features/messaging/lib/attachments.js; this file talks to the pickers
// and to the private bucket, which only the conversation's two participants
// can read (migration 20261111234947).

export const ATTACHMENT_BUCKET = 'message-attachments';

/** A file chosen to send, not uploaded yet. */
export interface PickedFile {
  uri: string;
  name: string;
  mime: string;
  size: number | null;
  kind: AttachmentKind;
}

export type PickProblem = 'type' | 'size' | 'permission';
export type PickResult = { file: PickedFile } | { problem: PickProblem } | null;

/**
 * One photo from the library, re-encoded as the listing photos are (a JPEG at
 * most 1600 px wide): smaller to send and never HEIC. Null when cancelled.
 */
export async function pickChatPhoto(): Promise<PickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { problem: 'permission' };
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: false,
    quality: 1,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  if (asset.fileSize && asset.fileSize > 4 * MAX_ATTACHMENT_BYTES) return { problem: 'size' };
  const source = await prepareListingImage({
    uri: asset.uri,
    fileName: asset.fileName || 'photo.jpg',
    mimeType: asset.mimeType || 'image/jpeg',
    size: asset.fileSize ?? null,
    width: asset.width ?? null,
  });
  if (!ATTACHMENT_TYPES[source.contentType]) return { problem: 'type' };
  const stem = (asset.fileName || 'foto').replace(/\.[^.]+$/, '');
  return {
    file: {
      uri: source.uri,
      name: displayName(`${stem}.${ATTACHMENT_TYPES[source.contentType].ext}`, source.contentType, 'foto'),
      mime: source.contentType,
      size: null,
      kind: 'image',
    },
  };
}

/** One document (PDF, Word, Excel, text) or image file. Null when cancelled. */
export async function pickChatDocument(): Promise<PickResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [...DOCUMENT_PICKER_TYPES],
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  const mime = attachmentType(asset.mimeType, asset.name);
  const problem = checkAttachment({ mime, name: asset.name, size: asset.size ?? undefined });
  if (problem || !mime) return { problem: problem ?? 'type' };
  return {
    file: {
      uri: asset.uri,
      name: displayName(asset.name, mime),
      mime,
      size: asset.size ?? null,
      kind: ATTACHMENT_TYPES[mime].kind,
    },
  };
}

/** Thrown when the bytes turn out larger than the limit. */
export class AttachmentTooLarge extends Error {}

/** Uploads the file into the conversation's folder; returns what the message records. */
export async function uploadChatFile(conversationId: string, file: PickedFile): Promise<Attachment> {
  const bytes = await readBytes(fetch, file.uri);
  if (bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new AttachmentTooLarge('file too large');
  const path = attachmentPath(conversationId, file.mime);
  const { error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, bytes, { contentType: file.mime, upsert: false });
  if (error) throw error;
  return attachmentRecord({ path, name: file.name, mime: file.mime, size: bytes.byteLength });
}

/** Removes a file whose message was refused, so none is left without one. */
export async function removeChatFile(path: string): Promise<void> {
  await supabase.storage.from(ATTACHMENT_BUCKET).remove([path]).catch(() => undefined);
}

/**
 * A link to a sent file, valid for an hour. The bucket is private, so this is
 * the only way to show it; the link is fetched again before it runs out.
 */
export function useAttachmentUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ['message-attachment', path ?? ''],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrl(path as string, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
    retry: 1,
  });
}
