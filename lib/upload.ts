import * as ImageManipulatorModule from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';

const { ImageManipulator, SaveFormat } = ImageManipulatorModule;

// Mirrors the web app's NewListing.jsx rules exactly (src/features/listings/pages/NewListing.jsx):
// same bucket, same path convention, same min/max/size limits, same
// compression target, so a listing looks identical regardless of which app
// created it.
export const MIN_IMAGES = 3;
export const MAX_IMAGES = 20;
export const MAX_IMAGE_MB = 10;
export const MAX_VIDEO_MB = 50;
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime'];
const COMPRESS_MAX_WIDTH = 1600;
const COMPRESS_QUALITY = 0.8;
// Video shares the photo bucket — same as web, which uploads the tour video to
// `property-images` under a `video-` prefixed path rather than a second bucket
// with its own policies to keep in sync.
const BUCKET = 'property-images';

export interface PickedImage {
  uri: string;
  fileName: string;
  mimeType: string;
}

export interface PickImagesResult {
  images: PickedImage[];
  /** Count of assets rejected for exceeding MAX_IMAGE_MB — surface this so
   *  the caller can warn instead of silently dropping a selection. */
  oversizedCount: number;
}

/**
 * Opens the native photo library picker for multiple images. Returns an
 * empty result if the user cancels or denies permission (caller decides
 * whether/how to surface that — this never throws for a normal cancel).
 */
export async function pickImages(alreadySelected: number): Promise<PickImagesResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { images: [], oversizedCount: 0 };

  const remaining = MAX_IMAGES - alreadySelected;
  if (remaining <= 0) return { images: [], oversizedCount: 0 };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: remaining,
    quality: 1, // compressImage below does the real compression
  });

  if (result.canceled) return { images: [], oversizedCount: 0 };

  const maxBytes = MAX_IMAGE_MB * 1024 * 1024;
  const accepted: PickedImage[] = [];
  let oversizedCount = 0;

  for (const asset of result.assets) {
    if (asset.fileSize && asset.fileSize > maxBytes) {
      oversizedCount++;
      continue;
    }
    accepted.push({
      uri: asset.uri,
      fileName: asset.fileName || `photo-${Date.now()}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
    });
  }

  return { images: accepted, oversizedCount };
}

/** Resize to the same max width/quality the web app compresses to before upload. */
async function compressImage(uri: string): Promise<{ uri: string }> {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: COMPRESS_MAX_WIDTH });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: COMPRESS_QUALITY, format: SaveFormat.JPEG });
  return { uri: saved.uri };
}

export interface UploadedImages {
  urls: string[];
  paths: string[];
}

/**
 * Compresses and uploads each image to the same `property-images` bucket the
 * web app uses, in order. Throws and rolls back anything already uploaded if
 * any single image fails — a listing must never publish with fewer photos
 * than the agent actually selected (same rule as web's uploadImages()).
 */
export async function uploadPropertyImages(
  images: PickedImage[],
  userId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<UploadedImages> {
  const urls: string[] = [];
  const paths: string[] = [];

  for (const img of images) {
    const compressed = await compressImage(img.uri);
    const response = await fetch(compressed.uri);
    const blob = await response.blob();

    const ext = img.fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      contentType: img.mimeType,
    });

    if (error) {
      if (paths.length) await supabase.storage.from(BUCKET).remove(paths).catch(() => {});
      throw Object.assign(new Error('upload_failed'), { uploadFailed: true });
    }

    paths.push(path);
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
    onProgress?.(paths.length, images.length);
  }

  return { urls, paths };
}

/** Cleanup helper for when upload succeeds but the DB insert afterward fails. */
export async function removeUploadedImages(paths: string[]): Promise<void> {
  if (!paths.length) return;
  await supabase.storage.from(BUCKET).remove(paths).catch(() => {});
}

export interface PickedVideo {
  uri: string;
  fileName: string;
  mimeType: string;
  /** Bytes, for the size line under the picked-file row. */
  size: number;
}

export type PickVideoRejection = 'type' | 'size';

export interface PickVideoResult {
  video: PickedVideo | null;
  /** Why the pick was dropped, so the caller can show web's exact message
   *  (errors.videoInvalidType / errors.videoTooLarge) instead of a generic one. */
  rejected: PickVideoRejection | null;
}

/**
 * Native video-library picker for the listing's tour video. Same rules web's
 * `handleVideo()` enforces: MP4/MOV only, MAX_VIDEO_MB ceiling, both checked
 * before any bytes leave the device.
 */
export async function pickVideo(): Promise<PickVideoResult> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { video: null, rejected: null };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['videos'],
    allowsMultipleSelection: false,
    quality: 1,
  });

  if (result.canceled) return { video: null, rejected: null };

  const asset = result.assets[0];
  if (!asset) return { video: null, rejected: null };

  const fileName = asset.fileName || `video-${Date.now()}.mp4`;
  // Android's picker frequently omits mimeType, so fall back to the extension
  // rather than rejecting a legitimate MP4 for having no reported type.
  const ext = fileName.split('.').pop()?.toLowerCase();
  const mimeType =
    asset.mimeType ?? (ext === 'mov' ? 'video/quicktime' : ext === 'mp4' ? 'video/mp4' : '');

  if (!ALLOWED_VIDEO_TYPES.includes(mimeType)) {
    return { video: null, rejected: 'type' };
  }
  if (asset.fileSize && asset.fileSize > MAX_VIDEO_MB * 1024 * 1024) {
    return { video: null, rejected: 'size' };
  }

  return {
    video: { uri: asset.uri, fileName, mimeType, size: asset.fileSize ?? 0 },
    rejected: null,
  };
}

/**
 * Uploads the tour video and returns its public URL plus the storage path so
 * the caller can roll it back alongside the photos. Throws the same
 * `uploadFailed`-tagged error uploadPropertyImages() does, since the submit
 * treats video and photos as one all-or-nothing unit (same rule as web).
 */
export async function uploadPropertyVideo(
  video: PickedVideo,
  userId: string,
): Promise<{ url: string; path: string }> {
  const response = await fetch(video.uri);
  const blob = await response.blob();

  const ext = video.fileName.split('.').pop()?.toLowerCase() || 'mp4';
  const path = `${userId}/video-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: video.mimeType,
  });

  if (error) throw Object.assign(new Error('upload_failed'), { uploadFailed: true });

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}
