import { type FC, useCallback, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { Params, Range, Template } from "@/api/client";
import { useBacktest, useConfig, useTarget, useTemplate } from "@/hooks/queries";
import { useDebounced } from "@/hooks/useDebounced";
import { useTitle } from "@/hooks/useTitle";
import { coerceParams, describeRules, isDefault } from "@/lib/params";
import { cadenceLabel, formatDate, tokenSymbol } from "@/lib/format";
import { friendlyError } from "@/lib/errors";
import { CURRENT_ALLOCATION } from "@/lib/copy";
import { PerformanceChart } from "@/components/strategy/PerformanceChart";
import { MetricTiles } from "@/components/strategy/MetricTiles";
import { AllocationTable } from "@/components/strategy/AllocationTable";
import { ParamControls } from "@/components/strategy/ParamControls";
import { InvestPanel } from "@/components/strategy/InvestPanel";
import { AssetLogo } from "@/components/ui/AssetLogo";
import { Pill } from "@/components/ui/Pill";
import { RangeTabs } from "@/components/ui/RangeTabs";
import { StrategyGlyph } from "@/components/ui/StrategyGlyph";
import { Spinner } from "@/components/ui/Spinner";
import { InfoTip, Tooltip } from "@/components/ui/InfoTip";

const RANGES: Range[] = ["1y", "3y", "5y", "10y"];

/** Studio opens the strategy with the values this page shows. */
function studioLink(t: Template, params: Params): string {
  const q = new URLSearchParams({ strategy: t.id });
  for (const s of t.params) q.set(s.key, String(params[s.key] ?? s.default));
  return `https://studio.brighter.fi/?${q}`;
}

export const StrategyDetail: FC = () => {
  const { id } = useParams<{ id: string }>();
  const { template, isLoading, error } = useTemplate(id);
  useTitle(template?.name);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error || !template) {
    return (
      <div className="space-y-3">
        <Link to="/strategies" className="text-sm text-text-muted hover:text-accent">
          ← All strategies
        </Link>
        <p className="text-sm text-danger">{error ? friendlyError(error) : "Strategy not found."}</p>
      </div>
    );
  }
  return <Detail template={template} />;
};

