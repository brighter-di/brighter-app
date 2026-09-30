import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createSolanaHandler } from "../api/solana.ts";

const rpcRequest = (method: string) => new Request('https://brighter.fi/api/solana', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: [] }) });
test("Solana proxy keeps private URLs server-side and retries token-account reads", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = async (input) => {
    calls.push(String(input));
    return calls.length === 1 ? Response.json({ error: { code: 403, message: 'Blocked' } }, { status: 403 }) : Response.json({ jsonrpc: '2.0', id: 1, result: { value: [{ account: 'USDC account' }] } });
  };
  try {
    const handler = createSolanaHandler(() => ['https://primary.example/private-key','https://secondary.example/private-key']);
    const response = await handler(rpcRequest('getTokenAccountsByOwner'));
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.equal(text.includes('USDC account'), true);
    assert.equal(text.includes('private-key'), false);
    assert.equal(calls.length, 2);
    assert.equal((await handler(rpcRequest('admin_setLogFilter')).then(r => r.json())).error.code, -32601);
    assert.equal(calls.length, 2);
  } finally { globalThis.fetch = originalFetch; }
});
test("Solana proxy rejects foreign origins and malformed requests and accepts no-argument methods", async () => {
  const handler = createSolanaHandler(() => []);
  assert.equal((await handler(new Request('https://brighter.fi/api/solana', { headers: { origin: 'https://evil.example' } }))).status, 403);
  assert.equal((await handler(new Request('https://brighter.fi/api/solana', { method: 'POST', body: '{' }))).status, 400);
  assert.equal((await handler(new Request('https://brighter.fi/api/solana', { method: 'POST', body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getSlot' }) }))).status, 503);
});
