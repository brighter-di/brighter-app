// The reads the cross-chain deposit makes of LI.FI, through the SDK client and
// our /api/lifi proxy.

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChainType, getChains, getRoutes, getTokenBalances, getTokens, type ExtendedChain, type RoutesRequest, type Token } from "@lifi/sdk";
import { lifi } from "@/lib/lifi";
import { loadWallets, type Ecosystem } from "@/lib/wallets";
import { tokenKey } from "@/lib/deposit";

/** Every chain family LI.FI routes from: EVM, Solana, Bitcoin, Sui, Tron and Stellar. */
export function useLifiChains() {
  return useQuery({
    queryKey: ["lifi", "chains"],
    queryFn: ({ signal }) => getChains(lifi, { chainTypes: [ChainType.EVM, ChainType.SVM, ChainType.UTXO, ChainType.MVM, ChainType.TVM, ChainType.STL] }, { signal }),
    staleTime: 60 * 60_000,
  });
}

export function useLifiTokens(chainId: number | undefined) {
  return useQuery({
    queryKey: ["lifi", "tokens", chainId],
    queryFn: async ({ signal }) => (await getTokens(lifi, { chains: [chainId!] }, { signal })).tokens[chainId!] ?? [],
    enabled: chainId != null,
    staleTime: 30 * 60_000,
  });
}

/** What the wallet holds of a chain's tokens, keyed by tokenKey. Reading them needs that chain's provider. */
export function useTokenBalances(chain: ExtendedChain | undefined, address: string | undefined, tokens: Token[] | undefined) {
  return useQuery({
    queryKey: ["lifi", "balances", chain?.id, address],
    queryFn: async () => {
      await loadWallets(chain!.chainType as Ecosystem);
      return new Map((await getTokenBalances(lifi, address!, tokens!)).map((amount) => [tokenKey(amount), amount]));
    },
    enabled: !!chain && !!address && !!tokens?.length,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** Routes to USDT at the portfolio's deposit address; refreshed while quotes can expire. */
export function useDepositRoutes(request: RoutesRequest | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["lifi", "routes", request],
    queryFn: ({ signal }) => getRoutes(lifi, request!, { signal }),
    enabled: !!request && enabled,
    staleTime: 30_000,
    refetchInterval: enabled ? 60_000 : false,
    placeholderData: keepPreviousData,
    retry: 1,
  });
}
