// Performance statistics from an equity curve. Mirrors the backend's
// internal/metrics so an asset page, which assembles its own curve from
// yearly chunks, measures returns exactly the way backtests are measured.

import type { Metrics } from "@/api/client";

const TRADING_DAYS = 252;

export function computeMetrics(dates: string[], values: number[]): Metrics | null {
  const days: number[] = [];
  const v: number[] = [];
  values.forEach((x, i) => {
    if (x > 0 && Number.isFinite(x)) {
      days.push(Date.parse(dates[i]) / 86_400_000);
      v.push(x);
    }
  });
  if (v.length < 2) return null;

  const first = v[0];
  const last = v[v.length - 1];
  const years = (days[days.length - 1] - days[0]) / 365.25;
  let peak = first;
  let maxDrawdown = 0;
  for (const x of v) {
    peak = Math.max(peak, x);
    maxDrawdown = Math.min(maxDrawdown, x / peak - 1);
  }

  const rets = v.slice(1).map((x, i) => x / v[i] - 1);
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const sd = rets.length > 1 ? Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1)) : 0;
  const downDev = Math.sqrt(rets.reduce((s, r) => s + (r < 0 ? r * r : 0), 0) / rets.length);
  const annual = Math.sqrt(TRADING_DAYS);

  return {
    totalReturn: last / first - 1,
    cagr: years > 0 ? (last / first) ** (1 / years) - 1 : 0,
    maxDrawdown,
    volatility: sd * annual,
    sharpe: sd > 0 ? (mean / sd) * annual : 0,
    sortino: downDev > 0 ? (mean / downDev) * annual : 0,
  };
}
