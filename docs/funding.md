# Portfolio funding

The Deposit button opens `/portfolios/:id/deposit`, a page listing the two funding methods, one per row. Selecting one navigates to `/portfolios/:id/deposit/direct` or `/portfolios/:id/deposit/lifi`. Deposit options and browser Back return to the choice page; each page can also be opened directly. Creating a portfolio navigates straight to its deposit options.

- Direct: transfer the portfolio chain’s cash token from the connected owner wallet, or copy its deposit address. The form switches networks only when the user deposits.
- LI.FI: choose a supported source chain and token. The destination is locked to BNB Chain (56), USDT (`0x55d398326f99059ff775485246999027b3197955`, 18 decimals), and the portfolio’s deposit address. Source availability depends on LI.FI routes, liquidity and amount. No Brighter integrator fee is charged; route fees and gas still apply.

The widget loads only when selected. EVM, Solana, Bitcoin, Sui, Tron and Stellar wallet providers use the widget’s own wallet management. Regular transaction routes are enabled; gasless/relayer routes are disabled. The app does not automatically switch the source wallet back to BNB. Source selection and transfer history are persisted under a portfolio-specific widget key. Switching funding methods keeps both panels mounted. Reopen LI.FI for the same portfolio to resume or inspect a transfer.

Successful deposits return to the portfolio page and refresh holdings. Direct transfers require a successful receipt with two confirmations. LI.FI transfers return only after the destination USDT receipt is verified; pending, reverted, partial, refunded or unverified transfers remain on the deposit page. Immediate investment is available through Rebalance now on the portfolio page.

LI.FI uses its wide variant in the full page width, with its route/chain sidebar on larger screens and compact behavior on smaller screens. Action buttons fit their content and have a 280px maximum width.

## API key

Set `LIFI_API_KEY` in `.env.local` for Vite development and in Vercel’s production environment. It must never have a `VITE_` prefix. The browser calls `/api/lifi/*`; the server adds the key to the upstream `x-lifi-api-key` header. The same proxy handler serves local development and the Vercel Edge function. It allows only funding metadata, quotes, routes, transaction preparation, history, gas and status endpoints. Quotes and route requests must target BNB USDT. No signed transactions, wallet credentials or keys are forwarded from browser headers.

The proxy has a per-instance request throttle, a 256 KiB body limit and a 30-second upstream timeout. Use Vercel’s platform rate controls if distributed abuse protection becomes necessary. `GET /api/lifi` reports whether configuration exists without revealing its value.

Solana uses `/api/solana` with private `SOLANA_RPC_URL` and optional `SOLANA_RPC_FALLBACK_URL` settings. The server restricts RPC methods to wallet balance and transaction operations and retries the next provider when one fails. The URLs and their credentials never enter the widget config. Public Solana endpoints can block token-account queries, leaving SPL balances unavailable even when USDC is in the catalog.

## Completion and recovery

A widget completion event alone does not prove a deposit. The app checks the route’s destination, rejects partial/refunded results, and reads successful BNB transaction receipts with two confirmations using independent BNB RPC endpoints with fallback. It sums only real USDT Transfer logs to this portfolio, then refreshes positions and returns to the portfolio page. Source transactions, approvals, other tokens and other recipients do not count. A receipt-provider outage gives a confirmation retry message rather than claiming the exchange failed or displaying RPC diagnostics.

If receipt confirmation times out, Check deposit again retries verification. A partial bridge route can leave intermediate tokens, and a refunded route can return funds to the source. Check LI.FI’s transfer details/history before making another deposit. Intermediate portfolio assets must be recovered using the portfolio withdrawal flow rather than treated as USDT funding.

`npm test` verifies destination enforcement, server-side authentication, zero integrator fees, receipt proof, partial/refund rejection and hash deduplication. Actual wallet approval, bridge execution and funding require a manual test with a funded wallet; these tests never send money.
