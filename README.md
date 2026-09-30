# Brighter — frontend

React app for Brighter's rule-based strategy portfolios on EVM chains.

- **Strategies** (`/`) — the five templates with 5-year backtests vs SPY and
  what each holds right now.
- **Strategy** (`/strategies/:id?<param>=…`) — tune parameters (they live in
  the URL), backtest over 1–10 years, see the current allocation, and invest.
- **Portfolios** (`/portfolios`) — the connected wallet's portfolios:
  holdings vs target, deposit, rebalance now, sell to cash or withdraw.

Stack: React 19, Vite 8, Tailwind 4, React Router 7, TanStack Query 5,
wagmi 3 + viem. It talks only to the Go backend (`../backend`); no key or
paid RPC is ever bundled.

```bash
npm install
npm run dev      # :3000, proxies /api → http://localhost:3200 (override with BACKEND_URL)
npm run build
npm run lint
```

Env (`.env.example`): `VITE_API_URL` for production builds,
`VITE_WALLETCONNECT_PROJECT_ID` to enable WalletConnect. Which chains are
offered comes from the backend's `/v1/config`.

Deploy: `vercel --prod --yes` from this directory.
