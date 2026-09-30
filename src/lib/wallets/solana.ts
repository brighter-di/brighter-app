// Solana source wallets through wallet-standard: every installed wallet that
// speaks Solana (Phantom, Solflare, Backpack, …) announces itself. The one
// used last reconnects silently.

import { getWallets } from "@wallet-standard/app";
import type { Wallet } from "@wallet-standard/base";
import {
  StandardConnect,
  StandardDisconnect,
  StandardEvents,
  type StandardConnectFeature,
  type StandardDisconnectFeature,
  type StandardEventsFeature,
} from "@wallet-standard/features";
import { SolanaProvider } from "@lifi/sdk-provider-solana";
import { createWalletsStore, lastWallet } from "./store";
import type { EcosystemWallets } from "./types";

const speaksSolana = (wallet: Wallet) => wallet.chains.some((chain) => chain.startsWith("solana:")) && StandardConnect in wallet.features;

export function createWallets(): EcosystemWallets {
  const store = createWalletsStore();
  const registry = getWallets();
  let available: Wallet[] = [];
  let selected: Wallet | null = null;
  let stopEvents: (() => void) | undefined;

  async function disconnect() {
    const wallet = selected;
    stopEvents?.();
    stopEvents = undefined;
    selected = null;
    store.set({ account: null });
    lastWallet.set("solana", null);
    try {
      await (wallet?.features[StandardDisconnect] as StandardDisconnectFeature[typeof StandardDisconnect] | undefined)?.disconnect();
    } catch {
      /* the wallet may already be gone */
    }
  }

  async function connect(id: string, silent = false) {
    const wallet = available.find((w) => w.name === id);
    if (!wallet) throw new Error("That wallet is no longer available.");
    store.set({ connecting: id });
    try {
      const { accounts } = await (wallet.features[StandardConnect] as StandardConnectFeature[typeof StandardConnect]).connect({ silent });
      const account = accounts[0] ?? wallet.accounts[0];
      if (!account) throw new Error(`${wallet.name} did not share an account.`);
      stopEvents?.();
      stopEvents = (wallet.features[StandardEvents] as StandardEventsFeature[typeof StandardEvents] | undefined)?.on("change", ({ accounts: changed }) => {
        if (!changed) return;
        if (changed.length === 0) void disconnect();
        else store.set({ account: { address: changed[0].address, name: wallet.name, icon: wallet.icon } });
      });
      selected = wallet;
      store.set({ account: { address: account.address, name: wallet.name, icon: wallet.icon } });
      lastWallet.set("solana", wallet.name);
    } catch (error) {
      if (!silent) throw error;
    } finally {
      store.set({ connecting: null });
    }
  }

  const refresh = () => {
    const seen = new Set<string>();
    available = registry.get().filter((wallet) => speaksSolana(wallet) && !seen.has(wallet.name) && Boolean(seen.add(wallet.name)));
    store.set({ wallets: available.map((wallet) => ({ id: wallet.name, name: wallet.name, icon: wallet.icon, installed: true })) });
    if (selected && !available.includes(selected)) void disconnect();
  };
  refresh();
  registry.on("register", refresh);
  registry.on("unregister", refresh);
  const last = lastWallet.get("solana");
  if (last && available.some((wallet) => wallet.name === last)) void connect(last, true);

  return {
    provider: SolanaProvider({
      getWallet: async () => {
        if (!selected) throw new Error("Connect a Solana wallet first.");
        return selected;
      },
    }),
    getState: store.get,
    subscribe: store.subscribe,
    connect: (id) => connect(id),
    disconnect,
  };
}
