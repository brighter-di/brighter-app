import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { ExtendedChain, Route, Token, TokenAmount } from "@lifi/sdk";
import { ECOSYSTEM_LABEL, TOKENS_SHOWN, filterChains, formatDuration, parseAmount, rankTokens, routeSummary, tokenKey } from "../src/lib/deposit.ts";

test("every LI.FI chain family has a name", () => {
  assert.deepEqual(Object.keys(ECOSYSTEM_LABEL).sort(), ["EVM", "MVM", "STL", "SVM", "TVM", "UTXO"]);
  assert.equal(ECOSYSTEM_LABEL.UTXO, "Bitcoin");
});

const token = (symbol: string, address: string, extra: Partial<Token> = {}): Token =>
  ({ chainId: 1, address, symbol, name: `${symbol} token`, decimals: 6, priceUSD: "1", ...extra }) as Token;

test("token keys ignore EVM address case but keep Solana's", () => {
  assert.equal(tokenKey({ chainId: 1, address: "0xAbC" }), "1:0xabc");
  assert.equal(tokenKey({ chainId: 1151111081099710, address: "So11111111111111111111111111111111111111112" }), "1151111081099710:So11111111111111111111111111111111111111112");
});

test("chains are found by name, key or id", () => {
  const chains = [{ id: 1, key: "eth", name: "Ethereum" }, { id: 42161, key: "arb", name: "Arbitrum" }] as ExtendedChain[];
  assert.deepEqual(filterChains(chains, "arb").map((c) => c.id), [42161]);
  assert.deepEqual(filterChains(chains, "ETHER").map((c) => c.id), [1]);
  assert.deepEqual(filterChains(chains, "42161").map((c) => c.id), [42161]);
  assert.equal(filterChains(chains, " ").length, 2);
});

test("tokens rank an exact symbol first, then held value, then LI.FI's order", () => {
  const usdc = token("USDC", "0x1");
  const usdt = token("USDT", "0x2");
  const weth = token("WETH", "0x3", { decimals: 18, priceUSD: "3000" });
  const dust = token("DUST", "0x4");
  const balances = new Map<string, TokenAmount>([
    [tokenKey(usdt), { ...usdt, amount: 50_000_000n }],
    [tokenKey(weth), { ...weth, amount: 10n ** 17n }],
    [tokenKey(dust), { ...dust, amount: 0n }],
  ]);
  assert.deepEqual(rankTokens([usdc, usdt, weth, dust], balances, "").shown.map((r) => r.token.symbol), ["WETH", "USDT", "USDC", "DUST"]);
  assert.deepEqual(rankTokens([usdc, usdt, weth, dust], balances, "usd").shown.map((r) => r.token.symbol), ["USDT", "USDC"]);
  assert.deepEqual(rankTokens([usdc, usdt, weth], balances, "usdc").shown.map((r) => r.token.symbol), ["USDC", "USDT"].slice(0, 1));
  assert.equal(rankTokens([usdc, usdt], undefined, "0x2").shown[0].token.symbol, "USDT");

  const many = Array.from({ length: TOKENS_SHOWN + 5 }, (_, i) => token(`T${i}`, `0x${i}`));
  const ranked = rankTokens(many, undefined, "");
  assert.equal(ranked.shown.length, TOKENS_SHOWN);
  assert.equal(ranked.matching, TOKENS_SHOWN + 5);
});

test("amounts parse to positive base units only", () => {
  assert.equal(parseAmount("1.5", 6), 1_500_000n);
  assert.equal(parseAmount(".25", 6), 250_000n);
  for (const bad of ["", ".", "0", "0.000", "1,5", "abc", "-1", "1e3"]) assert.equal(parseAmount(bad, 6), null, bad);
});

test("a route summary adds durations and fees and lists each tool once", () => {
  const tool = (key: string) => ({ key, name: key.toUpperCase(), logoURI: `https://logo/${key}` });
  const route = {
    toAmount: "99500000", toAmountMin: "99000000", toAmountUSD: "99.5", gasCostUSD: "1.25",
    toToken: { decimals: 6 },
    steps: [
      { toolDetails: tool("lifi"), includedSteps: [{ toolDetails: tool("uniswap") }, { toolDetails: tool("stargate") }],
        estimate: { executionDuration: 30, feeCosts: [{ amountUSD: "0.30" }, { amountUSD: "0.20" }] } },
      { toolDetails: tool("stargate"), estimate: { executionDuration: 90, feeCosts: [] } },
    ],
  } as unknown as Route;
  const s = routeSummary(route);
  assert.equal(s.receive, "99.5");
  assert.equal(s.receiveMin, "99");
  assert.equal(s.seconds, 120);
  assert.equal(s.gasUSD, 1.25);
  assert.ok(Math.abs(s.feesUSD - 0.5) < 1e-9);
  assert.deepEqual(s.tools.map((t) => t.key), ["uniswap", "stargate"]);
});

test("durations read in seconds, minutes or hours", () => {
  assert.equal(formatDuration(0), "~1s");
  assert.equal(formatDuration(45), "~45s");
  assert.equal(formatDuration(150), "~3 min");
  assert.equal(formatDuration(7200), "~2 h");
});
