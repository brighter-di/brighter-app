// An asset's price history for its page, loaded one calendar year at a time,
// newest first, each year asked for only once the one after it has arrived.
// That is slower in total than asking for every year at once, on purpose:
// the chart appears with the newest year almost immediately and then grows
// back through time piece by piece. Past years are final, so they are cached
// for good and switching from 1Y to 5Y only fetches the years not yet seen.

import { useQueries, useQueryClient } from "@tanstack/react-query";
import { api, type Closes, type Metrics, type Quote } from "@/api/client";
import { computeMetrics } from "@/lib/metrics";

const BENCHMARK = "SPY";

export interface AssetSeries {
  dates: string[];
  strategy: number[];
  benchmark: (number | null)[];
  /** "" when the asset is the benchmark itself. */
  benchmarkTicker: string;
  metrics: Metrics | null;
  benchmarkMetrics: Metrics | null;
  quote: Quote | null;
  /** Every year of the range has been asked for and answered, or failed. */
  settled: boolean;
  /** The newest year could not be loaded. */
  error: unknown;
}

const closesKey = (ticker: string, year: number) => ["closes", ticker, year] as const;

/** The unbroken run of loaded years, newest first. A gap ends the run. */
function loadedRun(results: { data?: Closes }[]): Closes[] {
  const out: Closes[] = [];
  for (const r of results) {
    if (!r.data) break;
    out.push(r.data);
  }
  return out;
}

export function useAssetSeries(ticker: string | undefined, years: number): AssetSeries {
  const qc = useQueryClient();
  const today = new Date();
  const currentYear = today.getUTCFullYear();
  const start = new Date(Date.UTC(currentYear - years, today.getUTCMonth(), today.getUTCDate())).toISOString().slice(0, 10);
  const yearList = Array.from({ length: years + 1 }, (_, i) => currentYear - i);
  const withBench = !!ticker && ticker !== BENCHMARK;

  // A year is asked for once the year after it has an answer (or an error):
  // one piece at a time, newest first.
  const chain = (t: string, on: boolean) =>
    yearList.map((y, k) => {
      const prev = k === 0 ? null : qc.getQueryState(closesKey(t, yearList[k - 1]));
      return {
        queryKey: closesKey(t, y),
        queryFn: () => api.closes(t, y),
        enabled: on && (k === 0 || prev?.status === "success" || prev?.status === "error"),
        // A past year never changes; the current one grows after each close.
        staleTime: y === currentYear ? 5 * 60_000 : Infinity,
      };
    });
  const asset = useQueries({ queries: chain(ticker ?? "", !!ticker) });
  const bench = useQueries({ queries: chain(BENCHMARK, withBench) });

  const dates: string[] = [];
  const closes: number[] = [];
  for (const chunk of loadedRun(asset).reverse()) {
    chunk.dates.forEach((d, i) => {
      if (d >= start) {
        dates.push(d);
        closes.push(chunk.closes[i]);
      }
    });
  }
  const benchClose = new Map<string, number>();
  if (withBench) for (const chunk of loadedRun(bench)) chunk.dates.forEach((d, i) => benchClose.set(d, chunk.closes[i]));

  // Both lines start at 100 on the first day both have a close.
  const first = benchClose.size > 0 ? Math.max(0, dates.findIndex((d) => benchClose.has(d))) : 0;
  const d = dates.slice(first);
  const c = closes.slice(first);
  const bBase = d.length > 0 ? benchClose.get(d[0]) : undefined;
  const strategy = c.map((x) => (100 * x) / c[0]);
  const benchmark = d.map((day) => {
    const b = benchClose.get(day);
    return b != null && bBase ? (100 * b) / bBase : null;
  });

  const answered = (qs: { status: string }[]) => qs.every((q) => q.status === "success" || q.status === "error");
  const settled = !!ticker && answered(asset) && (!withBench || answered(bench));
  let benchmarkMetrics: Metrics | null = null;
  if (settled && withBench) {
    const bd: string[] = [];
    const bv: number[] = [];
    benchmark.forEach((v, i) => {
      if (v != null) {
        bd.push(d[i]);
        bv.push(v);
      }
    });
    benchmarkMetrics = computeMetrics(bd, bv);
  }

  const n = closes.length;
  const quote: Quote | null =
    n >= 2 ? { price: closes[n - 1], change: closes[n - 1] - closes[n - 2], changePct: closes[n - 1] / closes[n - 2] - 1, asOf: dates[n - 1] } : null;

  return {
    dates: d,
    strategy,
    benchmark,
    benchmarkTicker: withBench ? BENCHMARK : "",
    metrics: settled ? computeMetrics(d, strategy) : null,
    benchmarkMetrics,
    quote,
    settled,
    error: asset[0]?.error ?? null,
  };
}
