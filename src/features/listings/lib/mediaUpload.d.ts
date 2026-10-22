// Types for mediaUpload.js, so the phone app (TypeScript) can import it.
export type UploadStage = 'prepare' | 'read' | 'upload';
export interface UploadSource {
  uri: string;
  contentType: string;
  ext: string;
  fallback: boolean;
}
export interface StagedError extends Error {
  stage: UploadStage;
  uploadFailed?: boolean;
}
export const UPLOAD_IMAGE_TYPES: string[];
export function uploadError(stage: UploadStage, cause?: unknown): StagedError;
export function chooseUploadSource(input: {
  processed: string | null;
  failure?: unknown;
  original: { uri: string; mimeType?: string | null; size?: number | null } | null;
  maxBytes: number;
}): UploadSource;
export function readBytes(fetchImpl: (uri: string) => Promise<{ arrayBuffer(): Promise<ArrayBuffer> }>, uri: string): Promise<ArrayBuffer>;
export function uploadAllOrNothing<T>(input: {
  items: T[];
  prepare: (item: T) => Promise<UploadSource>;
  read: (uri: string) => Promise<ArrayBuffer>;
  upload: (source: UploadSource, bytes: ArrayBuffer) => Promise<string>;
  remove: (paths: string[]) => Promise<void> | void;
  onProgress?: (done: number, total: number) => void;
}): Promise<string[]>;
export function isDuplicateKey(error: unknown): boolean;
