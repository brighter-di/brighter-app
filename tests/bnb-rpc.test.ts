import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createPublicClient } from "viem";
import { bsc } from "viem/chains";
import { bnbTransport } from "../src/lib/bnbRpc.ts";

test("BNB receipt lookup falls back when one RPC refuses archive requests", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  const hash = `0x${'a'.repeat(64)}` as const;
  const receipt = { transactionHash: hash, status: '0x1', logs: [] };
  globalThis.fetch = async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    calls.push(url);
    return url.includes('primary')
      ? Response.json({ jsonrpc: "2.0", id: 1, error: { code: -32602, message: "Archive requests require a personal token" } })
      : Response.json({ jsonrpc: "2.0", id: 1, result: receipt });
  };
  try {
    const client = createPublicClient({ chain: bsc, transport: bnbTransport(['https://primary.example','https://secondary.example']) });
    assert.deepEqual(await client.request({ method: 'eth_getTransactionReceipt', params: [hash] }), receipt);
    assert.deepEqual(calls, ['https://primary.example/','https://secondary.example/']);
  } finally { globalThis.fetch = originalFetch; }
});
