// Y axes for growth-of-100 charts, shared by the strategy chart and the
// landing page.

import { pct } from "./format";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 0 });

/**
 * Whether a chart spanning min..max needs a log axis. A compounding
 * leveraged strategy grows by orders of magnitude, and on a linear axis all
 * but its last year would lie flat.
 */
export function needsLog(min: number, max: number): boolean {
  return min > 0 && max / min > 10;
}

/** Return decades between lo and hi, as growth-of-100 values: 0%, +100%, +1K%… */
export function logTicks(lo: number, hi: number): number[] {
  return [0.5, 1, 2, 11, 101, 1001, 10001, 100001].map((m) => m * 100).filter((v) => v >= lo && v <= hi);
}

/** A return as an axis label: "+40%", or "+10K%" once it runs to four digits. */
export function axisPct(r: number): string {
  return r >= 10 ? `+${compact.format(r * 100)}%` : pct(r, 0);
}
