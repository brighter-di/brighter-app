import type { FC } from "react";
import { Link } from "react-router-dom";
import type { StrategyCard as StrategyCardRow } from "@/api/client";
import { AssetLogo, LogoStack } from "@/components/ui/AssetLogo";
import { Tooltip } from "@/components/ui/InfoTip";
import { Pill } from "@/components/ui/Pill";
import { StrategyGlyph } from "@/components/ui/StrategyGlyph";
import { Sparkline } from "./PerformanceChart";
import { bps, cadenceLabel, pct, periodLabel, tokenSymbol } from "@/lib/format";
import type { Period } from "@/lib/catalogueFilters";

const CARD = "flex flex-col border-t border-surface-border py-6 first:border-t-0 md:[&:nth-child(2)]:border-t-0";

/** A strategy in the list. One row of the catalogue, already filtered and
 *  ordered by the backend; the period is whichever tab the reader is on. */
export const StrategyCard: FC<{ strategy: StrategyCardRow; period: Period; loading: boolean }> = ({ strategy: t, period, loading }) => {
  const bt = t.backtest;
  const lines = t.target?.lines ?? [];

  // The logos open what the strategy holds right now.
  const holdings =
    lines.length > 0 ? (
      <span className="block">
        <span className="mb-1.5 block font-medium text-text-primary">Holding now</span>
        {lines.map((l) => (
          <span key={l.ticker} className="flex items-center gap-2 py-0.5">
            <AssetLogo src={l.icon} symbol={tokenSymbol(l.ondoSymbol || l.ticker)} size={16} />
            <span className="flex-1 text-text-primary">{tokenSymbol(l.ondoSymbol || l.ticker)}</span>
            <span className="font-mono tabular-nums">{bps(l.bps)}</span>
          </span>
        ))}
      </span>
    ) : loading ? (
      "Loading the current allocation."
    ) : (
      "The current allocation is unavailable."
    );

  return (
    <Link to={`/strategies/${t.id}`} className={`group ${CARD}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3.5">
          <StrategyGlyph id={t.id} size={36} />
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-text-primary transition-colors group-hover:text-accent">{t.name}</h2>
            <p className="mt-1 line-clamp-2 text-sm leading-snug text-text-secondary" title={t.thesis}>{t.thesis}</p>
            <p className="mt-2 text-xs text-text-muted" title={t.author}>By {t.author?.startsWith("0x") ? `${t.author.slice(0, 6)}…${t.author.slice(-4)}` : t.author || "Brighter"}</p>
          </div>
        </div>
        <Pill>{cadenceLabel(t.cadence)}</Pill>
      </div>

      <div className="mt-4">
        <div className="text-xs text-text-muted">{periodLabel(period)} backtest</div>
        {bt ? (
          <div className="mt-0.5">
            <span className={`font-mono text-2xl font-semibold tabular-nums ${bt.totalReturn >= 0 ? "text-success" : "text-danger"}`}>{pct(bt.totalReturn, 0)}</span>
          </div>
        ) : loading ? (
          <div className="mt-1.5 h-6 w-28 animate-pulse bg-surface-2" />
        ) : (
          <div className="mt-1 text-xs text-text-muted">Unavailable</div>
        )}
      </div>

      <div className="mt-3">
        {bt ? <Sparkline strategy={bt.series.strategy} benchmark={bt.series.benchmark} /> : <div className={`h-14 ${loading ? "animate-pulse bg-surface-1" : ""}`} />}
      </div>

      <div className="mt-4">
        <Tooltip content={holdings} focusable={false}>
          <LogoStack items={t.assets.map((a) => ({ src: a.icon, symbol: tokenSymbol(a.ondoSymbol || a.ticker) }))} />
        </Tooltip>
      </div>
    </Link>
  );
};

/** A card's outline while the list loads, so nothing jumps when it arrives. */
export const StrategyCardSkeleton: FC = () => (
  <div aria-hidden className={CARD}>
    <div className="flex gap-3.5">
      <div className="h-9 w-9 shrink-0 animate-pulse rounded-md bg-surface-2" />
      <div className="flex-1 space-y-2">
        <div className="h-5 w-2/5 animate-pulse bg-surface-2" />
        <div className="h-4 w-full animate-pulse bg-surface-1" />
        <div className="h-4 w-4/5 animate-pulse bg-surface-1" />
      </div>
    </div>
    <div className="mt-5 h-3 w-24 animate-pulse bg-surface-1" />
    <div className="mt-1.5 h-6 w-28 animate-pulse bg-surface-2" />
    <div className="mt-3 h-14 animate-pulse bg-surface-1" />
    <div className="mt-4 h-6 w-32 animate-pulse bg-surface-1" />
  </div>
);
