// Types for viewingErrors.js, so the phone app (TypeScript) can import it.
export function viewingRequestErrorKey(
  error: { code?: string; message?: string } | null | undefined,
): 'viewings.slotTaken' | 'viewings.pastDate' | 'viewings.requestFailed';
