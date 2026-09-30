import type { FC } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { positionsOptions, useConfig, usePortfolioDetail, useTemplates } from "@/hooks/queries";
import { useTitle } from "@/hooks/useTitle";
import { WithdrawPanel } from "@/components/portfolio/WithdrawPanel";
import { Spinner } from "@/components/ui/Spinner";
import { friendlyError } from "@/lib/errors";

export const WithdrawPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const detail = usePortfolioDetail(id);
  const config = useConfig();
  const { data: templates } = useTemplates();
  const positions = useQuery({ ...positionsOptions(id ?? ""), enabled: !!id });
  useTitle(detail.data ? `Withdraw from ${detail.data.templateName}` : "Withdraw");
  const back = <Link to={id ? `/portfolios/${id}` : "/portfolios"} className="text-sm text-text-muted hover:text-accent">← Back to portfolio</Link>;

  if (detail.isLoading || config.isLoading || positions.isLoading) return <div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>;
  const portfolio = detail.data;
  const chain = config.data?.chains.find((entry) => entry.chainId === portfolio?.chainId);
  const error = detail.error ?? config.error ?? positions.error;
  if (error || !portfolio || !chain || !positions.data) return <div className="space-y-3">
    {back}
    <p className="text-sm text-danger">{error ? friendlyError(error) : !portfolio ? "Portfolio not found." : !chain ? "Withdrawals are unavailable for this chain." : "Couldn't load holdings."}</p>
  </div>;

  return <div className="w-full">
    {back}
    <h1 className="mb-8 mt-6 font-display text-2xl font-bold text-text-primary sm:text-3xl">Withdraw from {portfolio.templateName}</h1>
    <WithdrawPanel key={portfolio.portfolioId} portfolio={portfolio} chain={chain} positions={positions.data.assets} template={templates?.find((entry) => entry.id === portfolio.templateId)} />
  </div>;
};
