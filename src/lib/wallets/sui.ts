// Sui source wallets through Mysten's dApp kit (its framework-free core),
// stored under a key of our own and reconnecting on the next visit.

import { CurrentAccountSigner, createDAppKit, type DAppKit } from "@mysten/dapp-kit-core";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";
import { ChainId } from "@lifi/sdk";
import { SuiProvider } from "@lifi/sdk-provider-sui";
import { lifi } from "@/lib/lifi";
import { createWalletsStore } from "./store";
import type { EcosystemWallets } from "./types";

/** Signs as the connected account, taking its address from the wallet rather than a public key. */
class WalletSigner extends CurrentAccountSigner {
  readonly #kit: DAppKit;
  constructor(kit: DAppKit) {
    super(kit);
    this.#kit = kit;
  }
  override toSuiAddress(): string {
    const { account } = this.#kit.stores.$connection.get();
    if (!account) throw new Error("Connect a Sui wallet first.");
    return account.address;
  }
}

export async function createWallets(): Promise<EcosystemWallets> {
  const sui = await lifi.getChainById(ChainId.SUI).catch(() => undefined);
  const kit = createDAppKit({
    networks: ["mainnet"],
    createClient: (network) => new SuiGrpcClient({ network, baseUrl: sui?.metamask?.rpcUrls[0] ?? getJsonRpcFullnodeUrl(network) }),
    autoConnect: true,
    storage: window.localStorage,
    storageKey: "brighter.deposit-sui",
  });

  const store = createWalletsStore();
  const refresh = () => {
    const connection = kit.stores.$connection.get();
    store.set({
      wallets: kit.stores.$wallets.get().map((wallet) => ({ id: wallet.name, name: wallet.name, icon: wallet.icon, installed: true })),
      account: connection.account && connection.wallet ? { address: connection.account.address, name: connection.wallet.name, icon: connection.wallet.icon } : null,
    });
  };
  refresh();
  kit.stores.$wallets.listen(refresh);
  kit.stores.$connection.listen(refresh);

  return {
    // The signer reads only the connection and signing actions, which don't depend on the kit's network list.
    provider: SuiProvider({ getClient: async () => kit.getClient(), getSigner: async () => new WalletSigner(kit as unknown as DAppKit) }),
    getState: store.get,
    subscribe: store.subscribe,
    async connect(id) {
      const wallet = kit.stores.$wallets.get().find((w) => w.name === id);
      if (!wallet) throw new Error("That wallet is no longer available.");
      store.set({ connecting: id });
      try {
        await kit.connectWallet({ wallet });
      } finally {
        store.set({ connecting: null });
        refresh();
      }
    },
    async disconnect() {
      await kit.disconnectWallet();
      refresh();
    },
  };
}
