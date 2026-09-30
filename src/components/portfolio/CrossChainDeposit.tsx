// Cross-chain deposits, drawn in Brighter's own style on the LI.FI SDK rather
// than its widget. Pick where the money comes from (chain, token, wallet), see
// the best routes to USDT at this portfolio's deposit address, and run one.
// The destination is fixed here and enforced again by /api/lifi.

import { useCallback, useMemo, useState } from "react";
import { createPublicClient, formatUnits, type Hex } from "viem";
import { bsc } from "viem/chains";
import { executeRoute, resumeRoute, type ExecutionOptions, type Route, type RouteExtended, type RoutesRequest } from "@lifi/sdk";
import type { Chain, Portfolio } from "@/api/client";
import { FUNDING_CHAIN, FUNDING_TOKEN, INCOMPLETE_FUNDING_ERROR, fundingConfirmationMessage, hasIncompleteFunding, matchesFundingDestination, verifyFundingDeposit } from "@/lib/funding";
import { bnbTransport } from "@/lib/bnbRpc";
import { lifi } from "@/lib/lifi";
import { useEcosystemWallets, type Ecosystem } from "@/lib/wallets";
import { parseAmount, routeSummary, tokenKey } from "@/lib/deposit";
import { announceDeposit } from "@/lib/depositReport";
import { friendlyError } from "@/lib/errors";
import { formatBalance, formatUsd, shortAddr } from "@/lib/format";
import { useDebounced } from "@/hooks/useDebounced";
import { useDepositRoutes, useLifiChains, useLifiTokens, useTokenBalances } from "@/hooks/useLifi";
import { AssetLogo } from "@/components/ui/AssetLogo";
import { Spinner } from "@/components/ui/Spinner";
import { ChainList } from "@/components/deposit/ChainList";
import { TokenList } from "@/components/deposit/TokenList";
import { RouteList } from "@/components/deposit/RouteList";
import { SourceWallet } from "@/components/deposit/SourceWallet";
import { RouteProgress } from "@/components/deposit/RouteProgress";
import { FundedPortfolio } from "./FundPanel";

/**
 * A deposit can start from any chain LI.FI routes from, so "Brighter doesn't
 * support your network" is never the right thing to say here — the chain is
 * supported and something else went wrong reaching it.
 */
function depositError(error: unknown): string {
  const message = friendlyError(error);
  return message.includes("can't use")
    ? "Couldn't reach your wallet's network. Switch networks in your wallet, or reload and try again."
    : message;
}

const publicClient = createPublicClient({ chain: bsc, transport: bnbTransport() });
const ETHEREUM = 1;

type Phase = "idle" | "running" | "checking" | "failed" | "unverified" | "done";

