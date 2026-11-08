export type Period = 'week' | 'month' | '3m' | '6m' | 'year' | 'all' | 'custom';
export const PERIODS: Period[];

export interface PeriodRange {
  from: Date | null;
  to: Date | null;
}
export function periodRange(period: Period, now?: Date, custom?: { from?: Date | null; to?: Date | null }): PeriodRange | null;

export function monthsActive(since: Date | string, now?: Date): number;

export interface BaselineComparison {
  previous: number | null;
  current: number;
  difference: number | null;
  percent: number | null;
}
export function compareToBaseline(previous: number | string | null | undefined, total: number, months: number): BaselineComparison;

export function parseEstimate(text: string | null | undefined): number | null | undefined;

export type AchievementKey = 'firstListing' | 'firstTransaction' | 'tenListings' | 'tenViewings' | 'tenTransactions';
export interface Achievement {
  key: AchievementKey;
  target: number;
  value: number;
  done: boolean;
  progress: number;
}
export function achievements(totals: { listings?: number; transactions?: number; viewings?: number } | null | undefined): Achievement[];

export interface MonthPoint {
  month: string;
  listings: number;
  transactions: number;
  viewings: number;
  inquiries: number;
}
export function recentMonths(monthly: MonthPoint[] | null | undefined, count?: number): MonthPoint[];
