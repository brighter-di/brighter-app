import type { WalletsState } from "./types";

/** A minimal external store: every change replaces the state object, so React sees it. */
export function createWalletsStore() {
  let state: WalletsState = { wallets: [], account: null, connecting: null };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch: Partial<WalletsState>) {
      state = { ...state, ...patch };
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/** The wallet used last in an ecosystem, so it can reconnect without a prompt. */
export const lastWallet = {
  get(ecosystem: string): string | null {
    try {
      return localStorage.getItem(`brighter:deposit-wallet:${ecosystem}`);
    } catch {
      return null;
    }
  },
  set(ecosystem: string, id: string | null) {
    try {
      if (id) localStorage.setItem(`brighter:deposit-wallet:${ecosystem}`, id);
      else localStorage.removeItem(`brighter:deposit-wallet:${ecosystem}`);
    } catch {
      /* storage unavailable: the wallet just won't reconnect by itself */
    }
  },
};
