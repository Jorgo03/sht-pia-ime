// Types for catchUp.js, so the phone app (TypeScript) can import it.
export function createCatchUp(onCatchUp: () => void): {
  onStatus: (status: string) => void;
  onAppState: (next: string) => void;
};
export function mergeMessages<T extends { id: string; created_at: string }>(prev: T[] | null | undefined, fresh: T[] | null | undefined): T[];
