import { type FC, useState } from "react";
import { Link } from "react-router-dom";
import type { Chain, Portfolio, Position, Template, WithdrawMode } from "@/api/client";
import { useWithdraw } from "@/hooks/useWithdraw";
import { Spinner } from "@/components/ui/Spinner";
import { ChainName } from "@/components/ui/ChainLogo";
import { AssetLogo } from "@/components/ui/AssetLogo";
import { formatBalance, formatUsd, toNumber, tokenSymbol } from "@/lib/format";
import { OperationStatus } from "./OperationStatus";

interface Props {
  portfolio: Portfolio;
  chain: Chain;
  positions: Position[];
  template?: Template;
}

export const WithdrawPanel: FC<Props> = ({ portfolio, chain, positions, template }) => {
  const [mode, setMode] = useState<WithdrawMode>("liquidate");
  const { withdraw, busy, error } = useWithdraw();
  const [opId, setOpId] = useState<string | null>(null);
  const held = positions.filter((p) => {
    try {
      return BigInt(p.balanceRaw) > 0n;
    } catch {
      return false;
    }
  });
  const total = held.reduce((s, p) => s + toNumber(p.valueUsd), 0);
  const icons = new Map((template?.assets ?? []).flatMap((asset) => {
    const address = asset.addresses[String(chain.chainId)];
    return address ? [[address.toLowerCase(), asset.icon] as const] : [];
  }));

  const submit = async () => {
    const assets = mode === "withdraw" ? held.map((p) => ({ assetId: p.assetId, amountRaw: p.balanceRaw })) : undefined;
    const id = await withdraw(portfolio, mode, assets);
    if (id) setOpId(id);
  };

  return (
    <div>
      {opId ? (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-text-secondary">
            {mode === "liquidate"
              ? `Selling your holdings. ${chain.cash.symbol} arrives in your wallet once the redemption settles.`
              : "Sending your tokens to your wallet."}
          </p>
          <OperationStatus portfolioId={portfolio.portfolioId} operationId={opId} label={mode === "liquidate" ? "sell" : "withdraw"} />
          <Link to={`/portfolios/${portfolio.portfolioId}`} className="flex h-10 w-fit max-w-[280px] items-center justify-center rounded-md bg-text-primary px-5 text-sm font-semibold text-surface-0 hover:opacity-90">
            Done
          </Link>
        </div>
      ) : held.length === 0 ? (
        <p className="py-6 text-sm text-text-muted">Nothing to withdraw — this portfolio holds no balance yet.</p>
      ) : (
        <div className="space-y-5">
          <div role="radiogroup" aria-label="Withdrawal method" className="divide-y divide-surface-border border-b border-surface-border">
            <Option
              active={mode === "liquidate"}
              onClick={() => setMode("liquidate")}
              title={`Sell everything to ${chain.cash.symbol}`}
              disabled={busy}
            />
            <Option
              active={mode === "withdraw"}
              onClick={() => setMode("withdraw")}
              title="Withdraw tokens as they are"
              disabled={busy}
            />
          </div>

          <div>
            {held.map((p) => (
              <div key={p.assetId} className="flex items-center justify-between border-b border-surface-border py-2">
                <span className="flex items-center gap-2.5 text-sm font-medium text-text-primary">
                  <AssetLogo src={icons.get(p.assetId.split(":").pop()?.toLowerCase() ?? "")} symbol={tokenSymbol(p.symbol)} size={24} />
                  {tokenSymbol(p.symbol)}
                </span>
                <span className="text-right font-mono text-sm tabular-nums text-text-secondary">
                  {formatBalance(Number(p.balance))} · {formatUsd(p.valueUsd)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between py-2 text-sm">
              <span className="text-text-muted">Total</span>
              <span className="font-mono font-semibold tabular-nums text-text-primary">{formatUsd(total)}</span>
            </div>
          </div>

          <p className="text-xs leading-relaxed text-text-muted">
            Funds go to{" "}
            <span className="font-mono">
              {portfolio.owner.slice(0, 6)}…{portfolio.owner.slice(-4)}
            </span>{" "}
            on <ChainName chainId={chain.chainId} name={chain.name} size={12} className="align-[-1px]" /> — the wallet that owns this portfolio. You'll sign an
            authorization valid for 10 minutes.
          </p>
          {error && <p className="text-sm leading-relaxed text-danger">{error}</p>}
          <button
            onClick={submit}
            disabled={busy}
            className="flex h-11 w-fit max-w-[280px] items-center justify-center gap-2 rounded-md bg-text-primary px-5 text-sm font-semibold text-surface-0 transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Spinner size="sm" tone="invert" />}
            {busy ? "Sign in your wallet…" : mode === "liquidate" ? `Sell to ${chain.cash.symbol}` : "Withdraw tokens"}
          </button>
        </div>
      )}
    </div>
  );
};

const Option: FC<{ active: boolean; onClick: () => void; title: string; disabled: boolean }> = ({ active, onClick, title, disabled }) => (
  <button role="radio" aria-checked={active} onClick={onClick} disabled={disabled} className="flex w-fit max-w-full gap-3 py-3 text-left disabled:opacity-60">
    <span className={`mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border ${active ? "border-text-primary" : "border-surface-3"}`}>
      {active && <span className="h-1.5 w-1.5 rounded-full bg-text-primary" />}
    </span>
    <span className={`block text-sm font-semibold ${active ? "text-text-primary" : "text-text-secondary"}`}>{title}</span>
  </button>
);
