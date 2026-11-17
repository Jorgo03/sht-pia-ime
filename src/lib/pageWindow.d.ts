// Types for pageWindow.js, so the phone app (TypeScript) can import it.
export const LIST_PAGE_SIZE: number;
export function pageWindow<T>(rows: T[] | null | undefined, limit: number): { items: T[]; hasMore: boolean };
