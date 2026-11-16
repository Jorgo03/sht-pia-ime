export type DisplayCurrency = 'ALL' | 'EUR' | 'USD' | 'GBP';
export declare const DISPLAY_CURRENCIES: readonly DisplayCurrency[];
export declare function isDisplayCurrency(c: unknown): c is DisplayCurrency;
export declare function convertAmount(
  amount: number | string | null | undefined,
  from: string | null | undefined,
  to: string | null | undefined,
  rates: Record<string, number> | null | undefined,
): number | null;
export declare function roundConverted(value: number): number;
export declare function ratesMap(rows: { currency: string; per_eur: number | string }[] | null | undefined): Record<string, number>;
