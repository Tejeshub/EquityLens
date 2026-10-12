import { isNum } from "./format";

/** Percentage change from `prev` to `cur`; null unless both are finite and prev != 0. */
export function computedChange(cur: number | undefined, prev: number | undefined): number | null {
  if (!isNum(cur) || !isNum(prev) || prev === 0) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

/** The period exactly one calendar year before `iso` (YYYY-MM-DD), if present in `periods`. */
export function yearAgoPeriod(iso: string, periods: string[]): string | undefined {
  const y = Number(iso.slice(0, 4));
  if (!Number.isFinite(y)) return undefined;
  const target = `${y - 1}${iso.slice(4)}`;
  if (periods.includes(target)) return target;
  // Month-end dates can differ by a day or two (e.g. 28/29 Feb); match on year-month.
  return periods.find((p) => p.slice(0, 7) === target.slice(0, 7));
}
