import * as ImageManipulatorModule from 'expo-image-manipulator';
import type { ImageRef } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { debugWarn } from '@/lib/debug';
import { supabase } from '@/lib/supabase';
import { AVATAR_SIZE_PX, AVATAR_SOURCE_TYPES } from '@/src/features/auth/lib/avatar';
import {
  chooseUploadSource,
  readBytes,
  uploadAllOrNothing,
  uploadError,
  type UploadSource,
} from '@/src/features/listings/lib/mediaUpload';

const { ImageManipulator, SaveFormat } = ImageManipulatorModule;

// iOS hands over its most compatible copy (an 8-bit JPEG) instead of a 10-bit
// HDR HEIC. Expo Go 57.0.9's native manipulator cannot redraw an HDR photo
// that needs rotating ("Image context has been lost"; fixed in 57.0.21, which
// a store build uses). Ignored on Android and the web.
const COMPATIBLE = ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible;

// Mirrors the web app's NewListing.jsx rules exactly (src/features/listings/pages/NewListing.jsx):
// same bucket, same path convention, same min/max/size limits, same
// compression target, so a listing looks identical regardless of which app
// created it.
// One photo, not three. A listing with a single good photo is worth publishing
// — the earlier floor turned agents away at the last step of the wizard, and a
// listing that never gets posted helps nobody. MAX still guards the upload
// cost. Web's NewListing.jsx holds the same number; keep the two in step.
export const MIN_IMAGES = 1;
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
  /** Bytes and pixel width when the picker reports them. */
  size?: number | null;
  width?: number | null;
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
    quality: 1, // prepareListingImage below does the real compression
    preferredAssetRepresentationMode: COMPATIBLE,
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
      size: asset.fileSize ?? null,
      width: asset.width ?? null,
    });
  }

  return { images: accepted, oversizedCount };
}

/**
 * Re-encode as JPEG (optionally resized) and return the new file's uri. Each
 * photo gets its own context, and both native objects are released only
 * after the file is written.
 */
async function renderJpeg(uri: string, size: { width: number; height?: number } | null, compress: number): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  let rendered: ImageRef | null = null;
  try {
    if (size) context.resize(size);
    rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ compress, format: SaveFormat.JPEG });
    return saved.uri;
  } finally {
    rendered?.release();
    context.release();
  }
}

/** Same max width/quality as the website; never enlarges a smaller photo. */
async function prepareListingImage(img: PickedImage): Promise<UploadSource> {
  let processed: string | null = null;
  let failure: unknown = null;
  try {
    const resize = img.width && img.width <= COMPRESS_MAX_WIDTH ? null : { width: COMPRESS_MAX_WIDTH };
    processed = await renderJpeg(img.uri, resize, COMPRESS_QUALITY);
  } catch (err) {
    failure = err;
    debugWarn('photo processing', err);
  }
  return chooseUploadSource({
    processed,
    failure,
    original: { uri: img.uri, mimeType: img.mimeType, size: img.size ?? null },
    maxBytes: MAX_IMAGE_MB * 1024 * 1024,
  });
}

/** A local file's bytes. Not a Blob: see src/features/listings/lib/mediaUpload.js. */
const readLocal = (uri: string) => readBytes(fetch, uri);

const randomName = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

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
  const paths = await uploadAllOrNothing({
    items: images,
    prepare: prepareListingImage,
    read: readLocal,
    upload: async (source, bytes) => {
      const path = `${userId}/${randomName()}.${source.ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: source.contentType });
      if (error) {
        debugWarn('photo upload', error);
        throw uploadError('upload', error);
      }
      return path;
    },
    remove: removeUploadedImages,
    onProgress,
  });
  const urls = paths.map((path) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
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
  const bytes = await readLocal(video.uri);

  const ext = video.fileName.split('.').pop()?.toLowerCase() || 'mp4';
  const path = `${userId}/video-${randomName()}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: video.mimeType,
  });

  if (error) {
    debugWarn('video upload', error);
    throw uploadError('upload', error);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export type AvatarPick = { bytes: ArrayBuffer } | { error: 'canceled' | 'permission' | 'type' | 'failed' };

/**
 * Pick a profile photo, crop it square in the system picker, and re-encode it
 * as a small JPEG (docs/LAUNCH_TASKS.md F12). Re-encoding drops EXIF,
 * including GPS, before anything leaves the phone. The upload itself is
 * saveAvatar() in src/features/auth/lib/avatar.js, shared with the website.
 */
export async function pickAvatar(): Promise<AvatarPick> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { error: 'permission' };
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
    preferredAssetRepresentationMode: COMPATIBLE,
  });
  if (result.canceled || !result.assets[0]) return { error: 'canceled' };
  const asset = result.assets[0];
  if (asset.mimeType && !AVATAR_SOURCE_TYPES.includes(asset.mimeType)) return { error: 'type' };
  // Always re-encoded (no fallback to the original): that is what drops the
  // EXIF data, GPS included, before the photo leaves the phone.
  try {
    const jpeg = await renderJpeg(asset.uri, { width: AVATAR_SIZE_PX, height: AVATAR_SIZE_PX }, 0.85);
    return { bytes: await readLocal(jpeg) };
  } catch (err) {
    debugWarn('avatar processing', err);
    return { error: 'failed' };
  }
}
