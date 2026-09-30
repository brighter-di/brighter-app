const BASE = "https://li.quest/v1/";
const USDT = "0x55d398326f99059ff775485246999027b3197955";
const GET_PATHS = new Set(["chains", "tokens", "token", "tools", "connections", "quote", "quote/toAmount", "status", "gas/prices", "analytics/transfers"]);
const POST_PATHS = new Set(["advanced/routes", "advanced/stepTransaction"]);
const buckets = new Map<string, number[]>();
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export const config = { runtime: "edge" };

export function createLiFiHandler(getKey: () => string | undefined) {
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    if (origin && origin !== url.origin) return json({ message: "Origin not allowed." }, 403);
    const path = url.searchParams.get("_lifi_path") ?? url.pathname.replace(/^\/api\/lifi\/?/, "");
    if (!path) return json({ configured: Boolean(getKey()) });
    const allowed = request.method === "GET" ? GET_PATHS : request.method === "POST" ? POST_PATHS : undefined;
    if (!allowed?.has(path) && !(request.method === "GET" && /^gas\/suggestion\/\d+$/.test(path))) return json({ message: "Unsupported funding request." }, 404);
    const key = getKey();
    if (!key) return json({ message: "Cross-chain funding is not configured." }, 503);
    const now = Date.now();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const recent = (buckets.get(ip) ?? []).filter((time) => now - time < 60_000);
    if (recent.length >= 120) return json({ message: "Too many funding requests. Please try again shortly." }, 429);
    buckets.set(ip, [...recent, now]);
    if (buckets.size > 5000) for (const [id, times] of buckets) if (times.every((time) => now - time >= 60_000)) buckets.delete(id);

    url.searchParams.delete("_lifi_path");
    url.searchParams.delete("apiKey");
    let body: Record<string, unknown> | undefined;
    if (request.method === "POST") {
      const text = await request.text();
      if (text.length > 262_144) return json({ message: "Funding request is too large." }, 413);
      try { body = JSON.parse(text); } catch { return json({ message: "Invalid funding request." }, 400); }
      if (!body || typeof body !== "object" || Array.isArray(body)) return json({ message: "Invalid funding request." }, 400);
    }
    if (path === "quote" || path === "quote/toAmount") {
      if (url.searchParams.get("toChain") !== "56" || url.searchParams.get("toToken")?.toLowerCase() !== USDT) return json({ message: "Funding must receive USDT on BNB Chain." }, 400);
      url.searchParams.set("integrator", "brighter");
      url.searchParams.delete("fee");
    }
    if (path === "advanced/routes") {
      if (body?.toChainId !== 56 || typeof body.toTokenAddress !== "string" || body.toTokenAddress.toLowerCase() !== USDT) return json({ message: "Funding must receive USDT on BNB Chain." }, 400);
      body.options = { ...(typeof body.options === "object" && body.options !== null ? body.options : {}), integrator: "brighter", fee: 0 };
    }
    const upstreamUrl = new URL(path, BASE);
    upstreamUrl.search = url.searchParams.toString();
    try {
      const upstream = await fetch(upstreamUrl, {
        method: request.method,
        headers: { "x-lifi-api-key": key, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
      });
      const headers = new Headers({ "content-type": "application/json", "cache-control": "no-store" });
      const retryAfter = upstream.headers.get("retry-after");
      if (retryAfter) headers.set("retry-after", retryAfter);
      return new Response(upstream.body, { status: upstream.status, headers });
    } catch {
      return json({ message: "The funding service could not be reached. Please try again." }, 502);
    }
  };
}

export default createLiFiHandler(() => process.env.LIFI_API_KEY);
