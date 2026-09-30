import { type FC, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useConnection, useSignMessage } from "wagmi";
import { api, archiveMessage, type Chain, type Portfolio, type Positions, type Template } from "@/api/client";
import { keys, usePerformance, usePortfolioDetail } from "@/hooks/queries";
import { Address } from "@/components/ui/Address";
import { AssetLogo } from "@/components/ui/AssetLogo";
import { ChainName } from "@/components/ui/ChainLogo";
import { Tooltip } from "@/components/ui/InfoTip";
import { Pill } from "@/components/ui/Pill";
import { StrategyGlyph } from "@/components/ui/StrategyGlyph";
import { Spinner } from "@/components/ui/Spinner";
import { bps, formatBalance, formatDateTime, formatUsd, pct, signedUsd, toNumber, tokenSymbol } from "@/lib/format";
import { paramsSearch } from "@/lib/params";
import { friendlyError } from "@/lib/errors";
import { recordOperation } from "@/lib/ops";
import { showToast } from "@/lib/toast";
import { ProfitChart } from "./ProfitChart";
import { OperationStatus } from "./OperationStatus";

interface Props {
  portfolio: Portfolio;
  chain: Chain | undefined;
  template: Template | undefined;
  positions: Positions | undefined;
  positionsLoading: boolean;
  positionsError: unknown;
}

const PROFIT =
  "Value minus what you've put in, net of withdrawals. The percentage is money-weighted, so it accounts for when money went in or out.";

