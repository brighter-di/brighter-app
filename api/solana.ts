const METHODS = new Set([
  "getSlot", "getBalance", "getTokenAccountsByOwner", "getAccountInfo", "getMultipleAccounts",
  "getLatestBlockhash", "getBlockHeight", "getSignatureStatuses", "getTransaction",
  "getMinimumBalanceForRentExemption", "getRecentPrioritizationFees", "simulateTransaction",
  "sendTransaction", "getGenesisHash", "getHealth", "getFeeForMessage", "getEpochInfo",
  "getBlock", "getBlockTime", "getSignaturesForAddress", "isBlockhashValid", "getVersion",
]);
const buckets = new Map<string, number[]>();
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
export const config = { runtime: "edge" };

export function createSolanaHandler(getUrls: () => string[]) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return json({ message: "Origin not allowed." }, 403);
    const urls = getUrls().filter(Boolean);
    if (request.method === "GET") return json({ configured: urls.length > 0 });
    if (request.method !== "POST") return json({ message: "Unsupported RPC request." }, 405);
    const text = await request.text();
    if (new TextEncoder().encode(text).length > 262_144) return json({ message: "RPC request is too large." }, 413);
    let body: { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };
    try { body = JSON.parse(text); } catch { return json({ message: "Invalid RPC request." }, 400); }
    if (!body || Array.isArray(body) || body.jsonrpc !== "2.0" || (body.params !== undefined && !Array.isArray(body.params))) return json({ message: "Invalid RPC request." }, 400);
    if (!body.method || !METHODS.has(body.method)) return json({ jsonrpc: "2.0", id: body.id ?? null, error: { code: -32601, message: "Method not supported." } });
    if (!urls.length) return json({ message: "Solana funding is not configured." }, 503);
    const now = Date.now();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const recent = (buckets.get(ip) ?? []).filter((time) => now - time < 60_000);
    if (recent.length >= 240) return json({ message: "Too many RPC requests. Please try again shortly." }, 429);
    buckets.set(ip, [...recent, now]);
    if (buckets.size > 5000) for (const [id, times] of buckets) if (times.every((time) => now - time >= 60_000)) buckets.delete(id);
    let rpcError: unknown;
    for (const url of urls) {
      try {
        const response = await fetch(url, {
          method: "POST", headers: { "content-type": "application/json" }, body: text,
          signal: AbortSignal.any([request.signal, AbortSignal.timeout(8_000)]),
        });
        if (!response.ok) continue;
        const result = await response.json();
        if (!result || typeof result !== "object" || !("jsonrpc" in result) || result.jsonrpc !== "2.0" || !("result" in result || "error" in result)) continue;
        if (!("error" in result && result.error)) return json(result);
        rpcError = result;
      } catch { /* Try the next configured provider without exposing its URL. */ }
    }
    return rpcError ? json(rpcError) : json({ jsonrpc: "2.0", id: body.id ?? null, error: { code: -32000, message: "Solana RPC is temporarily unavailable. Please try again." } });
  };
}

export default createSolanaHandler(() => [process.env.SOLANA_RPC_URL ?? "", process.env.SOLANA_RPC_FALLBACK_URL ?? ""]);