export default function CrossChainDeposit({ portfolio, chain }: { portfolio: Portfolio; chain: Chain }) {
  const chains = useLifiChains();

  // The chain chosen, else Ethereum.
  const [chainChoice, setChainChoice] = useState<number>();
  const fromChain = chains.data?.find((c) => c.id === chainChoice) ?? chains.data?.find((c) => c.id === ETHEREUM) ?? chains.data?.[0];
  const ecosystem = (fromChain?.chainType ?? "EVM") as Ecosystem;
  // The paying wallet's libraries load for this chain's family only.
  const source = useEcosystemWallets(fromChain ? ecosystem : undefined);
  const address = source.state.account?.address;

  const tokens = useLifiTokens(fromChain?.id);
  const balances = useTokenBalances(fromChain, address, tokens.data);
  // The token chosen on this chain, else its native token.
  const [tokenChoice, setTokenChoice] = useState<string>();
  const token =
    tokens.data?.find((t) => tokenKey(t) === tokenChoice) ??
    tokens.data?.find((t) => fromChain && t.address.toLowerCase() === fromChain.nativeToken.address.toLowerCase()) ??
    tokens.data?.[0];

  const [amount, setAmount] = useState("");
  const typed = useDebounced(amount, 450);
  const value = token ? parseAmount(amount, token.decimals) : null;
  const quoted = token ? parseAmount(typed, token.decimals) : null;
  const held = token ? balances.data?.get(tokenKey(token))?.amount : undefined;
  const insufficient = value != null && held != null && value > held;

  const [phase, setPhase] = useState<Phase>("idle");
  const busy = phase === "running" || phase === "checking";

  const request = useMemo<RoutesRequest | undefined>(
    () =>
      fromChain && token && quoted
        ? {
            fromChainId: fromChain.id,
            fromTokenAddress: token.address,
            fromAmount: quoted.toString(),
            fromAddress: address,
            toChainId: FUNDING_CHAIN,
            toTokenAddress: FUNDING_TOKEN,
            toAddress: portfolio.depositAddress,
            options: { order: "CHEAPEST", slippage: 0.005 },
          }
        : undefined,
    [fromChain, token, quoted, address, portfolio.depositAddress],
  );
  const routes = useDepositRoutes(request, !busy);
  const options = request ? (routes.data?.routes ?? []) : [];
  const [routeChoice, setRouteChoice] = useState<string>();
  const route = options.find((r) => r.id === routeChoice) ?? options[0];
  const stale = routes.isPlaceholderData || value !== quoted;

  const [execution, setExecution] = useState<RouteExtended>();
  const [problem, setProblem] = useState("");
  const [deposit, setDeposit] = useState<{ amount: string; hash: Hex }>();
  const [rate, setRate] = useState<{ amount: string; symbol: string; answer: (accept: boolean) => void }>();

  const verify = useCallback(
    async (done: RouteExtended) => {
      if (!matchesFundingDestination(done, portfolio.depositAddress)) {
        const reason = "This transfer does not target this portfolio’s USDT address on BNB Chain.";
        setProblem(reason);
        setPhase("failed");
        announceDeposit(portfolio.portfolioId, { status: "failed", reason });
        return;
      }
      if (hasIncompleteFunding(done)) {
        setProblem(INCOMPLETE_FUNDING_ERROR);
        setPhase("failed");
        announceDeposit(portfolio.portfolioId, { status: "failed", reason: INCOMPLETE_FUNDING_ERROR });
        return;
      }
      setPhase("checking");
      setProblem("");
      try {
        const result = await verifyFundingDeposit(done, portfolio.depositAddress, publicClient);
        setDeposit({ amount: formatUnits(result.amount, chain.cash.decimals), hash: result.hash });
        setPhase("done");
        announceDeposit(portfolio.portfolioId, { status: "succeeded", txHash: result.hash });
      } catch (error) {
        setProblem(fundingConfirmationMessage(error));
        setPhase("unverified");
        announceDeposit(portfolio.portfolioId, { status: "failed", reason: fundingConfirmationMessage(error) });
      }
    },
    [portfolio.depositAddress, portfolio.portfolioId, chain.cash.decimals],
  );

  const run = async (target: Route, resume: boolean) => {
    setPhase("running");
    setProblem("");
    setExecution(target as RouteExtended);
    const hooks: ExecutionOptions = {
      updateRouteHook: (updated) => setExecution({ ...updated }),
      // A changed rate is the user's call, asked in our own UI.
      acceptExchangeRateUpdateHook: (params) =>
        new Promise<boolean>((resolve) =>
          setRate({
            amount: Number(formatUnits(BigInt(params.newToAmount), params.toToken.decimals)).toLocaleString("en-US", { maximumFractionDigits: 2 }),
            symbol: params.toToken.symbol,
            answer: (accept) => {
              setRate(undefined);
              resolve(accept);
            },
          }),
        ),
    };
    try {
      const done = await (resume ? resumeRoute(lifi, target, hooks) : executeRoute(lifi, target, hooks));
      await verify(done);
    } catch (error) {
      const reason = depositError(error);
      setProblem(reason);
      setPhase("failed");
      announceDeposit(portfolio.portfolioId, { status: "failed", reason });
    }
  };

  const summary = route ? routeSummary(route) : undefined;
  const label = !token
    ? "Choose a token"
    : !address
      ? "Connect a wallet first"
      : !value
        ? "Enter an amount"
        : insufficient
          ? `Not enough ${token.symbol}`
          : phase === "running"
            ? "Depositing…"
            : phase === "checking"
              ? "Confirming USDT on BNB Chain…"
              : !route
                ? routes.isFetching || stale
                  ? "Finding routes…"
                  : "No route available"
                : `Deposit ${Number(summary!.receive).toLocaleString("en-US", { maximumFractionDigits: 2 })} USDT`;
  const canDeposit = !!route && !!address && !!value && !insufficient && !busy && !stale && phase !== "done";
  const routeMessage = !token ? "Choose a token to see routes." : !value ? "Enter an amount to see routes." : routes.error ? friendlyError(routes.error) : "No route to USDT on BNB Chain for this token and amount. Try another token or amount.";

  return (
    <div className="grid gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.25fr)]">
      <div inert={busy || undefined} className={busy ? "opacity-60" : ""}>
        <ChainList
          chains={chains.data}
          loading={chains.isPending}
          error={chains.isError}
          selected={fromChain?.id}
          onSelect={(c) => {
            setChainChoice(c.id);
            setTokenChoice(undefined);
            setRouteChoice(undefined);
            setAmount("");
          }}
        />
      </div>
      <div inert={busy || undefined} className={busy ? "opacity-60" : ""}>
        <TokenList
          chainName={fromChain?.name}
          tokens={tokens.data}
          loading={!!fromChain && tokens.isPending}
          error={tokens.isError}
          balances={balances.data}
          balancesLoading={balances.isFetching}
          selected={token ? tokenKey(token) : undefined}
          onSelect={(t) => {
            setTokenChoice(tokenKey(t));
            setRouteChoice(undefined);
          }}
        />
      </div>

      <section aria-label="Deposit" className="min-w-0 space-y-6">
        <SourceWallet
          ecosystem={ecosystem}
          wallets={source.wallets}
          state={source.state}
          loading={source.loading}
          loadError={source.error}
          disabled={busy}
          onConnected={(connected) => {
            // A wallet of another family pays from that family's chain.
            if (connected === ecosystem) return;
            const target = chains.data?.find((c) => c.chainType === connected);
            if (!target) return;
            setChainChoice(target.id);
            setTokenChoice(undefined);
            setRouteChoice(undefined);
            setAmount("");
          }}
        />

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={`deposit-amount-${portfolio.portfolioId}`} className="text-sm font-medium text-text-secondary">Amount</label>
            {token && held != null && (
              <button
                type="button"
                disabled={busy || held === 0n}
                onClick={() => setAmount(formatUnits(held, token.decimals))}
                className="font-mono text-xs text-text-muted hover:text-accent disabled:hover:text-text-muted"
              >
                Balance {formatBalance(Number(formatUnits(held, token.decimals)))} · Max
              </button>
            )}
          </div>
          <div className={`flex items-center gap-2 border-b py-2 ${insufficient ? "border-danger" : "border-surface-3 focus-within:border-text-primary"}`}>
            <input
              id={`deposit-amount-${portfolio.portfolioId}`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amount}
              disabled={busy}
              onChange={(e) => setAmount(e.target.value.replace(",", "."))}
              className="min-w-0 flex-1 bg-transparent font-mono text-2xl font-semibold tabular-nums text-text-primary placeholder:text-text-muted focus:outline-none"
            />
            {token && (
              <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-text-primary">
                <AssetLogo src={token.logoURI} symbol={token.symbol} size={20} />
                {token.symbol}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex justify-between gap-3 text-xs">
            <span className="font-mono text-text-muted">{token && value ? `≈ ${formatUsd(Number(formatUnits(value, token.decimals)) * Number(token.priceUSD || 0))}` : ""}</span>
            {insufficient && <span className="text-danger">More than your wallet holds.</span>}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-text-muted">
            Arrives as USDT on BNB Chain ·{" "}
            <span className="font-mono" title={portfolio.depositAddress}>{shortAddr(portfolio.depositAddress)}</span>
          </p>
        </div>

        <RouteList
          routes={options}
          loading={!!request && routes.isFetching}
          stale={stale}
          message={routeMessage}
          selected={route?.id}
          onSelect={(r) => setRouteChoice(r.id)}
          disabled={busy}
        />

        {phase === "done" && deposit ? (
          <FundedPortfolio portfolio={portfolio} chain={chain} amount={deposit.amount} hash={deposit.hash} />
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => route && void run(route, false)}
              disabled={!canDeposit}
              className="flex h-11 w-fit max-w-full items-center justify-center gap-2 rounded-md bg-text-primary px-5 text-sm font-semibold text-surface-0 transition-opacity hover:opacity-90 disabled:bg-surface-3 disabled:text-text-muted"
            >
              {busy && <Spinner size="sm" tone="invert" />}
              {label}
            </button>

            {rate && (
              <div role="alertdialog" aria-label="Rate changed" className="border-l-2 border-warn bg-surface-1 px-4 py-3">
                <p className="text-sm text-text-primary">The rate moved: you'd now receive about {rate.amount} {rate.symbol}.</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => rate.answer(true)} className="h-9 rounded-md bg-text-primary px-3.5 text-sm font-semibold text-surface-0 hover:opacity-90">Continue</button>
                  <button type="button" onClick={() => rate.answer(false)} className="h-9 rounded-md px-3.5 text-sm font-semibold text-text-primary hover:bg-surface-2">Cancel</button>
                </div>
              </div>
            )}

            {execution && phase !== "idle" && <RouteProgress route={execution} />}

            {problem && (
              <div className="space-y-2" aria-live="polite">
                <p className="text-sm leading-relaxed text-warn">{problem}</p>
                {phase === "unverified" && execution && (
                  <button type="button" onClick={() => void verify(execution)} className="h-9 text-sm font-semibold text-accent">Check deposit again</button>
                )}
                {phase === "failed" && execution && !hasIncompleteFunding(execution) && (
                  <button type="button" onClick={() => void run(execution, true)} className="h-9 text-sm font-semibold text-accent">Try again</button>
                )}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
