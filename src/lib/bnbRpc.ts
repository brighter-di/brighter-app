import { fallback, http } from "viem";

// Public endpoints listed by BNB Chain. Receipt reads must survive a single
// provider's archive restriction or outage.
export const BNB_RPC_URLS = [
  "https://bsc-dataseed.bnbchain.org",
  "https://bsc-dataseed.defibit.io",
  "https://bsc-dataseed.ninicoin.io",
];

export const bnbTransport = (urls = BNB_RPC_URLS) => fallback(
  urls.map((url) => http(url, { timeout: 8_000 })),
  { retryCount: 1, retryDelay: 500 },
);
