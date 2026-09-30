import type { FC } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { positionsOptions, useConfig, usePortfolioDetail, useTemplates } from "@/hooks/queries";
import { useTitle } from "@/hooks/useTitle";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";
import { RecentOperations } from "@/components/portfolio/RecentOperations";
import { Spinner } from "@/components/ui/Spinner";
import { friendlyError } from "@/lib/errors";

/** One portfolio: holdings against target, deposits, rebalances and withdrawals. */
export const PortfolioPage: FC = () => {
  const { id } = useParams<{ id: string }>();
  const detail = usePortfolioDetail(id);
  const { data: config } = useConfig();
  const { data: templates } = useTemplates();
  const positions = useQuery({ ...positionsOptions(id ?? ""), enabled: !!id });
  useTitle(detail.data?.templateName ?? "Portfolio");

  const back = (
    <Link to="/portfolios" className="text-sm text-text-muted hover:text-accent">
      ← Your portfolios
    </Link>
  );

  if (detail.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!detail.data) {
    return (
      <div className="space-y-3">
        {back}
        <p className="text-sm text-danger">{detail.error ? friendlyError(detail.error) : "Portfolio not found."}</p>
      </div>
    );
  }

  const p = detail.data;
  return (
    <div>
      {back}
      {detail.error && <p className="mt-3 text-xs text-warn">Showing the last loaded portfolio details while refresh is unavailable.</p>}
      <PortfolioCard
        portfolio={p}
        chain={config?.chains.find((c) => c.chainId === p.chainId)}
        template={templates?.find((t) => t.id === p.templateId)}
        positions={positions.data}
        positionsLoading={positions.isLoading}
        positionsError={positions.error}
      />
      <RecentOperations portfolioId={p.portfolioId} template={templates?.find((t) => t.id === p.templateId)} />
    </div>
  );
};
