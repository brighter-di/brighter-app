import type { FC } from "react";
import { Link } from "react-router-dom";
import type { Chain, Portfolio, Positions } from "@/api/client";
import { ChainName } from "@/components/ui/ChainLogo";
import { Pill } from "@/components/ui/Pill";
import { StrategyGlyph } from "@/components/ui/StrategyGlyph";
import { formatUsd, toNumber } from "@/lib/format";

/** One portfolio in the list: what it is, where it lives and what it's worth. The rest is on its page. */
export const PortfolioRow: FC<{
  portfolio: Portfolio;
  chain: Chain | undefined;
  positions: Positions | undefined;
  loading: boolean;
  /** When the owner retired it. An archived portfolio shows this in place of a value: it holds nothing. */
  archivedOn?: string;
}> = ({ portfolio: p, chain, positions, loading, archivedOn }) => {
  const cashAddr = chain?.cash.address.toLowerCase();
  const cash = (positions?.assets ?? [])
    .filter((a) => a.assetId.split(":").pop()?.toLowerCase() === cashAddr)
    .reduce((s, a) => s + toNumber(a.valueUsd), 0);

  return (
    <Link to={`/portfolios/${p.portfolioId}`} className="group flex items-center gap-3.5 py-4">
      <StrategyGlyph id={p.templateId} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-base font-semibold text-text-primary transition-colors group-hover:text-accent">{p.templateName}</span>
          <Pill mono>{p.paramsLabel}</Pill>
        </div>
        {chain && <ChainName chainId={chain.chainId} name={chain.name} size={12} className="mt-1 text-xs text-text-secondary" />}
      </div>
      <div className="shrink-0 text-right">
        {archivedOn ? (
          // An archived portfolio is empty by the rule that let it be archived,
          // so a value of $0.00 would say nothing. When it went does.
          <>
            <div className="text-sm text-text-muted">Archived</div>
            <div className="text-xs text-text-muted">{archivedOn}</div>
          </>
        ) : loading && !positions ? (
          <span className="inline-block h-6 w-20 animate-pulse bg-surface-2" />
        ) : (
          <div className="font-mono text-lg font-semibold tabular-nums text-text-primary">{formatUsd(positions?.totalValueUsd ?? 0)}</div>
        )}
        {!archivedOn && cash > 0.01 && <div className="text-xs text-warn">Awaiting investment</div>}
      </div>
    </Link>
  );
};
