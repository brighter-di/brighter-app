// The LI.FI SDK client for cross-chain deposits. Requests go through /api/lifi,
// which holds the API key and only lets a route end in USDT on BNB Chain.
// Signing providers join per ecosystem as their wallets load (lib/wallets).

import { ChainId, createClient, type SDKClient } from "@lifi/sdk";
import { BNB_RPC_URLS } from "@/lib/bnbRpc";
import { FUNDING_CHAIN } from "@/lib/funding";

export const lifi: SDKClient = createClient({
  integrator: "brighter",
  apiUrl: new URL("/api/lifi", window.location.origin).href,
  rpcUrls: { [FUNDING_CHAIN]: BNB_RPC_URLS, [ChainId.SOL]: [new URL("/api/solana", window.location.origin).href] },
  // Plain transactions the wallet signs itself: no relayed or gasless intents.
  routeOptions: { executionType: "transaction" },
});