/** A portfolio's page body: profit, holdings against target, deposits, rebalances, withdrawals. */
export const PortfolioCard: FC<Props> = ({ portfolio: p, chain, template, positions, positionsLoading, positionsError }) => {
  const navigate = useNavigate();
  const detail = usePortfolioDetail(p.portfolioId);
  const perf = usePerformance(p.portfolioId);
  const schedule = detail.data?.schedule ?? null;
  const points = perf.data?.points ?? [];
  const latest = points.at(-1);
  const qc = useQueryClient();

  const deploy = useMutation({
    mutationFn: () => api.deploy(p.portfolioId),
    onSuccess: (op) => {
      recordOperation({ operationId: op.operationId, portfolioId: p.portfolioId, label: `Rebalance ${p.templateName}`, submittedAt: op.submittedAt });
      qc.invalidateQueries({ queryKey: keys.positions(p.portfolioId) });
    },
  });

  const cashAddr = chain?.cash.address.toLowerCase();
  const rows = useMemo(() => {
    const assets = (positions?.assets ?? []).filter((a) => toNumber(a.balance) > 0);
    const total = toNumber(positions?.totalValueUsd);
    const byAddress = new Map<string, Template["assets"][number]>();
    for (const a of template?.assets ?? []) {
      const addr = chain ? a.addresses[String(chain.chainId)] : undefined;
      if (addr) byAddress.set(addr.toLowerCase(), a);
    }
    const target = new Map(p.allocation.map((l) => [l.ticker, l.bps]));
    return assets
      .map((a) => {
        const addr = a.assetId.split(":").pop()?.toLowerCase() ?? "";
        const meta = byAddress.get(addr);
        return {
          ...a,
          isCash: addr === cashAddr,
          icon: meta?.icon,
          ticker: meta?.ticker,
          weight: total > 0 ? toNumber(a.valueUsd) / total : 0,
          targetBps: meta ? (target.get(meta.ticker) ?? 0) : null,
        };
      })
      .sort((x, y) => toNumber(y.valueUsd) - toNumber(x.valueUsd));
  }, [positions, template, chain, p.allocation, cashAddr]);

  const total = toNumber(positions?.totalValueUsd);
  const cashValue = rows.filter((r) => r.isCash).reduce((s, r) => s + toNumber(r.valueUsd), 0);

  // Only an empty portfolio can be archived, by its owner; the backend checks both again.
  const { address } = useConnection();
  const { mutateAsync: signMessage } = useSignMessage();
  const isOwner = !!address && address.toLowerCase() === p.owner.toLowerCase();
  const empty = !!positions && total < 0.01 && toNumber(positions.inTransit?.totalUsd) < 0.01;
  const archive = useMutation({
    mutationFn: async () => {
      const issuedAt = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      const signature = await signMessage({ message: archiveMessage(p.portfolioId, issuedAt) });
      return api.archive(p.portfolioId, { issuedAt, signature });
    },
    onSuccess: () => {
      qc.setQueryData<Portfolio[]>(keys.portfolios(p.owner), (list) => list?.filter((x) => x.portfolioId !== p.portfolioId));
      void qc.invalidateQueries({ queryKey: keys.portfolios(p.owner) });
      showToast({ variant: "success", title: "Portfolio archived" });
      navigate("/portfolios");
    },
  });

  return (
    <article className="py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3.5">
          <StrategyGlyph id={p.templateId} size={48} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-display text-2xl font-bold text-text-primary sm:text-3xl">
                <Link to={`/strategies/${p.templateId}${template ? paramsSearch(template, p.params) : ""}`} className="hover:text-accent">
                  {p.templateName}
                </Link>
              </h1>
              <Pill mono>{p.paramsLabel}</Pill>
              {chain && <ChainName chainId={chain.chainId} name={chain.name} size={13} className="text-xs font-medium text-text-secondary" />}
              {schedule?.status === "paused" && <Pill tone="warn">Automation paused</Pill>}
            </div>
            {schedule?.nextDueAt && schedule.status !== "paused" && (
              <p className="mt-1 text-sm text-text-secondary">Next rebalance {formatDateTime(schedule.nextDueAt)}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-text-muted">Value</div>
          <div className="font-mono text-2xl font-semibold tabular-nums text-text-primary">
            {positionsLoading && !positions ? <span className="inline-block h-6 w-24 animate-pulse bg-surface-2" /> : formatUsd(total)}
          </div>
          {latest && latest.deposited > 0 && (
            <Tooltip align="right" content={PROFIT}>
              <span className={`font-mono text-sm tabular-nums ${latest.profit >= 0 ? "text-success" : "text-danger"}`}>
                {signedUsd(latest.profit)}
                {latest.return != null && ` (${pct(latest.return, 2)})`}
              </span>
            </Tooltip>
          )}
          {cashValue > 0.01 && (
            <div>
              <Tooltip align="right" content="Your deposit arrived. It's invested at the next rebalance, or press Rebalance now.">
                <span className="font-mono text-[11px] tabular-nums text-warn">
                  {formatUsd(cashValue)} {chain?.cash.symbol} awaiting investment
                </span>
              </Tooltip>
            </div>
          )}
        </div>
      </div>

      {points.length >= 2 && (
        <div className="mt-6 border-t border-surface-border pt-5">
          <ProfitChart points={points} />
        </div>
      )}

      <div className="mt-6">
        {positionsError && !positions ? (
          <p className="py-2 text-xs text-danger">Couldn't load holdings: {friendlyError(positionsError)}</p>
        ) : positionsLoading && !positions ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <p className="border-t border-surface-border py-3 text-sm text-text-muted">Deposit funds to start investing.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-text-muted">
                <th className="py-1.5 font-normal">Asset</th>
                <th className="hidden py-1.5 text-right font-normal sm:table-cell">Balance</th>
                <th className="py-1.5 text-right font-normal">Value</th>
                <th className="py-1.5 text-right font-normal">Weight</th>
                <th className="hidden py-1.5 text-right font-normal sm:table-cell">Target</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.assetId} className="border-t border-surface-border">
                  <td className="py-2">
                    <span className="flex items-center gap-2.5">
                      <AssetLogo src={r.icon} symbol={tokenSymbol(r.symbol)} size={24} />
                      {r.ticker ? (
                        <Link to={`/assets/${r.ticker}`} className="font-medium text-text-primary hover:text-accent">
                          {tokenSymbol(r.symbol)}
                        </Link>
                      ) : (
                        <span className="font-medium text-text-primary">{tokenSymbol(r.symbol)}</span>
                      )}
                      {r.isCash && <Pill tone="warn">cash</Pill>}
                    </span>
                  </td>
                  <td className="hidden py-2 text-right font-mono text-xs tabular-nums text-text-secondary sm:table-cell">{formatBalance(toNumber(r.balance))}</td>
                  <td className="py-2 text-right font-mono tabular-nums text-text-primary">{formatUsd(r.valueUsd)}</td>
                  <td className="py-2 text-right font-mono text-xs tabular-nums text-text-secondary">{pct(r.weight, 2, false)}</td>
                  <td className="hidden py-2 text-right font-mono text-xs tabular-nums text-text-muted sm:table-cell">
                    {r.isCash ? bps(0) : r.targetBps != null ? bps(r.targetBps) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!!positionsError && positions && <p className="mt-2 text-xs text-warn">Showing the last loaded holdings while refresh is unavailable.</p>}
        {(positions?.warnings.length ?? 0) > 0 && <p className="mt-2 text-[11px] text-warn">{positions!.warnings.map((w) => w.message).join(" · ")}</p>}
      </div>

      {deploy.data && (
        <div className="mt-2">
          <OperationStatus portfolioId={p.portfolioId} operationId={deploy.data.operationId} label="rebalance" />
        </div>
      )}
      {deploy.error && <p className="mt-2 text-xs text-danger">{friendlyError(deploy.error)}</p>}
      {archive.error && <p className="mt-2 text-xs text-danger">{friendlyError(archive.error)}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-surface-border pt-4">
        <Link to={`/portfolios/${p.portfolioId}/deposit`} className="flex h-9 items-center rounded-md bg-text-primary px-3.5 text-sm font-semibold text-surface-0 transition-opacity hover:opacity-90">
          Deposit
        </Link>
        <button
          onClick={() => deploy.mutate()}
          disabled={deploy.isPending || total <= 0}
          className="flex h-9 items-center gap-2 rounded-md px-3.5 text-sm font-semibold text-text-primary hover:bg-surface-1 disabled:text-text-muted"
        >
          {deploy.isPending && <Spinner size="xs" />}
          Rebalance now
        </button>
        <button
          onClick={() => navigate(`/portfolios/${p.portfolioId}/withdraw`)}
          disabled={total <= 0}
          className="h-9 rounded-md px-3.5 text-sm font-semibold text-text-primary hover:bg-surface-1 disabled:text-text-muted"
        >
          Withdraw
        </button>
        {empty && (
          <Tooltip content={isOwner ? "Stops automation and removes this empty portfolio from your list. It moves no funds." : "Connect the wallet that owns this portfolio to archive it."}>
            <button
              onClick={() => archive.mutate()}
              disabled={archive.isPending || !isOwner}
              className="flex h-9 items-center gap-2 rounded-md px-3.5 text-sm font-semibold text-text-primary hover:bg-surface-1 disabled:text-text-muted"
            >
              {archive.isPending && <Spinner size="xs" />}
              Archive
            </button>
          </Tooltip>
        )}
        <Address address={p.depositAddress} explorer={chain?.explorer} label="Deposit address" className="ml-auto" />
      </div>

    </article>
  );
};
