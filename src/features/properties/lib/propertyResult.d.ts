// Types for propertyResult.js, so the phone app (TypeScript) can import it.
export function propertyOrNotFound<T>(result: { data: T | null; error: { code?: string; message?: string } | null }): T | null;
