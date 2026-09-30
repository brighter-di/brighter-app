import { type FC, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useConnect, useConnection, useConnectors, useConfig as useWagmiConfig } from "wagmi";
import { forgetWallet } from "@/lib/forgetWallet";
import { useConfig } from "@/hooks/queries";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { shortAddr } from "@/lib/format";
import { friendlyError } from "@/lib/errors";

// Named for the account menu, which reports whatever chain the wallet is on.
const CHAIN_NAMES: Record<number, string> = { 1: "Ethereum", 56: "BNB Chain", 137: "Polygon", 8453: "Base", 42161: "Arbitrum One" };

export const ConnectButton: FC<{ block?: boolean; label?: string }> = ({ block, label = "Sign in" }) => {
  const { address, isConnected, chainId } = useConnection();
  const [open, setOpen] = useState(false);

  if (isConnected && address && !block) {
    return (
      <div className="flex items-center gap-1.5">
        <AccountMenu address={address} chainId={chainId} />
      </div>
    );
  }
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          block
            ? "flex h-11 w-full items-center justify-center rounded-lg bg-text-primary text-sm font-semibold text-surface-0 transition-opacity hover:opacity-90"
            : "h-9 rounded-lg bg-text-primary px-3.5 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90"
        }
      >
        {block ? (
          label
        ) : (
          <>
            <span className="sm:hidden">Sign in</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        )}
      </button>
      {open && <ConnectModal onClose={() => setOpen(false)} />}
    </>
  );
};

const ConnectModal: FC<{ onClose: () => void }> = ({ onClose }) => {
  const connectors = useConnectors();
  const { mutate: connect, isPending, variables, error } = useConnect();
  const { isConnected } = useConnection();

  useEffect(() => {
    if (isConnected) onClose();
  }, [isConnected, onClose]);

  // EIP-6963 announces each installed wallet separately; the generic
  // "Injected" entry only matters when nothing announced itself.
  const announced = connectors.filter((c) => c.id !== "injected");
  const list = announced.length > 0 ? announced : connectors;

  return (
    <Modal title="Sign in" onClose={onClose} width={380}>
      <div className="flex flex-col gap-1.5">
        {list.map((c) => {
          const pending = isPending && variables?.connector === c;
          return (
            <button
              key={c.uid}
              onClick={() => connect({ connector: c })}
              disabled={isPending}
              className="flex h-12 items-center gap-3 rounded-lg bg-surface-1 px-3.5 text-left text-sm font-medium text-text-primary transition-colors hover:bg-surface-2 disabled:opacity-60"
            >
              {c.icon ? (
                <img src={c.icon} alt="" className="h-7 w-7 rounded-md" />
              ) : (
                <span className="grid h-7 w-7 place-items-center rounded-md bg-surface-3 text-[10px] font-bold text-text-secondary">
                  {c.name.slice(0, 2)}
                </span>
              )}
              <span className="flex-1">{c.id === "injected" ? "Browser wallet" : c.name}</span>
              {pending && <Spinner size="sm" />}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{friendlyError(error)}</p>}
      <p className="mt-4 text-xs leading-relaxed text-text-muted">
        Any EVM wallet works — MetaMask, Rabby, Binance Wallet, OKX, Trust. Brighter never holds your funds: your
        portfolio lives in a smart account only your wallet can withdraw from.
      </p>
    </Modal>
  );
};

const AccountMenu: FC<{ address: string; chainId: number | undefined }> = ({ address, chainId }) => {
  const wagmiConfig = useWagmiConfig();
  const navigate = useNavigate();
  // Signing out must not revoke the site's access, which would also log out the
  // deposit wallet. Pages for a signed-in wallet no longer apply, so land on the strategies.
  const disconnect = () => void forgetWallet(wagmiConfig).then(() => navigate("/strategies"));
  const { data: config } = useConfig();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  const chainName = chainId ? (CHAIN_NAMES[chainId] ?? `Chain ${chainId}`) : "—";
  const onEnabled = chainId != null && (config?.chains ?? []).some((c) => c.chainId === chainId);

  return (
    <div ref={ref} className="relative">
      {/* The address itself lives in the menu; the header just shows who is
          connected. */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account ${shortAddr(address)}`}
        title={shortAddr(address)}
        className={`grid h-9 w-9 place-items-center rounded-full bg-surface-2 transition-colors hover:bg-surface-3 ${
          onEnabled ? "text-text-secondary hover:text-text-primary" : "text-warn"
        }`}
      >
        {/* The button is the circle; the figure sits inside it. */}
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="8.4" r="3.6" />
          <path d="M5.7 19.5a6.6 6.6 0 0 1 12.6 0" />
        </svg>
      </button>
      {open && (
        <div className="fade-in absolute right-0 top-11 z-50 w-60 rounded-xl border border-surface-border bg-surface-0 p-1.5 shadow-lg">
          <div className="px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <span title={address} className="font-mono text-sm text-text-primary">{shortAddr(address)}</span>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={copy}
                  aria-label={copied ? "Address copied" : "Copy address"}
                  title={copied ? "Copied" : "Copy address"}
                  className={`grid h-8 w-8 place-items-center rounded-lg transition-colors hover:bg-surface-1 focus-visible:outline-2 focus-visible:outline-accent ${copied ? "text-success" : "text-text-secondary hover:text-text-primary"}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {copied ? (
                      <path d="m5 12 4 4L19 6" />
                    ) : (
                      <>
                        <rect x="9" y="9" width="11" height="11" rx="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </>
                    )}
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    disconnect();
                    setOpen(false);
                  }}
                  aria-label="Disconnect wallet"
                  title="Disconnect"
                  className="grid h-8 w-8 place-items-center rounded-lg text-text-secondary transition-colors hover:bg-surface-1 hover:text-danger focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M9 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M14 8l4 4-4 4M8 12h10" />
                  </svg>
                </button>
              </div>
            </div>
            <div className={`mt-0.5 text-sm ${onEnabled ? "text-text-muted" : "text-warn"}`}>
              {chainName}
              {!onEnabled && " · not supported"}
            </div>
          </div>
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="block w-full rounded-lg px-2.5 py-2 text-left text-base text-text-secondary hover:bg-surface-1 hover:text-text-primary"
          >
            Settings
          </Link>
        </div>
      )}
    </div>
  );
};
