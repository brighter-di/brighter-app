// One place that turns backend, the portfolio engine and wallet failures into copy a user
// can act on. Specific patterns come first so a generic 4xx never swallows a
// more actionable one.

import { ApiError } from "@/api/client";

const TRUNCATE_AT = 280;

export function friendlyError(raw: unknown): string {
  const err = raw as { name?: string; shortMessage?: string; message?: string } | null;
  const m = err?.shortMessage ?? err?.message ?? String(raw ?? "");
  const lo = m.toLowerCase();

  // Wallet
  if (err?.name === "UserRejectedRequestError" || lo.includes("user rejected") || lo.includes("rejected the request") || lo.includes("user denied")) {
    return "Cancelled in your wallet.";
  }
  if (lo.includes("insufficient funds")) {
    return "Your wallet doesn't have enough native gas (BNB / ETH) for this transaction.";
  }
  if (lo.includes("chain") && lo.includes("not configured")) {
    return "Your wallet is on a network this page can't use. Switch networks and try again.";
  }

  if (raw instanceof ApiError) {
    switch (raw.code) {
      case "TRADING_UNAVAILABLE":
        return "Investing is temporarily unavailable. Please try again later.";
      case "RESEARCH_UNAVAILABLE":
        return "Strategy data is temporarily unavailable. Please try again later.";
      case "TARGET_NOT_EXECUTABLE":
        return raw.message;
      case "RATE_LIMITED":
        return "Too many requests — give it a few seconds.";
      case "PORTFOLIO_NOT_FOUND":
        return "This portfolio isn't available anymore. Refresh the page.";
    }
    if (raw.status === 429) {
      return raw.retryAfter
        ? `A rebalance was just requested. Try again in ${raw.retryAfter}s.`
        : "A rebalance was just requested. Try again shortly.";
    }
    if (lo.includes("unsupported_settlement_asset") || lo.includes("api_221")) {
      return "Ondo only redeems into the chain's cash asset. Please contact support.";
    }
    if (lo.includes("nothing_to_liquidate") || lo.includes("api_220")) {
      return "Nothing to sell yet — holdings below the minimum swap size stay in the portfolio.";
    }
    if (lo.includes("expired")) return "The authorization expired. Start again.";
    if (lo.includes("signature does not match")) {
      return "The signature didn't match. Make sure the connected wallet is the one that owns this portfolio, then retry.";
    }
    if (lo.includes("market") && lo.includes("closed")) {
      return "US markets are closed — Ondo only trades during market hours. It will retry at the next session.";
    }
  }
  return m.length > TRUNCATE_AT ? m.slice(0, TRUNCATE_AT) + "…" : m;
}
