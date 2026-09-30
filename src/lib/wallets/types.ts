import type { SDKProvider } from "@lifi/sdk";

/** LI.FI's chain families, each with wallets of its own. */
export type Ecosystem = "EVM" | "SVM" | "UTXO" | "MVM" | "TVM" | "STL";

export interface WalletOption {
  id: string;
  name: string;
  icon?: string;
  /** False when this browser has no such wallet, so connecting would fail. */
  installed: boolean;
}

export interface ConnectedWallet {
  address: string;
  name: string;
  icon?: string;
}

export interface WalletsState {
  wallets: WalletOption[];
  account: ConnectedWallet | null;
  /** Id of the wallet a connection is being asked of. */
  connecting: string | null;
}

/**
 * One ecosystem's source wallets: a connection of their own, apart from the
 * wallet the app is signed in with, and the SDK provider that signs with it.
 */
export interface EcosystemWallets {
  provider: SDKProvider;
  getState(): WalletsState;
  subscribe(listener: () => void): () => void;
  connect(id: string): Promise<void>;
  disconnect(): Promise<void>;
}
