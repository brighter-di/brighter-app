// Stellar source wallets through Stellar Wallets Kit: Freighter, xBull,
// LOBSTR, Rabet, Hana, Klever, OneKey and Bitget, on the public network only.

import { KitEventType, Networks, StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import { FREIGHTER_ID, FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { XBULL_ID, xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import { LOBSTR_ID, LobstrModule } from "@creit.tech/stellar-wallets-kit/modules/lobstr";
import { RABET_ID, RabetModule } from "@creit.tech/stellar-wallets-kit/modules/rabet";
import { HANA_ID, HanaModule } from "@creit.tech/stellar-wallets-kit/modules/hana";
import { KLEVER_ID, KleverModule } from "@creit.tech/stellar-wallets-kit/modules/klever";
import { ONEKEY_ID, OneKeyModule } from "@creit.tech/stellar-wallets-kit/modules/onekey";
import { BITGET_WALLET_ID, BitgetModule } from "@creit.tech/stellar-wallets-kit/modules/bitget";
import { StellarProvider } from "@lifi/sdk-provider-stellar";
import { createWalletsStore } from "./store";
import type { EcosystemWallets } from "./types";

const ENABLED = [FREIGHTER_ID, XBULL_ID, LOBSTR_ID, RABET_ID, HANA_ID, KLEVER_ID, ONEKEY_ID, BITGET_WALLET_ID];
const NETWORK = Networks.PUBLIC;

const walletNetwork = () => StellarWalletsKit.getNetwork().then((n) => n.networkPassphrase || NETWORK, () => NETWORK);

export function createWallets(): EcosystemWallets {
  StellarWalletsKit.init({
    modules: [new FreighterModule(), new xBullModule(), new LobstrModule(), new RabetModule(), new HanaModule(), new KleverModule(), new OneKeyModule(), new BitgetModule()],
    network: NETWORK,
  });

  const store = createWalletsStore();
  let address: string | null = null;
  const selectedWallet = () => {
    try {
      const module = StellarWalletsKit.selectedModule;
      return ENABLED.includes(module.productId) ? { name: module.productName, icon: module.productIcon } : null;
    } catch {
      return null;
    }
  };
  const refreshAccount = () => {
    const wallet = address ? selectedWallet() : null;
    store.set({ account: address && wallet ? { address, name: wallet.name, icon: wallet.icon } : null });
  };
  void StellarWalletsKit.refreshSupportedWallets().then(
    (supported) =>
      store.set({
        wallets: supported
          .filter((wallet) => ENABLED.includes(wallet.id))
          .map((wallet) => ({
            id: wallet.id,
            name: wallet.name,
            icon: wallet.icon,
            // xBull announces itself only through its SDK object.
            installed: wallet.id === XBULL_ID ? Boolean((window as { xBullSDK?: unknown }).xBullSDK) : wallet.isAvailable,
          })),
      }),
    () => undefined,
  );
  StellarWalletsKit.on(KitEventType.STATE_UPDATED, (event) => {
    address = event.payload.address ?? null;
    refreshAccount();
  });
  StellarWalletsKit.on(KitEventType.DISCONNECT, () => {
    address = null;
    refreshAccount();
  });

  return {
    provider: StellarProvider({
      networkPassphrase: NETWORK,
      getWallet: async () => {
        const walletAddress = address;
        if (!walletAddress) throw new Error("Connect a Stellar wallet first.");
        return {
          address: walletAddress,
          networkPassphrase: await walletNetwork(),
          signTransaction: (xdr, opts) => StellarWalletsKit.signTransaction(xdr, { address: walletAddress, networkPassphrase: NETWORK, ...opts }),
          signAuthEntry: (authEntry, opts) => StellarWalletsKit.signAuthEntry(authEntry, { address: walletAddress, networkPassphrase: NETWORK, ...opts }),
        };
      },
    }),
    getState: store.get,
    subscribe: store.subscribe,
    async connect(id) {
      store.set({ connecting: id });
      try {
        StellarWalletsKit.setWallet(id);
        const result = await StellarWalletsKit.fetchAddress();
        if ((await walletNetwork()) !== NETWORK) {
          await StellarWalletsKit.disconnect().catch(() => undefined);
          throw new Error("This Stellar wallet is on another network. Switch it to the public network and connect again.");
        }
        address = result.address ?? null;
        refreshAccount();
      } finally {
        store.set({ connecting: null });
      }
    },
    async disconnect() {
      address = null;
      refreshAccount();
      await StellarWalletsKit.disconnect().catch(() => undefined);
    },
  };
}
