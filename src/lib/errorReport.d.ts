// Types for errorReport.js, so the phone app (TypeScript) can import it.
export type ErrorKind = 'render' | 'uncaught' | 'unhandled_rejection';
export type Platform = 'web' | 'ios' | 'android';

export interface ErrorReportRow {
  platform: Platform;
  app_version: string | null;
  route: string | null;
  kind: ErrorKind;
  message: string;
  stack: string | null;
  fingerprint: string;
}

export const MAX_MESSAGE: number;
export const MAX_STACK: number;
export const MAX_REPORTS_PER_SESSION: number;
export function redact(text: unknown): string;
export function cleanRoute(route: unknown): string | null;
export function fingerprint(kind: string, message: string, stack?: string | null): string;
export function buildReport(input: {
  platform: Platform;
  appVersion?: string | null;
  route?: string | null;
  kind: ErrorKind;
  error: unknown;
}): ErrorReportRow | null;
export function createReporter(options: {
  client: { from: (table: string) => any };
  platform: Platform;
  appVersion?: string | null;
  enabled: boolean;
}): (kind: ErrorKind, error: unknown, route?: string | null) => Promise<boolean>;
