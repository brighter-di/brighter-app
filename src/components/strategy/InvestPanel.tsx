import { type FC, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useConnection } from "wagmi";
import type { AppConfig, Params, Target, Template } from "@/api/client";
import { usePortfolios } from "@/hooks/queries";
import { useInvest, type InvestStep } from "@/hooks/useInvest";
import { paramsKey, paramsLabel } from "@/lib/params";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { ChainName } from "@/components/ui/ChainLogo";
import { Spinner } from "@/components/ui/Spinner";

const STEP_COPY: Record<InvestStep, string> = {
  idle: "",
  preparing: "Preparing your portfolio…",
  switching: "Switch network in your wallet…",
  signing: "Sign in your wallet…",
  confirming: "Creating portfolio…",
};

interface Props {
  template: Template;
  params: Params;
  target: Target | undefined;
  config: AppConfig;
}

export const InvestPanel: FC<Props> = ({ template, params, target, config }) => {
  const { address, isConnected } = useConnection();
  const navigate = useNavigate();
  const [chainId, setChainId] = useState(config.chains[0]?.chainId);
  const chain = config.chains.find((c) => c.chainId === chainId) ?? config.chains[0];
  const { invest, step, error, clearError } = useInvest();
  const portfolios = usePortfolios(address);

  const key = paramsKey(template, params);
  // A portfolio on these exact parameters the user already had. Funding it is
  // the portfolio page's job, so the rail only says they hold it.
  const owned = useMemo(
    () => portfolios.data?.find((p) => p.templateId === template.id && p.chainId === chain?.chainId && paramsKey(template, p.params) === key) ?? null,
    [portfolios.data, template, chain?.chainId, key],
  );
  const existing = owned;

  // A different parameter set is a different strategy.
  useEffect(() => {
    clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, chainId]);

  if (!chain) return null;
  const readiness = target?.chains.find((c) => c.chainId === chain.chainId);
  const busy = step !== "idle";

  return (
    <div>
      {config.chains.length > 1 && (
        <div className="mb-4 flex gap-3">
          {config.chains.map((c) => (
            <button
              key={c.chainId}
              onClick={() => setChainId(c.chainId)}
              className={`border-b-2 pb-0.5 text-xs font-semibold transition-colors ${
                c.chainId === chain.chainId ? "border-text-primary text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"
              }`}
            >
              <ChainName chainId={c.chainId} name={c.name} size={12} />
            </button>
          ))}
        </div>
      )}

      {existing ? (
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-2 text-xs text-text-secondary">
            <span>
              You hold this strategy (<span className="font-mono">{paramsLabel(template, params)}</span>).
            </span>
            <Link to={`/portfolios/${existing.portfolioId}`} className="shrink-0 font-semibold text-accent hover:underline">
              View
            </Link>
          </div>
        </div>
      ) : !config.trading ? (
        <p className="text-xs leading-relaxed text-warn">Investing is temporarily unavailable. Backtests and allocations are still live.</p>
      ) : (
        <div className="space-y-4">
          {readiness && !readiness.executable && <p className="text-xs leading-relaxed text-warn">{readiness.reason}</p>}
          {error && <p className="text-xs leading-relaxed text-danger">{error}</p>}

          {!isConnected ? (
            <ConnectButton block label="Sign in to invest" />
          ) : (
            <button
              onClick={async () => {
                const p = await invest(template, params, chain.chainId);
                if (p) navigate(`/portfolios/${p.portfolioId}/deposit`);
              }}
              disabled={busy || !target || !readiness?.executable}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-text-primary text-sm font-semibold text-surface-0 transition-opacity hover:opacity-90 disabled:bg-surface-3 disabled:text-text-muted"
            >
              {busy && <Spinner size="sm" tone="invert" />}
              {busy ? STEP_COPY[step] : "Create portfolio"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
