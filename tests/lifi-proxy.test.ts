import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createLiFiHandler } from "../api/lifi.ts";

const USDT = "0x55d398326f99059ff775485246999027b3197955";
const handler = createLiFiHandler(() => "private-test-key");
const request = (path: string, init?: RequestInit) => new Request(`https://brighter.fi/api/lifi/${path}`, init);

test("funding proxy rejects unsupported endpoints and foreign origins", async () => {
  for (const path of ["../private", "relayer/relay", "https://evil.example", "advanced/routes"]) assert.equal((await handler(request(path))).status, 404);
  assert.equal((await handler(request("chains", { headers: { origin: "https://evil.example" } }))).status, 403);
});
test("funding proxy reports missing configuration without leaking a key", async () => {
  const empty = createLiFiHandler(() => undefined);
  assert.equal((await empty(request("chains"))).status, 503);
  assert.deepEqual(await empty(request("")).then((r) => r.json()), { configured: false });
  assert.deepEqual(await handler(request("")).then((r) => r.json()), { configured: true });
});
test("quotes and routes cannot change the destination away from BNB USDT", async () => {
  for (const query of [`toChain=1&toToken=${USDT}`, "toChain=56&toToken=wrong", "toChain=56"]) assert.equal((await handler(request(`quote?${query}`))).status, 400);
  for (const body of [{ toChainId: 1, toTokenAddress: USDT }, { toChainId: 56, toTokenAddress: "wrong" }, [], null]) {
    assert.equal((await handler(request("advanced/routes", { method: "POST", body: JSON.stringify(body) }))).status, 400);
  }
  assert.equal((await handler(request("advanced/routes", { method: "POST", body: "{" }))).status, 400);
  assert.equal((await handler(request("advanced/routes", { method: "POST", body: " ".repeat(262145) }))).status, 413);
});
test("proxy keeps authentication server-side, source details intact, and integrator fees at zero", async () => {
  const originalFetch = globalThis.fetch;
  const calls: { url: URL; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: new URL(String(input)), init });
    return Response.json({ routes: [] });
  };
  try {
    const response = await handler(request(`quote?fromChain=1&fromToken=ETH&fromAmount=100&toChain=56&toToken=${USDT}&fee=0.1&apiKey=browser-key`));
    assert.equal(response.status, 200);
    assert.equal(calls[0].url.origin, "https://li.quest");
    assert.equal(calls[0].url.searchParams.get("fromChain"), "1");
    assert.equal(calls[0].url.searchParams.get("integrator"), "brighter");
    assert.equal(calls[0].url.searchParams.has("fee"), false);
    assert.equal(calls[0].url.searchParams.has("apiKey"), false);
    assert.equal(new Headers(calls[0].init?.headers).get("x-lifi-api-key"), "private-test-key");
    assert.equal((await response.text()).includes("private-test-key"), false);
    const body = { fromChainId: 1, fromTokenAddress: "ETH", fromAmount: "100", toAddress: "portfolio", toChainId: 56, toTokenAddress: USDT, options: { slippage: 0.01, fee: 0.1, integrator: "other" } };
    await handler(request("advanced/routes", { method: "POST", body: JSON.stringify(body) }));
    const forwarded = JSON.parse(String(calls[1].init?.body));
    assert.equal(forwarded.fromAmount, "100");
    assert.equal(forwarded.toAddress, "portfolio");
    assert.deepEqual(forwarded.options, { slippage: 0.01, fee: 0, integrator: "brighter" });
    await handler(new Request("https://brighter.fi/api/lifi?_lifi_path=gas/suggestion/56"));
    assert.equal(calls[2].url.pathname, "/v1/gas/suggestion/56");
    assert.equal(calls[2].url.searchParams.has("_lifi_path"), false);
  } finally { globalThis.fetch = originalFetch; }
});
