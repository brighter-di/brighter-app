// Confirmed funding returns to the portfolio, where the user can rebalance.

import { type FC, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { erc20Abi, formatUnits, parseUnits } from "viem";
import { useConnection, useReadContract, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import type { Chain, Portfolio } from "@/api/client";
import { keys, useConfig } from "@/hooks/queries";
import { describeSchedule, shortAddr } from "@/lib/format";
import { friendlyError } from "@/lib/errors";
import { announceDeposit } from "@/lib/depositReport";
import { ChainName } from "@/components/ui/ChainLogo";
import { InfoTip } from "@/components/ui/InfoTip";
import { Spinner } from "@/components/ui/Spinner";

export const FundPanel: FC<{ portfolio: Portfolio; chain: Chain }> = ({ portfolio, chain }) => {
  const { address, chainId: walletChainId, isConnected } = useConnection();
  const { data: config } = useConfig();
  const [amount, setAmount] = useState("");
  const [submittedAmount, setSubmittedAmount] = useState("");
  const [copied, setCopied] = useState(false);
  const cash = chain.cash;
  const isOwner = !!address && address.toLowerCase() === portfolio.owner;
  const schedule = describeSchedule(config?.schedule);

  const balance = useReadContract({
    address: cash.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: chain.chainId,
    query: { enabled: !!address },
  });
  const balanceHuman = balance.data != null ? Number(formatUnits(balance.data, cash.decimals)) : null;

  const { mutateAsync: switchChain, isPending: switching } = useSwitchChain();
  const transfer = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: transfer.data, chainId: chain.chainId, confirmations: 2, query: { enabled: !!transfer.data } });

  let value: bigint | null = null;
  try {
    value = amount && Number(amount) > 0 ? parseUnits(amount, cash.decimals) : null;
  } catch {
    value = null;
  }
  const insufficient = value != null && balance.data != null && value > balance.data;
  const busy = switching || transfer.isPending || receipt.isLoading;
  const canSend = isConnected && isOwner && value != null && !insufficient && !busy;

  const send = async () => {
    if (!value) return;
    try {
      if (walletChainId !== chain.chainId) await switchChain({ chainId: chain.chainId });
      setSubmittedAmount(formatUnits(value, cash.decimals));
      await transfer.mutateAsync({
        address: cash.address,
        abi: erc20Abi,
        functionName: "transfer",
        args: [portfolio.depositAddress, value],
        chainId: chain.chainId,
      });
    } catch (error) {
      // Cancelling in the wallet is not a failure worth telling anyone about.
      const reason = friendlyError(error);
      if (reason !== "Cancelled in your wallet.") announceDeposit(portfolio.portfolioId, { status: "failed", reason });
      throw error;
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(portfolio.depositAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  const txError = transfer.error ?? receipt.error;

  // Reported once the receipt lands, so the backend is told about a transfer
  // that actually settled. It reads the amount back off the chain itself.
  const reported = useRef<string | undefined>(undefined);
  useEffect(() => {
    const hash = receipt.data?.transactionHash;
    if (!hash || reported.current === hash) return;
    reported.current = hash;
    announceDeposit(portfolio.portfolioId, { status: "succeeded", txHash: hash });
  }, [receipt.data?.transactionHash, portfolio.portfolioId]);

  return (
    <div className="space-y-5">
      <div className="border-b border-surface-border pb-4">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span className="flex items-center gap-1.5">
            Deposit address on <ChainName chainId={chain.chainId} name={chain.name} size={12} className="text-text-secondary" />
          </span>
          <a href={`${chain.explorer}/address/${portfolio.depositAddress}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
            Explorer
          </a>
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <code className="min-w-0 flex-1 break-all font-mono text-xs text-text-primary">{portfolio.depositAddress}</code>
          <button onClick={copy} className="shrink-0 text-xs font-semibold text-accent hover:underline">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {receipt.isSuccess && receipt.data.status === "success" && transfer.data ? (
        <FundedPortfolio portfolio={portfolio} chain={chain} amount={submittedAmount} hash={transfer.data} />
      ) : (
        <div>
          <div className="flex items-baseline justify-between">
            <span className="flex items-center gap-1.5">
              <label htmlFor={`amt-${portfolio.portfolioId}`} className="text-sm font-medium text-text-secondary">
                Amount
              </label>
              <InfoTip align="left" body={`Deposits are invested at the next rebalance (${schedule}), or right away with "Rebalance now" on your portfolio page.`} />
            </span>
            {balanceHuman != null && (
              <button
                onClick={() => balance.data != null && setAmount(formatUnits(balance.data, cash.decimals))}
                disabled={!balance.data}
                className="font-mono text-xs text-text-muted hover:text-accent disabled:hover:text-text-muted"
              >
                Balance {balanceHuman.toLocaleString("en-US", { maximumFractionDigits: 2 })} · Max
              </button>
            )}
          </div>
          <div className={`flex items-center gap-2 border-b py-2 ${insufficient ? "border-danger" : "border-surface-3 focus-within:border-text-primary"}`}>
            <input
              id={`amt-${portfolio.portfolioId}`}
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={busy}
              className="min-w-0 flex-1 bg-transparent font-mono text-2xl font-semibold tabular-nums text-text-primary placeholder:text-text-muted focus:outline-none"
            />
            <span className="text-sm font-semibold text-text-primary">{cash.symbol}</span>
          </div>
          {insufficient && <p className="mt-1.5 text-sm leading-relaxed text-danger">More than your wallet holds.</p>}
          {!isOwner && isConnected && <p className="mt-1.5 text-sm leading-relaxed text-warn">Connect the wallet that owns this portfolio to deposit from it.</p>}
          {txError && <p className="mt-1.5 text-sm leading-relaxed text-danger">{friendlyError(txError)}</p>}
          {receipt.data?.status === "reverted" && <p className="mt-1.5 text-sm leading-relaxed text-danger">The deposit transaction reverted. No funds were deposited.</p>}
          <button
            onClick={() => void send().catch(() => undefined)}
            disabled={!canSend}
            className="mt-4 flex h-11 w-fit max-w-[280px] items-center justify-center gap-2 rounded-md bg-text-primary px-5 text-sm font-semibold text-surface-0 transition-opacity hover:opacity-90 disabled:bg-surface-3 disabled:text-text-muted"
          >
            {busy && <Spinner size="sm" tone="invert" />}
            {switching ? `Switching to ${chain.name}…` : transfer.isPending ? "Confirm in wallet…" : receipt.isLoading ? "Waiting for confirmation…" : "Deposit"}
          </button>
        </div>
      )}
    </div>
  );
};

export const FundedPortfolio: FC<{ portfolio: Portfolio; chain: Chain; amount: string; hash: `0x${string}` }> = ({ portfolio, chain, amount, hash }) => {
  const qc = useQueryClient();
  const navigate = useNavigate();
  useEffect(() => {
    void qc.invalidateQueries({ queryKey: keys.positions(portfolio.portfolioId) });
    navigate(`/portfolios/${portfolio.portfolioId}`, { replace: true });
  }, [qc, navigate, portfolio.portfolioId, hash]);
  return <div className="space-y-4">
    <div>
      <div className="text-sm font-semibold text-success">Deposited {amount} {chain.cash.symbol}</div>
      <a href={`${chain.explorer}/tx/${hash}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-accent hover:underline">{shortAddr(hash)}</a>
    </div>
  </div>;
};
