// Joins a series this browser already holds with the newest days the backend
// sends after it. Pure, so the rules are tested without a browser. Each merge
// returns null when the two don't line up; the caller then fetches in full.

import type { Backtest, Performance } from "@/api/client";

/** Days re-requested before the newest one held, in case the latest closes were revised. */
export const OVERLAP = 5;

/** Largest drift allowed across the overlap before the held series is distrusted. */
const TOLERANCE = 0.005;

/** The day to ask the backend from: a few days before the newest one held. */
export function backtestSince(held: Backtest): string {
  const dates = held.series.dates;
  return dates[Math.max(0, dates.length - 1 - OVERLAP)];
}

/**
 * Appends a backtest tail to the held series. The tail comes from today's
 * backtest of the same range, so its metrics, dates and window are the
 * authoritative ones; the held days only supply the curve before it. Values
 * are rescaled at the first shared day and the window is rebased to 100 at
 * the backend's start date, as a full response is.
 */
export function mergeBacktest(held: Backtest, tail: Backtest): Backtest | null {
  const h = held.series;
  const t = tail.series;
  if (t.dates.length === 0 || h.dates.length === 0 || h.dates[0] > tail.startDate) return null;
  const at = h.dates.indexOf(t.dates[0]);
  if (at < 0) return null;

  const k = h.strategy[at] / t.strategy[0];
  if (!(k > 0) || !Number.isFinite(k)) return null;
  const hb = h.benchmark[at];
  const tb = t.benchmark[0];
  const kb = hb != null && tb != null && tb > 0 ? hb / tb : null;

  // The overlap must agree once scaled: otherwise the rules or the data
  // behind the held days have changed.
  for (let j = 0; j < t.dates.length && at + j < h.dates.length; j++) {
    if (h.dates[at + j] !== t.dates[j]) return null;
    if (Math.abs((t.strategy[j] * k) / h.strategy[at + j] - 1) > TOLERANCE) return null;
  }

  const dates = [...h.dates.slice(0, at), ...t.dates];
  const strategy = [...h.strategy.slice(0, at), ...t.strategy.map((v) => v * k)];
  const benchmark = [...h.benchmark.slice(0, at), ...t.benchmark.map((v) => (v == null || kb == null ? null : v * kb))];

  const from = dates.indexOf(tail.startDate);
  if (from < 0) return null;
  const sBase = strategy[from];
  const bBase = benchmark[from];
  return {
    ...tail,
    series: {
      dates: dates.slice(from),
      strategy: strategy.slice(from).map((v) => (100 * v) / sBase),
      benchmark: benchmark.slice(from).map((v) => (v == null || bBase == null ? null : (100 * v) / bBase)),
    },
  };
}

/** Keeps at most n points, always the last. Mirrors the backend's Downsample. */
export function downsample(b: Backtest, n: number): Backtest {
  const total = b.series.dates.length;
  if (n <= 1 || total <= n) return b;
  const step = Math.ceil(total / n);
  const keep: number[] = [];
  for (let i = 0; i < total; i += step) keep.push(i);
  if (keep.at(-1) !== total - 1) keep.push(total - 1);
  return {
    ...b,
    series: {
      dates: keep.map((i) => b.series.dates[i]),
      strategy: keep.map((i) => b.series.strategy[i]),
      benchmark: keep.map((i) => b.series.benchmark[i]),
    },
  };
}

/** The day to ask from: a few settled days back. Null when nothing settled is held. */
export function performanceSince(held: Performance): string | null {
  const settled = held.points.filter((p) => !p.live);
  return settled.length ? settled[Math.max(0, settled.length - 1 - OVERLAP)].date : null;
}

/**
 * Replaces the held points from `since` on. Deposits accumulate over the
 * whole history, so a settled day that disagrees with the tail means the
 * history itself changed.
 */
export function mergePerformance(held: Performance, tail: Performance, since: string): Performance | null {
  if (tail.points[0]?.date !== since) return null;
  const byDate = new Map(held.points.map((p) => [p.date, p]));
  for (const p of tail.points) {
    const was = byDate.get(p.date);
    if (was && !was.live && Math.abs(was.deposited - p.deposited) > 0.01) return null;
  }
  return { ...tail, points: [...held.points.filter((p) => p.date < since), ...tail.points] };
}
