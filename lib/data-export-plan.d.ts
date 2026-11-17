export interface ExportTable { table: string; match: string[]; omit?: string[] }
export declare const EXPORT_TABLES: readonly ExportTable[];
export declare const PAGE: number;
export declare const MAX_ROWS: number;
export declare function ownerFilter(match: string[], userId: string): string;
export declare function stripColumns<T extends Record<string, unknown>>(rows: T[], omit?: string[]): Record<string, unknown>[];
export declare function exportDocument(userId: string, sections: Record<string, unknown>, now?: Date): string;
export declare function exportFileName(now?: Date): string;
