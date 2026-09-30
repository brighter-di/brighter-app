// Bitcoin source wallets through bigmi: Xverse, UniSat, Leather, OKX and the
// other browser wallets LI.FI supports, each checked for being installed.

import {
  binance,
  bitget,
  connect,
  createConfig,
  ctrl,
  disconnect,
  getAccount,
  getConnectorClient,
  getConnectors,
  leather,
  magicEden,
  okx,
  onekey,
  oyl,
  reconnect,
  unhosted,
  unisat,
  watchAccount,
  watchConnectors,
  xverse,
} from "@bigmi/client";
import { bitcoin, createClient, http } from "@bigmi/core";
import { BitcoinProvider } from "@lifi/sdk-provider-bitcoin";
import { createWalletsStore } from "./store";
import type { EcosystemWallets } from "./types";

export function createWallets(): EcosystemWallets {
  const config = createConfig({
    chains: [bitcoin],
    connectors: [xverse(), unisat(), leather(), okx(), ctrl(), onekey(), binance(), bitget(), oyl(), magicEden(), unhosted()],
    client: ({ chain }) => createClient({ chain, transport: http() }),
    multiInjectedProviderDiscovery: false,
  });

  const store = createWalletsStore();
  let installed = new Map<string, boolean>();
  const refresh = () => {
    const account = getAccount(config);
    store.set({
      wallets: getConnectors(config).map((c) => ({ id: c.uid, name: c.name, icon: c.icon, installed: installed.get(c.uid) ?? false })),
      account: account.status === "connected" ? { address: account.account.address, name: account.connector.name, icon: account.connector.icon } : null,
    });
  };
  const probe = async () => {
    const found = await Promise.all(getConnectors(config).map(async (c) => [c.uid, await c.getProvider().then((provider) => Boolean(provider), () => false)] as const));
    installed = new Map(found);
    refresh();
  };
  refresh();
  void probe();
  watchConnectors(config, { onChange: refresh });
  watchAccount(config, { onChange: refresh });
  void reconnect(config).finally(refresh);

  return {
    provider: BitcoinProvider({ getWalletClient: () => getConnectorClient(config) }),
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
      const { connector } = getAccount(config);
      if (connector) await disconnect(config, { connector });
      refresh();
    },
  };
}
