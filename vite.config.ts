import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { createLiFiHandler } from "./api/lifi";
import { createSolanaHandler } from "./api/solana";

/** The API's origin when it is an absolute URL; a relative base (the dev proxy) needs no preconnect. */
function apiOrigin(url: string | undefined): string | undefined {
  try {
    return url?.trim() ? new URL(url.trim()).origin : undefined;
  } catch {
    return undefined;
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const lifi = createLiFiHandler(() => env.LIFI_API_KEY);
  const solana = createSolanaHandler(() => [env.SOLANA_RPC_URL, env.SOLANA_RPC_FALLBACK_URL]);
  return {
    plugins: [react(), tailwindcss(), {
      // Open the connection to a separate API origin while the app downloads,
      // so the first request doesn't also pay for DNS and TLS. The API is
      // fetched without credentials, which is what plain `crossorigin` matches.
      name: "api-preconnect",
      transformIndexHtml() {
        const origin = apiOrigin(env.VITE_API_URL);
        return origin ? [{ tag: "link", attrs: { rel: "preconnect", href: origin, crossorigin: true }, injectTo: "head-prepend" }] : [];
      },
    }, {
      name: "lifi-funding-proxy",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const pathname = req.url?.split("?")[0];
          const handler = pathname === "/api/solana" ? solana : pathname?.startsWith("/api/lifi") ? lifi : undefined;
          if (!handler) return next();
          try {
            const chunks: Buffer[] = [];
            let bytes = 0;
            for await (const chunk of req) {
              bytes += chunk.length;
              if (bytes > 262_144) { res.writeHead(413); res.end(); return; }
              chunks.push(chunk);
            }
            const headers = new Headers();
            for (const [name, value] of Object.entries(req.headers)) if (value) headers.set(name, Array.isArray(value) ? value.join(",") : value);
            const response = await handler(new Request(`http://${req.headers.host}${req.url}`, {
              method: req.method, headers, body: chunks.length ? Buffer.concat(chunks).toString() : undefined,
            }));
            res.writeHead(response.status, Object.fromEntries(response.headers));
            res.end(await response.text());
          } catch { res.writeHead(502); res.end(); }
        });
      },
    }],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 3000,
      proxy: {
        // Strategy/portfolio requests go to the Go backend. Funding requests
        // use the server-side LI.FI handler above.
        "^/api(?!/(?:lifi|solana))": {
          target: process.env.BACKEND_URL ?? "http://localhost:3200",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ""),
        },
      },
    },
    build: {
      // Keep bundles out of /assets so no SPA route can ever collide with them
      // on Vercel's static handler.
      assetsDir: "static",
      rolldownOptions: {
        output: {
          codeSplitting: {
            // React, the router and react-query change far less often than
            // the app. In their own chunk they keep their hash, and the
            // browser's cached copy, across deploys that only touch app code.
            // viem/wagmi stay out: a group takes every module it matches, so
            // the parts only the cross-chain deposit uses would load up front.
            groups: [
              { name: "react", test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|@tanstack)[\\/]/ },
            ],
          },
        },
      },
    },
  };
});
