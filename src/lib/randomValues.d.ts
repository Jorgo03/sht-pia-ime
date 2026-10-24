// Types for randomValues.js, so the phone app (TypeScript) can import it.
export function installRandomValues(
  target: object,
  getRandomValues: <T extends ArrayBufferView | null>(array: T) => T,
): boolean;
