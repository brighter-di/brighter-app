import { lazy, Suspense, useState, type FC } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import type { Chain, Portfolio } from "@/api/client";
import { useConfig, usePortfolioDetail } from "@/hooks/queries";
import { useTitle } from "@/hooks/useTitle";
import { friendlyError } from "@/lib/errors";
import { ChainLogo } from "@/components/ui/ChainLogo";
import { Spinner } from "@/components/ui/Spinner";
import { FundPanel } from "@/components/portfolio/FundPanel";

const CrossChainDeposit = lazy(() => import("@/components/portfolio/CrossChainDeposit"));
type DepositMethod = "direct" | "lifi";

export const DepositPage: FC = () => {
  const { id, method } = useParams<{ id: string; method: string }>();
  const detail = usePortfolioDetail(id);
  const config = useConfig();
  useTitle(detail.data ? `Deposit to ${detail.data.templateName}` : "Deposit");

  if (method !== undefined && method !== "direct" && method !== "lifi") return <Navigate to={`/portfolios/${id}/deposit`} replace />;
  if (detail.isLoading || config.isLoading) return <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>;
  const portfolio = detail.data;
  const chain = config.data?.chains.find((entry) => entry.chainId === portfolio?.chainId);
  if (detail.error || config.error || !portfolio || !chain) return <div className="space-y-3">
    <Link to={id ? `/portfolios/${id}` : "/portfolios"} className="text-sm text-text-muted hover:text-accent">← Back to portfolio</Link>
    <p className="text-sm text-danger">{detail.error || config.error ? friendlyError(detail.error ?? config.error) : !portfolio ? "Portfolio not found." : "Deposits are unavailable for this chain."}</p>
  </div>;
  if (method === "lifi" && chain.chainId !== 56) return <Navigate to={`/portfolios/${id}/deposit`} replace />;

  return <DepositFlow key={portfolio.portfolioId} portfolio={portfolio} chain={chain} method={method} />;
};

const DepositFlow: FC<{ portfolio: Portfolio; chain: Chain; method: DepositMethod | undefined }> = ({ portfolio, chain, method }) => {
  const base = `/portfolios/${portfolio.portfolioId}/deposit`;
  const [opened, setOpened] = useState({ direct: method === "direct", lifi: method === "lifi" });
  // Retain visited forms across URL changes, including browser Back/Forward.
  if (method && !opened[method]) setOpened({ ...opened, [method]: true });

  return <div className="w-full">
    <Link to={method ? base : `/portfolios/${portfolio.portfolioId}`} className="text-sm text-text-muted hover:text-accent">
      ← {method ? "Deposit options" : "Back to portfolio"}
    </Link>
    <h1 className="mb-8 mt-6 font-display text-2xl font-bold text-text-primary sm:text-3xl">{method === "lifi" ? "Deposit" : `Deposit to ${portfolio.templateName}`}</h1>
    {method === undefined ? (
      <div aria-label="Deposit options" className="flex flex-col divide-y divide-surface-border">
        <Link to={`${base}/direct`} className="group flex items-center gap-3.5 py-4 focus-visible:outline-2 focus-visible:outline-accent">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2" aria-hidden><ChainLogo chainId={chain.chainId} size={20} /></span>
          <span className="min-w-0 flex-1 font-display text-base font-semibold text-text-primary transition-colors group-hover:text-accent">Direct {chain.cash.symbol} on {chain.chainId === 56 ? "BNB" : chain.name}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-text-muted transition-colors group-hover:text-accent" aria-hidden><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
        </Link>
        {chain.chainId === 56 && <Link to={`${base}/lifi`} className="group flex items-center gap-3.5 py-4 focus-visible:outline-2 focus-visible:outline-accent">
          <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2" aria-hidden><img src="/lifi-logo.svg" alt="" width={36} height={36} /></span>
          <span className="min-w-0 flex-1 font-display text-base font-semibold text-text-primary transition-colors group-hover:text-accent">Any chain, any token</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-text-muted transition-colors group-hover:text-accent" aria-hidden><path d="M5 12h14m-6-6 6 6-6 6" /></svg>
        </Link>}
      </div>
    ) : method === "direct" ? (
      <h2 className="mb-5 text-sm font-semibold text-text-primary">Direct {chain.cash.symbol} on {chain.chainId === 56 ? "BNB" : chain.name}</h2>
    ) : null}
    <div hidden={method !== "direct"}>
      {opened.direct && <FundPanel portfolio={portfolio} chain={chain} />}
    </div>
    <div hidden={method !== "lifi"} className="w-full">
      {opened.lifi && <Suspense fallback={<div className="flex min-h-48 items-center justify-center gap-2 text-sm text-text-secondary"><Spinner size="sm" />Loading funding routes…</div>}><CrossChainDeposit portfolio={portfolio} chain={chain} /></Suspense>}
    </div>
  </div>;
};
