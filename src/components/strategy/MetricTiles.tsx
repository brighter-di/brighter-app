import type { FC } from "react";
import type { Metrics } from "@/api/client";
import { Tooltip } from "@/components/ui/InfoTip";
import { pct } from "@/lib/format";

const Tile: FC<{ label: string; value: string; tip?: string; tone?: "pos" | "neg"; align?: "left" | "right" }> = ({ label, value, tip, tone, align }) => {
  const figure = (
    <span
      className={`font-mono text-xl font-semibold tabular-nums sm:text-2xl ${
        tone === "pos" ? "text-success" : tone === "neg" ? "text-danger" : "text-text-primary"
      }`}
    >
      {value}
    </span>
  );
  return (
    <div className="min-w-0">
      <div className="text-xs text-text-muted">{label}</div>
      <div className="mt-1">
        {tip ? (
          <Tooltip content={tip} align={align}>
            {figure}
          </Tooltip>
        ) : (
          figure
        )}
      </div>
    </div>
  );
};

/** The headline figures. The benchmark comparison and secondary ratios open on hover. */
export const MetricTiles: FC<{ metrics: Metrics; benchmark: Metrics | null; benchmarkTicker: string }> = ({ metrics: m, benchmark: b, benchmarkTicker }) => {
  const vs = (v: string) => (b ? `${benchmarkTicker} over the same period: ${v}.` : undefined);
  const ratios = `Volatility ${pct(m.volatility, 2, false)} a year, Sortino ${m.sortino.toFixed(2)}.`;
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
      <Tile label="Total return" value={pct(m.totalReturn, 2)} tone={m.totalReturn >= 0 ? "pos" : "neg"} tip={b ? vs(pct(b.totalReturn, 2)) : undefined} />
      <Tile label="Annualised" value={pct(m.cagr, 2)} tone={m.cagr >= 0 ? "pos" : "neg"} tip={b ? vs(pct(b.cagr, 2)) : undefined} align="right" />
      <Tile label="Max drawdown" value={pct(m.maxDrawdown, 2, false)} tone="neg" tip={b ? vs(pct(b.maxDrawdown, 2, false)) : undefined} />
      <Tile label="Sharpe" value={m.sharpe.toFixed(2)} tip={b ? `${benchmarkTicker} ${b.sharpe.toFixed(2)}. ${ratios}` : ratios} align="right" />
    </div>
  );
};
