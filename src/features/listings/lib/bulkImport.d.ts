export interface ImportError {
  kind: 'required' | 'invalid' | 'duplicate' | 'encoding';
  field?: string;
}
export interface ImportRow {
  line: number;
  title: string;
  columns: Record<string, unknown> | null;
  errors: ImportError[];
}
export interface ImportResult {
  problem: 'excel' | 'empty' | 'columns' | 'tooMany' | null;
  missing?: string[];
  rows: ImportRow[];
}
export declare const MAX_IMPORT_ROWS: number;
export declare const MAX_IMPORT_BYTES: number;
export declare const COLUMN_NAMES: Record<string, string>;
export declare const REQUIRED_COLUMNS: string[];
export declare function parseCsv(text: string): { line: number; cells: string[] }[];
export declare function parseNumber(raw: string): number | null;
export declare function duplicateKey(title: string, address: string, price: number): string;
export declare function buildImport(text: string, existing?: { title: string; address: string; price: number }[]): ImportResult;
export declare function batches<T>(items: T[], size?: number): T[][];
