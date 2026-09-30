import { type FC, type MouseEvent, useMemo, useRef, useState } from "react";
import type { PerformancePoint } from "@/api/client";
import { useElementWidth } from "@/hooks/useElementWidth";
import { formatDate, formatUsd, signedUsd } from "@/lib/format";

const H = 220;
const PL = 64;
const PR = 8;
const PT = 12;
const PB = 26;

const shortDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * A portfolio's value against the money put in; the gap between the lines is
 * profit. The value line draws itself in when the data arrives.
 */
export const ProfitChart: FC<{ points: PerformancePoint[] }> = ({ points }) => {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useElementWidth(wrap);
  const [hover, setHover] = useState<number | null>(null);
  const n = points.length;

  const g = useMemo(() => {
    if (width <= 0 || n < 2) return null;
    const all = points.flatMap((p) => [p.value, p.deposited]);
    const min = Math.min(...all);
    const max = Math.max(...all);
    const pad = (max - min) * 0.1 || Math.max(max * 0.02, 0.5);
    const lo = Math.max(0, min - pad);
    const hi = max + pad;
    const X = (i: number) => PL + (i / (n - 1)) * (width - PL - PR);
    const Y = (v: number) => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);
    const value = points.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(p.value).toFixed(1)}`).join("");
    // Deposits move in steps, on the days money goes in or out.
    const deposited = points
      .map((p, i) => (i ? `H${X(i).toFixed(1)}V${Y(p.deposited).toFixed(1)}` : `M${X(0).toFixed(1)} ${Y(p.deposited).toFixed(1)}`))
      .join("");
    const yTicks = [lo, (lo + hi) / 2, hi].map((v) => ({ y: Y(v), label: formatUsd(v) }));
    const xIdx = n <= 4 ? points.map((_, i) => i) : [0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1];
    return { X, Y, value, deposited, yTicks, xIdx };
  }, [width, points, n]);

  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
    const k = Math.round(((x - PL) / (width - PL - PR)) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, k)));
  };

  const cur = points[hover ?? n - 1];

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-text-secondary">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-accent" />
          Value
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed border-text-muted" />
          Deposited
        </span>
        {cur && (
          <span className="ml-auto text-text-muted">
            {formatDate(cur.date)}: <b className="font-mono font-semibold tabular-nums text-text-primary">{formatUsd(cur.value)}</b>{" "}
            <span className={`font-mono tabular-nums ${cur.profit >= 0 ? "text-success" : "text-danger"}`}>{signedUsd(cur.profit)}</span>
          </span>
        )}
      </div>
      <div ref={wrap} className="relative" style={{ height: H }}>
        {g && (
          <svg width={width} height={H} className="block" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label="Portfolio value against deposits">
            {g.yTicks.map((t, k) => (
              <g key={k}>
                <line x1={PL} x2={width - PR} y1={t.y} y2={t.y} stroke="var(--color-surface-border)" />
                <text x={PL - 8} y={t.y + 4} textAnchor="end" fontSize={11} fill="var(--color-text-muted)" fontFamily="var(--font-mono)">
                  {t.label}
                </text>
              </g>
            ))}
            {g.xIdx.map((k) => (
              <text
                key={k}
                x={g.X(k)}
                y={H - 6}
                textAnchor={k === 0 ? "start" : k === n - 1 ? "end" : "middle"}
                fontSize={11}
                fill="var(--color-text-muted)"
                fontFamily="var(--font-mono)"
              >
                {shortDate(points[k].date)}
              </text>
            ))}
            <path d={g.deposited} fill="none" stroke="var(--color-text-muted)" strokeWidth={1.5} strokeDasharray="4 4" />
            <path d={g.value} pathLength={1} className="line-draw" fill="none" stroke="var(--color-accent)" strokeWidth={2} strokeLinejoin="round" />
            {hover != null && (
              <>
                <line x1={g.X(hover)} x2={g.X(hover)} y1={PT} y2={H - PB} stroke="var(--color-surface-3)" />
                <circle cx={g.X(hover)} cy={g.Y(points[hover].value)} r={3.5} fill="var(--color-accent)" />
              </>
            )}
          </svg>
        )}
      </div>
    </div>
  );
};
