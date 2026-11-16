export interface PriceStep { price: number; currency: string; changed_at: string; change: number | null }
export declare function priceSteps(rows: { price: number | string; currency: string | null; changed_at: string }[] | null | undefined): PriceStep[];
