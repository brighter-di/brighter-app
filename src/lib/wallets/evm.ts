// EVM source wallets on a wagmi config of their own, stored under their own
// key, so connecting one here never changes the wallet the app is signed in
// with. The config knows every EVM chain LI.FI routes from, so the wallet can
// be switched (or have the chain added) to any of them.

import { forgetWallet } from "@/lib/forgetWallet";
import {
  connect,
  createConfig,
  createStorage,
  getConnection,
  getConnectorClient,
  getConnectors,
  injected,
  reconnect,
  switchChain,
  watchConnection,
  watchConnectors,
} from "@wagmi/core";
import { walletConnect } from "@wagmi/connectors";
import { createClient, http, type Chain } from "viem";
import { arbitrum, avalanche, base, bsc, linea, mainnet, optimism, polygon, scroll, zksync } from "viem/chains";
import { ChainType, getChains } from "@lifi/sdk";
import { EthereumProvider, convertExtendedChain } from "@lifi/sdk-provider-ethereum";
import { lifi } from "@/lib/lifi";
import { createWalletsStore } from "./store";
import type { EcosystemWallets } from "./types";

const WC_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined;

export async function createWallets(): Promise<EcosystemWallets> {
  const config = createConfig({
    // Seeded with the chains people actually hold funds on, so a wallet
    // parked on one is understood even if the list below never arrives.
    // LI.FI's full list replaces this the moment it does.
    chains: [mainnet, base, bsc, arbitrum, optimism, polygon, avalanche, linea, scroll, zksync],
    connectors: [
      injected({ shimDisconnect: true }),
      ...(WC_PROJECT_ID
        ? [walletConnect({ projectId: WC_PROJECT_ID, showQrModal: true, customStoragePrefix: "brighter-deposit", metadata: { name: "Brighter", description: "Deposit from any chain", url: "https://brighter.fi", icons: ["https://brighter.fi/logo-b.webp"] } })]
        : []),
    ],
    storage: createStorage({ key: "brighter.deposit-evm", storage: window.localStorage }),
    client: ({ chain }) => createClient({ chain, transport: http() }),
  });

  // Every EVM chain LI.FI knows, with its RPCs and explorer, so switching works
  // anywhere. This used to be attempted once and its failure swallowed, which
  // left the config holding Ethereum alone — and then a wallet on any other
  // chain read as "a network Brighter doesn't support", which is the one thing
  // a cross-chain deposit must never say. It is now also retried on demand,
  // just before a switch that has nowhere to go.
  const install = async () => {
    const chains = await getChains(lifi, { chainTypes: [ChainType.EVM] });
    const converted = chains.map((chain) => convertExtendedChain(chain) as Chain).filter((chain) => chain?.id != null);
    if (converted.length === 0) return;
    (config as unknown as { _internal: { chains: { setState(chains: readonly Chain[]): void } } })._internal.chains.setState(converted);
  };
  const knows = (chainId: number) => config.chains.some((c) => c.id === chainId);
  await install().catch((error: unknown) => {
    // Not fatal: the seed above covers the usual chains, and the calls below
    // ask again when one is missing.
    console.warn("Could not load the chains a deposit can start from", error);
  });

  /** Ask LI.FI again before giving up on a chain the config has not got. */
  const ensure = async (chainId: number | undefined) => {
    if (chainId == null || knows(chainId)) return;
    await install().catch(() => undefined);
    if (!knows(chainId)) {
      // Never the generic "unsupported network" copy: on this page any chain
      // is supported, so say which one could not be loaded.
      throw new Error(`Chain ${chainId} could not be loaded for this deposit. Reload the page and try again.`);
    }
  };

  const store = createWalletsStore();
  const refresh = () => {
    const connectors = getConnectors(config);
    // EIP-6963 announces each installed wallet; the generic entry matters only when none did.
    const announced = connectors.filter((c) => c.id !== "injected");
    const connection = getConnection(config);
    store.set({
      wallets: (announced.length > 0 ? announced : connectors).map((c) => ({ id: c.uid, name: c.id === "injected" ? "Browser wallet" : c.name, icon: c.icon, installed: true })),
      account: connection.status === "connected" ? { address: connection.address, name: connection.connector.name, icon: connection.connector.icon } : null,
    });
  };
  refresh();
  watchConnectors(config, { onChange: refresh });
  watchConnection(config, { onChange: refresh });
  void reconnect(config).finally(refresh);

  return {
    provider: EthereumProvider({
      // Both of these fail on a chain the config has not got — and this one
      // runs first, on whatever chain the wallet happens to be sitting on.
      getWalletClient: async () => {
        await ensure(getConnection(config).chainId);
        return getConnectorClient(config);
      },
      switchChain: async (chainId) => {
        await ensure(chainId);
        await switchChain(config, { chainId: chainId as 1 });
        return getConnectorClient(config, { chainId: chainId as 1 });
      },
      disableMessageSigning: true,
    }),
    getState: store.get,
    subscribe: store.subscribe,
    async connect(id) {
      const connector = getConnectors(config).find((c) => c.uid === id);
      if (!connector) throw new Error("That wallet is no longer available.");
      store.set({ connecting: id });
      try {
        await connect(config, { connector });
      } finally {
        store.set({ connecting: null });
        refresh();
      }
    },
    async disconnect() {
      // Never revoke the site's access: that would sign the app out too.
      await forgetWallet(config);
      refresh();
    },
  };
}
