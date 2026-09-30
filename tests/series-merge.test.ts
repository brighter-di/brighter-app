import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { Backtest, Performance, PerformancePoint } from "../src/api/client.ts";
import { backtestSince, downsample, mergeBacktest, mergePerformance, performanceSince } from "../src/lib/seriesMerge.ts";

const metrics = { totalReturn: 0, cagr: 0, maxDrawdown: 0, volatility: 0, sharpe: 0, sortino: 0 };
const day = (n: number) => `2026-01-${String(n).padStart(2, "0")}`;

function backtest(startDate: string, first: number, strategy: number[], benchmark: (number | null)[]): Backtest {
  const dates = strategy.map((_, i) => day(first + i));
  return {
    source: "backtest", templateId: "t", params: {}, paramsKey: "", range: "1y", startDate, endDate: dates.at(-1)!,
    metrics, benchmark: { ticker: "SPY", metrics: null }, series: { dates, strategy, benchmark }, computedAt: "",
  };
}

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test("a backtest tail is rescaled onto the held days and the window slides to the new start", () => {
  // Held: days 1–6, +10% a day. Today's window starts on day 2; the tail
  // repeats days 4–6 rebased to 100 and adds day 7.
  const held = backtest(day(1), 1, [100, 110, 121, 133.1, 146.41, 161.051], [100, 100, 100, 100, 100, 100]);
  assert.equal(backtestSince(held), day(1));
  const tail = { ...backtest(day(2), 4, [100, 110, 121, 133.1], [50, 50, null, 50]), metrics: { ...metrics, sharpe: 2 } };

  const merged = mergeBacktest(held, tail)!;
  assert.deepEqual(merged.series.dates, [2, 3, 4, 5, 6, 7].map(day));
  merged.series.strategy.forEach((v, i) => close(v, 100 * 1.1 ** i));
  assert.deepEqual(merged.series.benchmark, [100, 100, 100, 100, null, 100]);
  assert.equal(merged.metrics.sharpe, 2, "metrics come from the backend's full-range answer");
});

test("a tail that disagrees with the held days, or shares none of them, is refused", () => {
  const held = backtest(day(1), 1, [100, 110, 121], [100, 100, 100]);
  assert.equal(mergeBacktest(held, backtest(day(1), 2, [100, 130, 140], [1, 1, 1])), null);
  assert.equal(mergeBacktest(held, backtest(day(1), 9, [100, 110], [1, 1])), null);
  assert.equal(mergeBacktest(backtest(day(3), 3, [100, 110], [1, 1]), backtest(day(1), 3, [100, 110], [1, 1])), null);
});

test("downsampling keeps the last point", () => {
  const b = backtest(day(1), 1, Array.from({ length: 25 }, (_, i) => 100 + i), Array(25).fill(null));
  const d = downsample(b, 10);
  assert.equal(d.series.dates.at(-1), day(25));
  assert.ok(d.series.dates.length <= 11);
  assert.equal(downsample(b, 30), b);
});

const point = (n: number, deposited: number, live = false): PerformancePoint => ({ date: day(n), value: deposited, deposited, profit: 0, return: null, live });
const perf = (points: PerformancePoint[]): Performance => ({ method: "MWR", asOf: "", points });

test("performance points are replaced from the first re-requested settled day", () => {
  const held = perf([point(1, 100), point(2, 100), point(3, 150, true)]);
  assert.equal(performanceSince(held), day(1));
  assert.equal(performanceSince(perf([point(1, 1, true)])), null);

  const merged = mergePerformance(held, perf([point(2, 100), point(3, 150), point(4, 150, true)]), day(2))!;
  assert.deepEqual(merged.points.map((p) => [p.date, p.live]), [[day(1), false], [day(2), false], [day(3), false], [day(4), true]]);

  assert.equal(mergePerformance(held, perf([point(2, 90)]), day(2)), null, "settled deposits changed");
  assert.equal(mergePerformance(held, perf([point(3, 150)]), day(2)), null, "the anchor day disappeared");
});
