// Types for data-report.js, so the phone app can import it.
import type { Sheet } from './xlsx';

type Row = Record<string, unknown>;
type Translate = (key: string, options?: Record<string, unknown>) => string;

export interface ReportArgs {
  userId: string;
  email?: string | null;
  sections: Record<string, Row[]>;
  titles?: Record<string, string>;
  t: Translate;
  now?: Date;
}
export interface JourneyEvent {
  at: string;
  kind: string;
  detail: string;
  status?: string;
}
export function readableDate(value: unknown): string;
export function tableRows(rows: Row[]): unknown[][];
export function journeyEvents(userId: string, sections: Record<string, Row[]>, titles?: Record<string, string>): JourneyEvent[];
export const REPORT_SECTIONS: string[];
export function reportSheets(args: ReportArgs): Sheet[];
export function buildReport(args: ReportArgs): Uint8Array;
export function reportFileName(now?: Date): string;
