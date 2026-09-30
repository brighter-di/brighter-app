import { type FC, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { ECOSYSTEM_LABEL } from "@/lib/deposit";
import { friendlyError } from "@/lib/errors";
import { shortAddr } from "@/lib/format";
import { useEcosystemWallets, type Ecosystem, type EcosystemWallets, type WalletsState } from "@/lib/wallets";

const ECOSYSTEMS: Ecosystem[] = ["EVM", "SVM", "UTXO", "MVM", "TVM", "STL"];

/**
 * The wallet a deposit is paid from, of the chosen chain's family. A connection
 * of its own: the wallet the app is signed in with is left alone.
 */
export const SourceWallet: FC<{
  ecosystem: Ecosystem;
  wallets: EcosystemWallets | undefined;
  state: WalletsState;
  loading: boolean;
  loadError: unknown;
  disabled: boolean;
  /** A wallet of this family was connected; the deposit moves to its chain when that differs. */
  onConnected: (ecosystem: Ecosystem) => void;
}> = ({ ecosystem, wallets, state, loading, loadError, disabled, onConnected }) => {
  const [open, setOpen] = useState(false);
  const kind = ecosystem === "EVM" ? "wallet" : `${ECOSYSTEM_LABEL[ecosystem]} wallet`;
  const account = state.account;

  return (
    <div>
      <div className="text-sm font-medium text-text-secondary">From wallet</div>
      {account ? (
        <div className="mt-1.5 flex h-11 items-center gap-2.5 border-b border-surface-border">
          <WalletIcon src={account.icon} name={account.name} />
          <span className="min-w-0 flex-1 truncate font-mono text-sm text-text-primary" title={account.address}>{shortAddr(account.address)}</span>
          <span className="hidden truncate text-xs text-text-muted sm:inline">{account.name}</span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => void wallets?.disconnect()}
            className="shrink-0 text-xs font-semibold text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled}
          className="mt-1.5 flex h-11 w-fit items-center gap-2 rounded-md bg-text-primary px-5 text-sm font-semibold text-surface-0 transition-opacity hover:opacity-90 disabled:bg-surface-3 disabled:text-text-muted"
        >
          {loading && <Spinner size="sm" tone="invert" />}
          Connect {kind}
        </button>
      )}
      {loadError != null && <p className="mt-1.5 text-sm text-danger">Couldn't load {kind}s. Reload the page and try again.</p>}
      {open && (
        <WalletPicker
          initial={ecosystem}
          onClose={() => setOpen(false)}
          onConnected={(connected) => {
            setOpen(false);
            onConnected(connected);
          }}
        />
      )}
    </div>
  );
};

const WalletIcon: FC<{ src?: string; name: string }> = ({ src, name }) =>
  src ? (
    <img src={src} alt="" className="h-7 w-7 shrink-0 rounded-md" />
  ) : (
    <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-surface-3 text-[10px] font-bold text-text-secondary">
      {name.slice(0, 2)}
    </span>
  );

/**
 * Every wallet family LI.FI supports, one tab each; a family's wallet code
 * loads when its tab opens. Rows match the sign-in dialog, installed first.
 */
const WalletPicker: FC<{ initial: Ecosystem; onClose: () => void; onConnected: (ecosystem: Ecosystem) => void }> = ({ initial, onClose, onConnected }) => {
  const [tab, setTab] = useState<Ecosystem>(initial);
  const [error, setError] = useState<unknown>();
  const { wallets, state, loading, error: loadError } = useEcosystemWallets(tab);
  const list = [...state.wallets].sort((a, b) => Number(b.installed) - Number(a.installed));

  return (
    <Modal title="Connect a wallet" onClose={onClose} width={400}>
      <div role="tablist" aria-label="Wallet type" className="mb-4 flex flex-wrap gap-x-4 gap-y-2">
        {ECOSYSTEMS.map((e) => (
          <button
            key={e}
            type="button"
            role="tab"
            aria-selected={e === tab}
            onClick={() => {
              setTab(e);
              setError(undefined);
            }}
            className={`border-b-2 pb-0.5 text-sm font-semibold transition-colors ${e === tab ? "border-text-primary text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"}`}
          >
            {ECOSYSTEM_LABEL[e]}
          </button>
        ))}
      </div>
      {loading || !wallets ? (
        loadError != null ? (
          <p className="text-sm text-danger">Couldn't load these wallets. Try again shortly.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: 3 }, (_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-1" />)}
          </div>
        )
      ) : list.length === 0 ? (
        <p className="text-sm leading-relaxed text-text-secondary">No {ECOSYSTEM_LABEL[tab]} wallet was found in this browser. Install one, then reload this page.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {list.map((wallet) => {
            const connected = state.account?.name === wallet.name;
            return (
              <button
                key={wallet.id}
                type="button"
                disabled={state.connecting !== null || !wallet.installed}
                onClick={() => {
                  setError(undefined);
                  if (connected) onConnected(tab);
                  else wallets.connect(wallet.id).then(() => onConnected(tab), setError);
                }}
                className="flex h-12 w-full items-center gap-3 rounded-lg bg-surface-1 px-3.5 text-left text-sm font-medium text-text-primary transition-colors hover:bg-surface-2 disabled:opacity-60 disabled:hover:bg-surface-1"
              >
                <WalletIcon src={wallet.icon} name={wallet.name} />
                <span className="flex-1">{wallet.name}</span>
                {state.connecting === wallet.id ? (
                  <Spinner size="sm" />
                ) : connected ? (
                  <span className="text-xs text-success">Connected</span>
                ) : (
                  !wallet.installed && <span className="text-xs text-text-muted">Not installed</span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {error != null && <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{friendlyError(error)}</p>}
      <p className="mt-4 text-xs leading-relaxed text-text-muted">This wallet only pays for the deposit. It stays separate from the wallet you sign in to Brighter with.</p>
    </Modal>
  );
};
