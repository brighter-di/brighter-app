// Source wallets for cross-chain deposits. An ecosystem's wallet libraries and
// its LI.FI SDK provider load only once a chain of that kind is chosen, and
// none of it touches the wallet the app is signed in with.

import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import type { SDKProvider } from "@lifi/sdk";
import { lifi } from "@/lib/lifi";
import * as evm from "./evm";
import type { Ecosystem, EcosystemWallets, WalletsState } from "./types";

export type { ConnectedWallet, Ecosystem, EcosystemWallets, WalletOption, WalletsState } from "./types";

const modules: Record<Ecosystem, () => Promise<{ createWallets: () => EcosystemWallets | Promise<EcosystemWallets> }>> = {
  // EVM ships with the deposit page itself: Ethereum is the chain it opens on,
  // so a separate chunk would only add a request.
  EVM: async () => evm,
  SVM: () => import("./solana"),
  UTXO: () => import("./bitcoin"),
  MVM: () => import("./sui"),
  TVM: () => import("./tron"),
  STL: () => import("./stellar"),
};

const loading = new Map<Ecosystem, Promise<EcosystemWallets>>();
const providers = new Map<Ecosystem, SDKProvider>();

/** Loads an ecosystem's wallets once and gives its SDK provider to the LI.FI client. */
export function loadWallets(ecosystem: Ecosystem): Promise<EcosystemWallets> {
  let pending = loading.get(ecosystem);
  if (!pending) {
    pending = modules[ecosystem]()
      .then((module) => module.createWallets())
      .then((wallets) => {
        providers.set(ecosystem, wallets.provider);
        lifi.setProviders([...providers.values()]);
        return wallets;
      });
    // A failed load (a network blip fetching the chunk) can be tried again.
    pending.catch(() => loading.delete(ecosystem));
    loading.set(ecosystem, pending);
  }
  return pending;
}

const EMPTY: WalletsState = { wallets: [], account: null, connecting: null };
const idle = () => () => {};

/** An ecosystem's wallets and their live state; nothing loads until an ecosystem is given. */
export function useEcosystemWallets(ecosystem: Ecosystem | undefined) {
  const loaded = useQuery({
    queryKey: ["deposit-wallets", ecosystem],
    queryFn: () => loadWallets(ecosystem!),
    enabled: !!ecosystem,
    staleTime: Infinity,
    gcTime: Infinity,
    structuralSharing: false,
    retry: 1,
  });
  const wallets = loaded.data;
  const state = useSyncExternalStore(wallets?.subscribe ?? idle, () => wallets?.getState() ?? EMPTY);
  return { wallets, state, loading: !!ecosystem && loaded.isPending, error: loaded.error };
}
