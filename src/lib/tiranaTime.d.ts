// Types for tiranaTime.js, so the phone app (TypeScript) can import it.
export const VIEWING_TIME_ZONE: 'Europe/Tirane';
export function tiranaParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number };
export function tiranaOffsetMinutes(date: Date): number;
export function fromTiranaWallTime(year: number, month: number, day: number, hour: number, minute: number): Date;
export function tiranaWallAsLocal(instant: Date): Date;
export function localWallAsTirana(local: Date): Date;
export function deviceUsesTiranaTime(instant?: Date): boolean;
export function tiranaDayStart(now?: Date): Date;
export function formatViewingClock(iso: string | null | undefined): string;
export function formatViewingWhen(iso: string | null | undefined): string;
