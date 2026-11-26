// Types for xlsx.js, so the phone app can import it.
export interface Sheet {
  name: string;
  rows: unknown[][];
  /** The first row is a bold header that stays in place (default true). */
  header?: boolean;
  /** Filter arrows on the header (default: when there is a header). */
  filter?: boolean;
}
export function crc32(bytes: Uint8Array): number;
export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array;
export function columnName(index: number): string;
export function sheetName(name: string, taken: Set<string>): string;
export function buildXlsx(sheets: Sheet[]): Uint8Array;
export const XLSX_TYPE: string;
