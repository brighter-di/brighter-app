import { type FC, useState } from "react";
import { Link } from "react-router-dom";
import { useQueries } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { positionsOptions, useConfig, usePortfolios } from "@/hooks/queries";
import { useTitle } from "@/hooks/useTitle";
import { PortfolioRow } from "@/components/portfolio/PortfolioRow";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { InfoTip } from "@/components/ui/InfoTip";
import { Spinner } from "@/components/ui/Spinner";
import { formatDate, formatUsd, toNumber } from "@/lib/format";
import { CHIP_BASE, CHIP_OFF, CHIP_ON } from "@/components/ui/chipStyles";
import { friendlyError } from "@/lib/errors";

/** The wallet's portfolios at a glance, largest balance first. Each one's holdings and actions live on its own page. */
export const Portfolios: FC = () => {
  const { address, isConnected } = useConnection();
  const [tab, setTab] = useState<"live" | "archived">("live");
  const portfolios = usePortfolios(address);
  // Fetched alongside, so the tab can say how many there are before it is
  // opened — and so opening it costs nothing.
  const archived = usePortfolios(address, true);
  const { data: config } = useConfig();
  useTitle("Portfolios");

  const liveList = portfolios.data ?? [];
  const archivedList = archived.data ?? [];
  const showing = tab === "archived" ? archived : portfolios;
  const list = tab === "archived" ? archivedList : liveList;
  // Only the live ones are worth pricing: archiving requires a portfolio to be
  // empty, and its automation is stopped, so there is nothing to ask the portfolio engine.
  const positions = useQueries({ queries: liveList.map((p) => positionsOptions(p.portfolioId)) });
  const total = positions.reduce((s, q) => s + toNumber(q.data?.totalValueUsd), 0);
  const allLoaded = positions.every((q) => !q.isLoading);

  // Largest balance first, sorted once every balance is in so rows don't jump
  // while they load. The sort is stable: equal balances keep their order.
  const rows =
    tab === "archived"
      ? archivedList.map((p) => ({ portfolio: p, query: undefined }))
      : liveList.map((p, i) => ({ portfolio: p, query: positions[i] }));
  if (tab === "live" && allLoaded) rows.sort((a, b) => toNumber(b.query?.data?.totalValueUsd) - toNumber(a.query?.data?.totalValueUsd));

  if (!isConnected) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="font-display text-2xl font-bold text-text-primary">Your portfolios</h1>
        <p className="mt-2 text-sm text-text-secondary">Connect the wallet you invested with to see your portfolios.</p>
        <div className="mx-auto mt-6 max-w-xs">
          <ConnectButton block />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="flex items-center gap-2 font-display text-2xl font-bold text-text-primary sm:text-3xl">
          Your portfolios
          <InfoTip align="left" body="Each portfolio is a smart account your wallet owns. Only your wallet can take money out." />
        </h1>
        {liveList.length > 0 && (
          // Held in place on the archived tab rather than removed: the heading
          // is bottom-aligned against this block, so dropping it would lift
          // the title every time the tab changed.
          <div className={`text-right ${tab === "live" ? "" : "invisible"}`} aria-hidden={tab !== "live"}>
            <div className="text-xs text-text-muted">Total value</div>
            <div className="font-mono text-3xl font-semibold tabular-nums text-text-primary">{allLoaded ? formatUsd(total) : <Spinner />}</div>
          </div>
        )}
      </div>

      {/* The tabs and the list they switch belong together, so the list sits
          close under them while the heading keeps its distance from both. */}
      <div className="space-y-4">
        {archivedList.length > 0 && (
        <div className="flex gap-5 border-b border-surface-border pb-2" role="tablist" aria-label="Portfolios">
          {([["live", "Active", liveList.length], ["archived", "Archived", archivedList.length]] as const).map(([value, label, count]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`${CHIP_BASE} ${tab === value ? CHIP_ON : CHIP_OFF}`}
            >
              {label}
              <span className="font-mono text-xs tabular-nums opacity-70">{count}</span>
            </button>
          ))}
        </div>
      )}

      {showing.error && !showing.data ? (
        <p className="text-sm text-danger">Couldn't load portfolios: {friendlyError(showing.error)}</p>
      ) : showing.isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : list.length === 0 ? (
        <div className="border-t border-surface-border py-14 text-center">
          {tab === "archived" ? (
            <>
              <p className="text-sm font-semibold text-text-primary">Nothing archived</p>
              <p className="mt-1 text-sm text-text-muted">A portfolio you retire is kept here, with its history.</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-text-primary">No portfolios yet</p>
              <p className="mt-1 text-sm text-text-muted">Pick a strategy to create your first one.</p>
              <Link to="/strategies" className="mt-5 inline-flex h-10 items-center rounded-md bg-text-primary px-4 text-sm font-semibold text-surface-0 hover:opacity-90">
                Browse strategies
              </Link>
            </>
          )}
        </div>
      ) : (
        <div>
          {showing.error && <p className="mb-3 text-xs text-warn">Showing the last loaded portfolios while refresh is unavailable.</p>}
          {/* Rules between the rows only: the ones above the first and below the
              last enclosed the list in a box it does not need. */}
          <div className="divide-y divide-surface-border">
            {rows.map(({ portfolio: p, query }) => (
              <PortfolioRow
                key={p.portfolioId}
                portfolio={p}
                chain={config?.chains.find((c) => c.chainId === p.chainId)}
                positions={query?.data}
                loading={tab === "live" && (query?.isLoading ?? true)}
                archivedOn={p.archivedAt ? formatDate(p.archivedAt) : undefined}
              />
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
