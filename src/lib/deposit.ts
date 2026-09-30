// Pure helpers for the cross-chain deposit UI: finding chains and tokens,
// reading amounts, and summarising a route. No SDK at runtime, so they test
// without a browser.

import { formatUnits, parseUnits } from "viem";
import type { ExtendedChain, Route, Token, TokenAmount } from "@lifi/sdk";

/** How the chain list and wallet button name each chain family. */
export const ECOSYSTEM_LABEL: Record<string, string> = { EVM: "EVM", SVM: "Solana", UTXO: "Bitcoin", MVM: "Sui", TVM: "Tron", STL: "Stellar" };

/** At most this many tokens render at once; search narrows the rest. */
export const TOKENS_SHOWN = 100;

/** EVM addresses compare case-insensitively; Solana's base58 addresses do not. */
export const tokenKey = (token: Pick<Token, "chainId" | "address">) =>
  `${token.chainId}:${token.address.startsWith("0x") ? token.address.toLowerCase() : token.address}`;

export function filterChains(chains: ExtendedChain[], query: string): ExtendedChain[] {
  const q = query.trim().toLowerCase();
  if (!q) return chains;
  return chains.filter((chain) => chain.name.toLowerCase().includes(q) || chain.key.toLowerCase().includes(q) || String(chain.id) === q);
}

export interface RankedToken {
  token: Token;
  /** What the connected wallet holds, in base units; undefined when unknown. */
  amount?: bigint;
  valueUSD: number;
}

/**
 * Tokens matching the search, an exact symbol first, then what the wallet
 * holds by value, then LI.FI's own order.
 */
export function rankTokens(tokens: Token[], balances: Map<string, TokenAmount> | undefined, query: string): { shown: RankedToken[]; matching: number } {
  const q = query.trim().toLowerCase();
  const rows: (RankedToken & { index: number; exact: boolean })[] = [];
  tokens.forEach((token, index) => {
    const symbol = token.symbol.toLowerCase();
    if (q && !(symbol.includes(q) || token.name.toLowerCase().includes(q) || token.address.toLowerCase() === q)) return;
    const amount = balances?.get(tokenKey(token))?.amount;
    const valueUSD = amount ? Number(formatUnits(amount, token.decimals)) * Number(token.priceUSD || 0) : 0;
    rows.push({ token, amount, valueUSD, index, exact: q !== "" && symbol === q });
  });
  const held = (row: RankedToken) => ((row.amount ?? 0n) > 0n ? 1 : 0);
  rows.sort((a, b) => Number(b.exact) - Number(a.exact) || b.valueUSD - a.valueUSD || held(b) - held(a) || a.index - b.index);
  return { shown: rows.slice(0, TOKENS_SHOWN).map(({ token, amount, valueUSD }) => ({ token, amount, valueUSD })), matching: rows.length };
}

/** A positive amount in base units, or null for anything else. */
export function parseAmount(text: string, decimals: number): bigint | null {
  const value = text.trim();
  if (!value || value === "." || !/^\d*\.?\d*$/.test(value)) return null;
  try {
    const parsed = parseUnits(value, decimals);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}

export interface RouteSummary {
  receive: string;
  receiveMin: string;
  receiveUSD: number;
  seconds: number;
  gasUSD: number;
  feesUSD: number;
  tools: { key: string; name: string; logoURI: string }[];
}

export function routeSummary(route: Route): RouteSummary {
  const tools = new Map<string, { key: string; name: string; logoURI: string }>();
  for (const step of route.steps) {
    const inner = "includedSteps" in step && step.includedSteps?.length ? step.includedSteps : [step];
    for (const s of inner) tools.set(s.toolDetails.key, { key: s.toolDetails.key, name: s.toolDetails.name, logoURI: s.toolDetails.logoURI });
  }
  return {
    receive: formatUnits(BigInt(route.toAmount), route.toToken.decimals),
    receiveMin: formatUnits(BigInt(route.toAmountMin), route.toToken.decimals),
    receiveUSD: Number(route.toAmountUSD || 0),
    seconds: route.steps.reduce((sum, step) => sum + (step.estimate?.executionDuration ?? 0), 0),
    gasUSD: Number(route.gasCostUSD || 0),
    feesUSD: route.steps.reduce((sum, step) => sum + (step.estimate?.feeCosts ?? []).reduce((total, fee) => total + Number(fee.amountUSD || 0), 0), 0),
    tools: [...tools.values()],
  };
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `~${Math.max(1, Math.round(seconds))}s`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `~${minutes} min` : `~${Math.round(minutes / 60)} h`;
}

