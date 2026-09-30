// Tron source wallets through TronWeb3's adapters: TronLink, OKX, TokenPocket,
// Bitget, Binance, Trust and the rest that work without extra setup.

// One package per wallet: the combined adapters package also bundles Ledger
// and EVM-flavoured adapters this page doesn't offer. Binance's adapter is left
// out: it pulls in WalletConnect, whose viem code the bundler then hoists into
// the first load of every page.
import { BackpackAdapter } from "@tronweb3/tronwallet-adapter-backpack";
import { BitKeepAdapter } from "@tronweb3/tronwallet-adapter-bitkeep";
import { BybitWalletAdapter } from "@tronweb3/tronwallet-adapter-bybit";
import { FoxWalletAdapter } from "@tronweb3/tronwallet-adapter-foxwallet";
import { GateWalletAdapter } from "@tronweb3/tronwallet-adapter-gatewallet";
import { GuardaAdapter } from "@tronweb3/tronwallet-adapter-guarda";
import { ImTokenAdapter } from "@tronweb3/tronwallet-adapter-imtoken";
import { MetaMaskAdapter } from "@tronweb3/tronwallet-adapter-metamask-tron";
import { OkxWalletAdapter } from "@tronweb3/tronwallet-adapter-okxwallet";
import { OneKeyAdapter } from "@tronweb3/tronwallet-adapter-onekey";
import { SafepalAdapter } from "@tronweb3/tronwallet-adapter-safepal";
import { TokenPocketAdapter } from "@tronweb3/tronwallet-adapter-tokenpocket";
import { TronLinkAdapter } from "@tronweb3/tronwallet-adapter-tronlink";
import { TrustAdapter } from "@tronweb3/tronwallet-adapter-trust";
import { WalletReadyState, type Adapter } from "@tronweb3/tronwallet-abstract-adapter";
import { TronProvider } from "@lifi/sdk-provider-tron";
import { createWalletsStore } from "./store";
import type { EcosystemWallets } from "./types";

export function createWallets(): EcosystemWallets {
  // Never send the user off to a wallet's website from a click here.
  const options = { openUrlWhenWalletNotFound: false };
  const adapters: Adapter[] = [
    new TronLinkAdapter(options),
    new OkxWalletAdapter(options),
    new TokenPocketAdapter(options),
    new BitKeepAdapter(options),
    new TrustAdapter(options),
    new MetaMaskAdapter(options),
    new BybitWalletAdapter(options),
    new GateWalletAdapter(options),
    new ImTokenAdapter(options),
    new FoxWalletAdapter(options),
    new GuardaAdapter(options),
    new SafepalAdapter(options),
    new OneKeyAdapter(options),
    new BackpackAdapter(options),
  ];

  let selected: Adapter | null = null;
  const provider = TronProvider({
    getWallet: async () => {
      if (!selected?.connected) throw new Error("Connect a Tron wallet first.");
      return selected;
    },
    multicallBatchSize: 40,
  });

  const store = createWalletsStore();
  const refresh = () => {
    // A wallet that hands back a non-Tron address isn't usable here.
    const address = selected?.connected ? selected.address : null;
    store.set({
      wallets: adapters.map((a) => ({ id: a.name, name: a.name, icon: a.icon, installed: a.readyState === WalletReadyState.Found })),
      account: selected && address && provider.isAddress(address) ? { address, name: selected.name, icon: selected.icon } : null,
    });
  };
  for (const adapter of adapters) {
    adapter.on("readyStateChanged", refresh);
    adapter.on("accountsChanged", refresh);
    adapter.on("disconnect", () => {
      if (adapter === selected) selected = null;
      refresh();
    });
  }
  refresh();

  return {
    provider,
    getState: store.get,
    subscribe: store.subscribe,
    async connect(id) {
      const adapter = adapters.find((a) => a.name === id);
      if (!adapter) throw new Error("That wallet is no longer available.");
      store.set({ connecting: id });
      try {
        await adapter.connect();
        selected = adapter;
      } finally {
        store.set({ connecting: null });
        refresh();
      }
    },
    async disconnect() {
      const adapter = selected;
      selected = null;
      refresh();
      await adapter?.disconnect().catch(() => undefined);
    },
  };
}
