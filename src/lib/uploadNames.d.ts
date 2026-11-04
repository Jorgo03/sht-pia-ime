export declare const UPLOAD_TYPES: Readonly<Record<string, string>>;
export declare function extensionFor(mime: string | null | undefined): string | null;
export declare function uploadPath(
  userId: string,
  mime: string,
  options?: { prefix?: string; now?: number; random?: string },
): string;
