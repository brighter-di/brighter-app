// Shared number/currency/date formatters. Figures render in the mono face
// with tabular numerals at the call site; these only produce strings.

/**
 * Safe coercion for portfolio engine fields, which arrive as decimal strings. Anything
 * unparseable → 0 so it drops out of aggregation instead of poisoning a sum.
 */
export function toNumber(v: number | string | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** $1,234.56 below $10K; $12.3K / $1.23M / $1.23B above. */
export function formatUsd(value: number | string | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs < 10_000) {
    return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (abs < 1_000_000) return `${sign}$${(abs / 1_000).toFixed(abs < 100_000 ? 1 : 0)}K`;
  if (abs < 1_000_000_000) return `${sign}$${(abs / 1_000_000).toFixed(abs < 100_000_000 ? 2 : 1)}M`;
  return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
}

/** Signed dollars: +$5.00 / −$3.20. */
export function signedUsd(v: number): string {
  return `${v >= 0 ? "+" : "−"}${formatUsd(Math.abs(v))}`;
}

/** Compact token balance. */
export function formatBalance(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (value === 0) return "0";
  if (value < 0.0001) return value.toExponential(2);
  if (value < 1) return value.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  if (value < 10_000) return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (value < 1_000_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${(value / 1_000_000).toFixed(2)}M`;
}

const compactPct = new Map<number, Intl.NumberFormat>();

/**
 * Fraction → percent in US notation, two decimals by default: 0.2635 →
 * "+26.35%". From 1,000% up it turns compact — 2482.183 → "+248.22K%" — so a
 * thousands comma is never misread as a decimal one.
 */
export function pct(x: number | null | undefined, digits = 2, signed = true): string {
  if (x == null || !Number.isFinite(x)) return "—";
  const v = x * 100;
  const opts = { minimumFractionDigits: digits, maximumFractionDigits: digits };
  let s: string;
  if (Math.abs(v) >= 1000) {
    let f = compactPct.get(digits);
    if (!f) compactPct.set(digits, (f = new Intl.NumberFormat("en-US", { notation: "compact", ...opts })));
    s = f.format(v);
  } else {
    s = v.toLocaleString("en-US", opts);
  }
  return `${signed && x > 0 ? "+" : ""}${s}%`;
}

/** Basis points → percent: 3333 → "33.33%". Two decimals is the app-wide weight format. */
export function bps(n: number, digits = 2): string {
  return `${(n / 100).toFixed(digits)}%`;
}

/**
 * A token as people name it: Ondo's tokens carry an "on" suffix (NVDAon), the
 * underlying security does not. Anything else (USDT) is left alone.
 */
export function tokenSymbol(symbol: string | null | undefined): string {
  if (!symbol) return "";
  return /^[A-Z.]{1,6}on$/.test(symbol) ? symbol.slice(0, -2) : symbol;
}

export function shortAddr(addr: string | null | undefined): string {
  if (!addr) return "—";
  const tail = addr.split(":").pop() ?? addr;
  return tail.length > 12 ? `${tail.slice(0, 6)}…${tail.slice(-4)}` : tail;
}

/** "2026-09-04" → "Sep 4, 2026" (dates are calendar dates; no timezone shift). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  return t.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const CADENCE: Record<string, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

/** How often a strategy's rules re-decide its allocation. */
export function cadenceLabel(cadence: string): string {
  return CADENCE[cadence] ?? cadence;
}

const PERIOD: Record<string, string> = { "1y": "1-year", "3y": "3-year", "5y": "5-year" };

/** How a card names the window its figure covers. */
export function periodLabel(period: string): string {
  return PERIOD[period] ?? period;
}

const FREQUENCY: Record<string, string> = {
  hourly: "every hour",
  daily: "once a day",
  weekly: "once a week",
  monthly: "once a month",
};

/** Human description of the rebalance schedule new portfolios run on. */
export function describeSchedule(s: { type: string; frequency?: string; cron?: string; timezone?: string } | undefined): string {
  if (!s) return "on schedule";
  if (s.type === "interval") return FREQUENCY[s.frequency ?? ""] ?? "on schedule";
  const tz = s.timezone ?? "UTC";
  const city = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
  const m = (s.cron ?? "").match(/^(\d{1,2}) (\d{1,2}) \* \* 1-5$/);
  if (m) {
    const hh = Number(m[2]);
    const mm = m[1].padStart(2, "0");
    const h12 = ((hh + 11) % 12) + 1;
    return `weekdays at ${h12}:${mm} ${hh < 12 ? "AM" : "PM"} ${city} time`;
  }
  return `on the schedule "${s.cron}" (${tz})`;
}
