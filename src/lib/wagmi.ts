// EVM wallet config. The chains Brighter has a token registry for are wired so
// a wallet can switch to either, but which ones are open for investment is
// decided by the backend (/v1/config) — the UI never offers a chain it hasn't
// listed.
//
// The rest are here only so a wallet parked on one is understood. wagmi cannot
// describe, or switch away from, a chain it has never heard of: a wallet
// sitting on Base used to read as "a network Brighter doesn't support" when
// all that was needed was to move it to BNB. Listing a chain here does not
// offer it — nothing reads this list to decide what a portfolio can run on.

import { createConfig, http } from "wagmi";
import { arbitrum, avalanche, base, bsc, linea, mainnet, optimism, polygon, scroll, zksync } from "wagmi/chains";
import { injected, walletConnect } from "@wagmi/connectors";
import { bnbTransport } from "./bnbRpc";

const WC_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;

export const wagmiConfig = createConfig({
  chains: [bsc, mainnet, base, arbitrum, optimism, polygon, avalanche, linea, scroll, zksync],
  // EIP-6963 discovery surfaces every installed browser wallet (MetaMask,
  // Rabby, Binance Wallet, OKX, Trust, …) as its own connector.
  connectors: [
    injected({ shimDisconnect: true }),
    ...(WC_PROJECT_ID
      ? [
          walletConnect({
            projectId: WC_PROJECT_ID,
            showQrModal: true,
            metadata: {
              name: "Brighter",
              description: "Rule-based portfolios of tokenized US stocks",
              url: "https://brighter.fi",
              icons: ["https://brighter.fi/logo-b.webp"],
            },
          }),
        ]
      : []),
  ],
  // Public endpoints only. Nothing paid is ever shipped to the browser.
  transports: {
    [bsc.id]: bnbTransport(),
    [mainnet.id]: http("https://ethereum-rpc.publicnode.com"),
    // The others are never read from — a wallet is only ever switched off them
    // — so each takes the chain's own default endpoint.
    [base.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
    [avalanche.id]: http(),
    [linea.id]: http(),
    [scroll.id]: http(),
    [zksync.id]: http(),
  },
});
