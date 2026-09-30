// Signing out without signing out everywhere. wagmi's disconnect for a browser
// wallet calls wallet_revokePermissions, which the wallet applies to the whole
// site, so the app and the deposit widget (each with a wagmi config of its own)
// would log each other out. This forgets the wallet in one config only.

import { disconnect, type Config } from "@wagmi/core";

export async function forgetWallet(config: Config): Promise<void> {
  const { connections, current } = config.state;
  const connector = current ? connections.get(current)?.connector : undefined;
  if (!connector) return;
  if (connector.type !== "injected") {
    // WalletConnect and the like keep a session per config; ending it here is safe.
    await disconnect(config);
    return;
  }
  // What wagmi's disconnect action does, minus asking the wallet to revoke access.
  const events = (config as unknown as { _internal: { events: Record<"change" | "connect" | "disconnect", unknown> } })._internal.events;
  connector.emitter.off("change", events.change as never);
  connector.emitter.off("disconnect", events.disconnect as never);
  connector.emitter.on("connect", events.connect as never);
  // The shim flag stops this config from reconnecting the wallet by itself.
  await config.storage?.setItem(`${connector.id}.disconnected` as never, true as never);
  await config.storage?.removeItem("injected.connected" as never);
  config.setState((state) => ({ ...state, connections: new Map(), current: null, status: "disconnected" }));
}
