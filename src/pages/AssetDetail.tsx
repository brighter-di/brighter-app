import { type FC, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { AssetDetail as AssetInfo, Range } from "@/api/client";
import { useAsset, useConfig } from "@/hooks/queries";
import { useAssetSeries } from "@/hooks/useAssetSeries";
import { useTitle } from "@/hooks/useTitle";
import { bps, formatDate, formatUsd, pct, tokenSymbol } from "@/lib/format";
import { friendlyError } from "@/lib/errors";
import { PerformanceChart } from "@/components/strategy/PerformanceChart";
import { MetricTiles } from "@/components/strategy/MetricTiles";
import { Address } from "@/components/ui/Address";
import { AssetLogo } from "@/components/ui/AssetLogo";
import { ChainName } from "@/components/ui/ChainLogo";
import { InfoTip, Tooltip } from "@/components/ui/InfoTip";
import { Pill } from "@/components/ui/Pill";
import { RangeTabs } from "@/components/ui/RangeTabs";
import { Spinner } from "@/components/ui/Spinner";
import { StrategyGlyph } from "@/components/ui/StrategyGlyph";

const RANGES: Range[] = ["1y", "3y", "5y"];
const YEARS: Record<Range, number> = { "1y": 1, "3y": 3, "5y": 5, "10y": 10 };

/** What the strategies below have in common with this asset, said once. */
function rolesNote(a: AssetInfo): string {
  const fallback = a.strategies.filter((s) => s.role === "fallback").length;
  if (fallback === 0) return `Each of these rules can pick ${a.ticker}.`;
  if (fallback === a.strategies.length) return "Each of these strategies moves here when its rule steps aside.";
  return `Some of these rules pick ${a.ticker}; for others it's where they move when the rule steps aside.`;
}

export const AssetDetail: FC = () => {
  const { ticker } = useParams<{ ticker: string }>();
  const navigate = useNavigate();
  const [range, setRange] = useState<Range>("1y");
  const asset = useAsset(ticker);
  // Start the price history from the URL's ticker, alongside the asset's
  // details rather than after them.
  const series = useAssetSeries(ticker?.toUpperCase(), YEARS[range]);
  const { data: config } = useConfig();
  useTitle(asset.data?.name ?? ticker?.toUpperCase());

  // Back returns to where the visitor came from. Someone who opened this page
  // from a shared link has no earlier page in the app, so they get the list.
  const canGoBack = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
  const back = canGoBack ? (
    <button onClick={() => navigate(-1)} className="text-sm text-text-muted hover:text-accent">
      ← Back
    </button>
  ) : (
    <Link to="/strategies" className="text-sm text-text-muted hover:text-accent">
      ← All strategies
    </Link>
  );

  if (asset.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  if (asset.error || !asset.data) {
    return (
      <div className="space-y-3">
        {back}
        <p className="text-sm text-danger">{asset.error ? friendlyError(asset.error) : "Asset not found."}</p>
      </div>
    );
  }

  const a = asset.data;
  const quote = series.quote;
  const drawn = series.dates.length > 1;
  const chains = new Map((config?.chains ?? []).map((c) => [c.chainId, c]));
  const mixedRoles = a.strategies.some((s) => s.role === "fallback") && a.strategies.some((s) => s.role === "universe");
  // Identifiers read best in mono; plain words stay in the text face.
  const facts: { label: string; value: string; code?: boolean }[] = [
    { label: "Ticker", value: a.ticker, code: true },
    { label: "Type", value: a.kind },
    { label: "ISIN", value: a.isin, code: true },
    { label: "Issuer", value: "Ondo Global Markets" },
    { label: "Backing", value: "1:1 by the underlying security" },
  ];

  return (
    <div className="space-y-8">
      <div>
        {back}
        <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
          <div className="flex min-w-0 items-start gap-4">
            <AssetLogo src={a.icon} symbol={tokenSymbol(a.ondoSymbol)} size={48} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold text-text-primary sm:text-3xl">{a.name}</h1>
                <Pill mono>{tokenSymbol(a.ondoSymbol)}</Pill>
                <Pill>{a.kind}</Pill>
              </div>
              <p className="mt-1.5 max-w-2xl text-base leading-relaxed text-text-secondary">{a.about}</p>
            </div>
          </div>
          {quote && (
            <Tooltip align="right" content={`Close of ${formatDate(quote.asOf)}, and the change on the previous close.`}>
              <span className="block text-right">
                <span className="block font-mono text-3xl font-semibold tabular-nums text-text-primary">{formatUsd(quote.price)}</span>
                <span className={`block font-mono text-sm tabular-nums ${quote.change >= 0 ? "text-success" : "text-danger"}`}>
                  {quote.change >= 0 ? "+" : ""}
                  {quote.change.toFixed(2)} ({pct(quote.changePct, 2)})
                </span>
              </span>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="grid gap-10 border-t border-surface-border lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-0">
        <div className="min-w-0 lg:pr-10">
          <section className="pt-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-text-primary">Price performance</h2>
                {drawn && series.settled && (
                  <InfoTip
                    align="left"
                    body={`Daily closing prices of ${a.ticker} from ${formatDate(series.dates[0])} to ${formatDate(series.dates[series.dates.length - 1])}. The token you hold tracks this price.`}
                  />
                )}
                {drawn && !series.settled && <Spinner size="xs" />}
              </div>
              <RangeTabs ranges={RANGES} value={range} onChange={setRange} />
            </div>
            {series.error && !drawn ? (
              <p className="text-sm text-danger">Couldn't load price history: {friendlyError(series.error)}</p>
            ) : drawn ? (
              <div className="space-y-6">
                {series.metrics ? (
                  <MetricTiles metrics={series.metrics} benchmark={series.benchmarkMetrics} benchmarkTicker={series.benchmarkTicker} />
                ) : (
                  <div className="h-[60px] animate-pulse bg-surface-1" />
                )}
                <PerformanceChart
                  dates={series.dates}
                  strategy={series.strategy}
                  benchmark={series.benchmark}
                  strategyLabel={a.ticker}
                  benchmarkLabel={`${series.benchmarkTicker} (S&P 500)`}
                  animate
                />
              </div>
            ) : (
              <div className="h-[420px] animate-pulse bg-surface-1" />
            )}
          </section>

          <section className="mt-10 border-t border-surface-border pt-8 pb-4">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text-primary">Strategies that can hold it</h2>
              {a.strategies.length > 0 && <InfoTip align="left" body={rolesNote(a)} />}
            </div>
            {a.strategies.length === 0 ? (
              <p className="text-sm text-text-muted">No strategy holds this asset.</p>
            ) : (
              a.strategies.map((s) => (
                <Link key={s.id} to={`/strategies/${s.id}`} className="group flex items-center gap-3 py-2">
                  <StrategyGlyph id={s.id} size={28} />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text-primary transition-colors group-hover:text-accent">{s.name}</span>
                  {mixedRoles && s.role === "fallback" && <span className="shrink-0 text-xs text-text-muted">Safety asset</span>}
                  {s.heldBps != null && (
                    <span className={`shrink-0 text-xs ${s.heldBps > 0 ? "text-text-primary" : "text-text-muted"}`}>
                      {s.heldBps > 0 ? (
                        <>
                          Holds <span className="font-mono tabular-nums">{bps(s.heldBps)}</span> now
                        </>
                      ) : (
                        "Not held now"
                      )}
                    </span>
                  )}
                </Link>
              ))
            )}
          </section>
        </div>

        <aside className="lg:self-start lg:border-l lg:border-surface-border lg:pl-8">
          <div className="pt-8">
            <h2 className="mb-3 text-sm font-semibold text-text-primary">Details</h2>
            <dl>
              {facts.map((f) => (
                <div key={f.label} className="flex items-baseline justify-between gap-4 py-1.5">
                  <dt className="text-xs text-text-muted">{f.label}</dt>
                  <dd className={`text-right text-xs text-text-primary ${f.code ? "font-mono" : ""}`}>{f.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="mt-6 border-t border-surface-border pt-6 pb-8">
            <h2 className="mb-3 text-sm font-semibold text-text-primary">Token contract</h2>
            {a.chains.length === 0 ? (
              <p className="text-xs text-text-muted">Not available on an enabled chain.</p>
            ) : (
              a.chains.map((c) => {
                const chain = chains.get(c.chainId);
                return (
                  <div key={c.chainId} className="flex items-center justify-between gap-2 py-1.5">
                    <ChainName chainId={c.chainId} name={chain?.name ?? `Chain ${c.chainId}`} size={13} className="text-xs text-text-secondary" />
                    <Address address={c.address} explorer={chain?.explorer} kind="token" />
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