const Detail: FC<{ template: Template }> = ({ template: t }) => {
  const [search, setSearch] = useSearchParams();
  const params = useMemo(() => coerceParams(t, (k) => search.get(k)), [t, search]);
  const [range, setRange] = useState<Range>("5y");

  // Sliders update the URL immediately; the network only sees the value once
  // the user stops dragging.
  const setParams = useCallback(
    (p: Params) => {
      const next = new URLSearchParams(search);
      for (const s of t.params) {
        if (p[s.key] === s.default) next.delete(s.key);
        else next.set(s.key, String(p[s.key]));
      }
      setSearch(next, { replace: true });
    },
    [search, setSearch, t.params],
  );
  const query = useDebounced(params, 350);

  const config = useConfig();
  const bt = useBacktest(t, query, range);
  const target = useTarget(t, query);
  const stale = bt.isPlaceholderData || target.isPlaceholderData;

  return (
    <div className="space-y-8">
      <div>
        <Link to="/strategies" className="text-sm text-text-muted hover:text-accent">
          ← All strategies
        </Link>
        <div className="mt-4 flex items-start gap-4">
          <StrategyGlyph id={t.id} size={48} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold text-text-primary sm:text-3xl">{t.name}</h1>
                <Pill>{cadenceLabel(t.cadence)}</Pill>
                {!isDefault(t, params) && <Pill tone="accent">Custom parameters</Pill>}
              </div>
              {/* Pinned to the top of the heading row, not the title's baseline. */}
              <div className="ml-auto flex shrink-0 flex-col items-end gap-2">
                <p className="text-sm leading-none text-text-muted" title={t.author}>By {t.author?.startsWith("0x") ? `${t.author.slice(0, 6)}…${t.author.slice(-4)}` : t.author || "Brighter"}</p>
                {/* Only strategies written in Studio carry rules it can open. */}
                {t.rules && (
                  <a href={studioLink(t, params)} className="text-sm font-medium leading-none text-accent">
                    Open in Studio
                  </a>
                )}
              </div>
            </div>
            <p className="mt-1.5 max-w-2xl text-base leading-relaxed text-text-secondary">{t.thesis}</p>
          </div>
        </div>
      </div>

      {/* On a phone the settings and invest panel come right after the
          backtest; on a wide screen they are a sticky rail beside it all. */}
      <div className="grid border-t border-surface-border lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[auto_auto_1fr]">
        {/* Performance */}
        <section className="min-w-0 pt-8 lg:col-start-1 lg:row-start-1 lg:pr-10">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text-primary">Backtest</h2>
              {(bt.isFetching || stale) && <Spinner size="xs" />}
            </div>
            <RangeTabs ranges={RANGES} value={range} onChange={setRange} />
          </div>
          {bt.error ? (
            <p className="text-sm text-danger">Backtest failed: {friendlyError(bt.error)}</p>
          ) : bt.data ? (
            <div className={`space-y-6 transition-opacity ${stale ? "opacity-60" : ""}`}>
              <MetricTiles metrics={bt.data.metrics} benchmark={bt.data.benchmark.metrics} benchmarkTicker={bt.data.benchmark.ticker} />
              <PerformanceChart
                dates={bt.data.series.dates}
                strategy={bt.data.series.strategy}
                benchmark={bt.data.series.benchmark}
                strategyLabel={t.name}
                benchmarkLabel={bt.data.benchmark.ticker === "SPY" ? "SPY (S&P 500)" : bt.data.benchmark.ticker}
              />
            </div>
          ) : (
            <div className="h-[420px] animate-pulse bg-surface-1" />
          )}
        </section>

        {/* Rail */}
        <aside className="mt-10 border-t border-surface-border lg:sticky lg:top-14 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:mt-0 lg:self-start lg:border-t-0 lg:border-l lg:pl-8">
          {t.params.length > 0 && <div className="pt-8 pb-8">
            <ParamControls template={t} params={params} onChange={setParams} />
          </div>}
          <div className={`pt-8 lg:pb-8 ${t.params.length > 0 ? "border-t border-surface-border" : ""}`}>
            {t.retired ? (
              <p className="text-sm text-text-secondary">This strategy is closed to new investment.</p>
            ) : config.data ? (
              <InvestPanel template={t} params={query} target={target.isPlaceholderData ? undefined : target.data} config={config.data} />
            ) : config.error ? (
              <p className="text-xs text-danger">{friendlyError(config.error)}</p>
            ) : (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            )}
          </div>
        </aside>

        {/* Current allocation */}
        <section className="mt-10 min-w-0 border-t border-surface-border pt-8 lg:col-start-1 lg:row-start-2 lg:pr-10">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text-primary">Current allocation</h2>
              <InfoTip align="left" body={CURRENT_ALLOCATION} />
            </div>
            {target.data && (
              <Tooltip align="right" content={`Computed from the ${formatDate(target.data.cutoff)} close.`}>
                {target.data.fresh ? <Pill tone="success">Up to date</Pill> : <Pill tone="warn">Stale</Pill>}
              </Tooltip>
            )}
          </div>
          {target.error ? (
            <p className="text-sm text-danger">{friendlyError(target.error)}</p>
          ) : target.data ? (
            <div className={`transition-opacity ${stale ? "opacity-60" : ""}`}>
              {target.data.problem && <p className="mb-3 text-xs text-warn">{target.data.problem}</p>}
              <AllocationTable lines={target.data.lines} />
            </div>
          ) : (
            <div className="h-48 animate-pulse bg-surface-1" />
          )}
        </section>

        {/* Rules */}
        <section className="mt-10 grid min-w-0 gap-10 border-t border-surface-border pt-8 pb-4 sm:grid-cols-2 lg:col-start-1 lg:row-start-3 lg:self-start lg:pr-10">
          <div>
            <h2 className="mb-3 text-sm font-semibold text-text-primary">How it works</h2>
            <ul className="space-y-2">
              {describeRules(t, params).map((r) => (
                <li key={r} className="flex gap-2 text-sm leading-relaxed text-text-secondary">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-text-muted" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-3 text-sm font-semibold text-text-primary">What it can hold</h2>
            <div>
              {t.assets.map((a) => {
                const content = <>
                  <AssetLogo src={a.icon} symbol={tokenSymbol(a.ondoSymbol)} size={24} />
                  <span className="text-sm font-medium text-text-primary transition-colors group-hover:text-accent">{tokenSymbol(a.ondoSymbol)}</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-text-muted">{a.name}</span>
                  {a.ticker === t.fallback && <Pill>Safety</Pill>}
                </>;
                const className = "group flex items-center gap-2.5 py-2";
                return Object.keys(a.addresses).length > 0
                  ? <Link key={a.ticker} to={`/assets/${a.ticker}`} className={className}>{content}</Link>
                  : <div key={a.ticker} className={className}>{content}</div>;
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
