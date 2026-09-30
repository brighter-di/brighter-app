// Strategy vs benchmark, rebased to 100 at the first common day, on ONE
// y-scale — never two. The strategy takes the accent; the benchmark is a
// recessive neutral because it is a reference line, not a peer series. A
// drawdown strip underneath shows the cost of the ride.

import { type FC, type MouseEvent, useMemo, useRef, useState } from "react";
import { useElementWidth } from "@/hooks/useElementWidth";
import { formatDate, pct } from "@/lib/format";
import { axisPct, logTicks, needsLog } from "@/lib/axis";

interface Props {
  dates: string[];
  strategy: number[];
  benchmark: (number | null)[];
  strategyLabel: string;
  benchmarkLabel: string;
  height?: number;
  /** Draw the main line in when it first appears. */
  animate?: boolean;
}

const PL = 48;
const PR = 12;
const PT = 10;
const PB = 22;
const DD_H = 64;

export const PerformanceChart: FC<Props> = ({ dates, strategy, benchmark, strategyLabel, benchmarkLabel, height = 260, animate = false }) => {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useElementWidth(wrap);
  const [hover, setHover] = useState<number | null>(null);
  const n = strategy.length;

  const g = useMemo(() => {
    if (width < 120 || n < 2) return null;
    const vals = [...strategy, ...benchmark.filter((v): v is number => v != null)];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const log = needsLog(min, max);
    const f = (v: number) => (log ? Math.log(v) : v);
    let lo = f(min);
    let hi = f(max);
    const pad = (hi - lo) * 0.06 || 1;
    lo -= pad;
    hi += pad;
    const innerW = width - PL - PR;
    const X = (i: number) => PL + (i / (n - 1)) * innerW;
    const Y = (v: number) => PT + (1 - (f(v) - lo) / (hi - lo)) * (height - PT - PB);

    const path = (arr: (number | null)[]) => {
      let d = "";
      let pen = false;
      arr.forEach((v, i) => {
        if (v == null) {
          pen = false;
          return;
        }
        d += `${pen ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`;
        pen = true;
      });
      return d;
    };

    // Y ticks: return decades on a log axis, a "nice" step otherwise.
    let tickValues: number[] = [];
    if (log) {
      tickValues = logTicks(Math.exp(lo), Math.exp(hi));
    } else {
      const raw = (hi - lo) / 4;
      const mag = Math.pow(10, Math.floor(Math.log10(raw)));
      const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
      for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) tickValues.push(v);
    }
    const yTicks = tickValues.map((v) => ({ v, label: axisPct(v / 100 - 1) }));

    // X ticks at year boundaries, or every other month on short ranges.
    const spanDays = (Date.parse(dates[n - 1]) - Date.parse(dates[0])) / 864e5;
    const xTicks: { i: number; label: string }[] = [];
    for (let i = 1; i < n; i++) {
      const a = dates[i - 1];
      const b = dates[i];
      if (spanDays > 500) {
        if (a.slice(0, 4) !== b.slice(0, 4)) xTicks.push({ i, label: b.slice(0, 4) });
      } else if (a.slice(0, 7) !== b.slice(0, 7) && Number(b.slice(5, 7)) % 2 === 1) {
        xTicks.push({ i, label: new Date(b + "T00:00:00Z").toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) });
      }
    }

    let peak = -Infinity;
    const dd = strategy.map((v) => {
      peak = Math.max(peak, v);
      return v / peak - 1;
    });
    const ddLo = Math.min(...dd, -0.01);
    const DY = (v: number) => 4 + (v / ddLo) * (DD_H - 12);
    const ddLine = dd.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${DY(v).toFixed(1)}`).join("");
    const ddArea = `${ddLine}L${X(n - 1).toFixed(1)} 4L${X(0).toFixed(1)} 4Z`;

    return { X, Y, yTicks, xTicks, sPath: path(strategy), bPath: path(benchmark), dd, ddLo, DY, ddLine, ddArea, innerW };
  }, [width, n, strategy, benchmark, dates, height]);

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!g) return;
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
    const i = Math.round(((x - PL) / g.innerW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  const hi = hover ?? n - 1;
  const sRet = strategy[hi] / 100 - 1;
  const bVal = benchmark[hi];
  const bRet = bVal != null ? bVal / 100 - 1 : null;
  const hasBench = benchmark.some((v) => v != null);

  return (
    <div ref={wrap} className="w-full select-none">
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
        <span className="flex items-center gap-1.5 text-text-secondary">
          <span className="h-0.5 w-4 rounded bg-accent" />
          {strategyLabel}
          <b className="font-mono font-semibold tabular-nums text-text-primary">{pct(sRet, 2)}</b>
        </span>
        {hasBench && (
          <span className="flex items-center gap-1.5 text-text-secondary">
            <span className="w-4 border-t-2 border-dashed border-text-secondary" />
            {benchmarkLabel}
            <b className="font-mono font-semibold tabular-nums text-text-primary">{pct(bRet, 2)}</b>
          </span>
        )}
        <span className="ml-auto text-[11px] text-text-muted">
          {hover != null ? formatDate(dates[hi]) : `${formatDate(dates[0])} – ${formatDate(dates[n - 1])}`}
        </span>
      </div>

      {g ? (
        <>
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`${strategyLabel} against ${benchmarkLabel}, indexed to 100`}
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
            className="block"
          >
            {g.yTicks.map((t) => (
              <g key={t.v}>
                <line x1={PL} x2={width - PR} y1={g.Y(t.v)} y2={g.Y(t.v)} stroke="var(--color-surface-border)" />
                <text x={PL - 8} y={g.Y(t.v) + 3.5} textAnchor="end" fontSize={10.5} fill="var(--color-text-muted)" fontFamily="var(--font-mono)">
                  {t.label}
                </text>
              </g>
            ))}
            {g.xTicks.map((t) => (
              <text key={t.i} x={g.X(t.i)} y={height - 6} textAnchor="middle" fontSize={10.5} fill="var(--color-text-muted)" fontFamily="var(--font-mono)">
                {t.label}
              </text>
            ))}
            <path d={g.bPath} fill="none" stroke="var(--color-text-secondary)" strokeWidth={1.5} strokeDasharray="4 3" />
            <path
              d={g.sPath}
              pathLength={animate ? 1 : undefined}
              className={animate ? "line-draw" : undefined}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {hover != null && (
              <>
                <line x1={g.X(hi)} x2={g.X(hi)} y1={PT} y2={height - PB} stroke="var(--color-surface-3)" />
                {bVal != null && <circle cx={g.X(hi)} cy={g.Y(bVal)} r={3} fill="var(--color-text-secondary)" stroke="var(--color-surface-0)" strokeWidth={1.5} />}
                <circle cx={g.X(hi)} cy={g.Y(strategy[hi])} r={3.5} fill="var(--color-accent)" stroke="var(--color-surface-0)" strokeWidth={1.5} />
              </>
            )}
          </svg>
          <div className="mb-1 mt-3 flex items-center justify-between text-[11px] text-text-muted">
            <span>Drawdown from peak</span>
            <span className="font-mono tabular-nums">{pct(hover != null ? g.dd[hi] : Math.min(...g.dd), 2, false)}</span>
          </div>
          <svg width={width} height={DD_H} aria-hidden className="block">
            <path d={g.ddArea} fill="var(--color-danger)" opacity={0.12} />
            <path d={g.ddLine} fill="none" stroke="var(--color-danger)" strokeWidth={1.25} />
            <line x1={PL} x2={width - PR} y1={4} y2={4} stroke="var(--color-surface-3)" />
            <text x={PL - 8} y={g.DY(g.ddLo) + 3} textAnchor="end" fontSize={10} fill="var(--color-text-muted)" fontFamily="var(--font-mono)">
              {pct(g.ddLo, 0, false)}
            </text>
            {hover != null && <line x1={g.X(hi)} x2={g.X(hi)} y1={4} y2={DD_H} stroke="var(--color-surface-3)" />}
          </svg>
        </>
      ) : (
        <div style={{ height: height + DD_H + 28 }} />
      )}
    </div>
  );
};

/** Tiny two-line chart for cards. */
export const Sparkline: FC<{ strategy: number[]; benchmark: (number | null)[]; height?: number }> = ({ strategy, benchmark, height = 56 }) => {
  const W = 240;
  const n = strategy.length;
  if (n < 2) return <div style={{ height }} />;
  const vals = [...strategy, ...benchmark.filter((v): v is number => v != null)];
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const X = (i: number) => (i / (n - 1)) * W;
  const Y = (v: number) => 3 + (1 - (v - lo) / (hi - lo || 1)) * (height - 6);
  const path = (arr: (number | null)[]) =>
    arr.reduce<{ d: string; pen: boolean }>(
      (acc, v, i) => (v == null ? { d: acc.d, pen: false } : { d: `${acc.d}${acc.pen ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`, pen: true }),
      { d: "", pen: false },
    ).d;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" width="100%" height={height} aria-hidden className="block">
      <path d={path(benchmark)} fill="none" stroke="var(--color-text-muted)" strokeWidth={1.25} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      <path d={path(strategy)} fill="none" stroke="var(--color-accent)" strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
    </svg>
  );
};
