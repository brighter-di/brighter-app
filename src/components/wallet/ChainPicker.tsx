import type { FC } from "react";
import { useConnection } from "wagmi";
import { useConfig } from "@/hooks/queries";
import { ChainLogo } from "@/components/ui/ChainLogo";
import { Popover } from "@/components/ui/Popover";

/**
 * Chains Brighter follows the portfolio engine onto. The portfolio engine publishes no chain list ("ask
 * the portfolio engine which chains are enabled"), so these are the EVM chains its API and
 * docs work in. HyperEVM is absent: it refuses enrollment there.
 */
const COMING: { chainId: number; name: string }[] = [
  { chainId: 1, name: "Ethereum" },
  { chainId: 8453, name: "Base" },
  { chainId: 42161, name: "Arbitrum One" },
  { chainId: 137, name: "Polygon" },
];

/** The chain portfolios trade on, with the ones still to come listed under it. */
export const ChainPicker: FC = () => {
  const { chainId } = useConnection();
  const { data: config } = useConfig();

  const enabled = config?.chains ?? [];
  // The wallet's chain when Brighter trades on it, otherwise the one it does:
  // a wallet parked elsewhere is handled by the switch button beside this.
  const current = enabled.find((c) => c.chainId === chainId) ?? enabled[0];
  const soon = COMING.filter((c) => !enabled.some((e) => e.chainId === c.chainId));
  if (!current) return null;

  return (
    <Popover
      label="Chain"
      trigger={(props) => (
        <button
          {...props}
          aria-label={`Chain: ${current.name}`}
          title={current.name}
          className="grid h-9 w-9 place-items-center rounded-full transition-colors hover:bg-surface-2"
        >
          <ChainLogo chainId={current.chainId} size={20} />
        </button>
      )}
    >
      <div role="option" aria-selected className="flex items-center gap-2.5 rounded-lg bg-surface-1 px-2.5 py-2 text-base">
        <ChainLogo chainId={current.chainId} size={18} />
        <span className="flex-1 font-medium text-text-primary">{current.name}</span>
      </div>
      {soon.map((c) => (
        <div
          key={c.chainId}
          role="option"
          aria-selected={false}
          aria-disabled
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-base text-text-muted"
        >
          <span className="opacity-50">
            <ChainLogo chainId={c.chainId} size={18} />
          </span>
          <span className="flex-1">{c.name}</span>
          <span className="text-sm">Soon</span>
        </div>
      ))}
    </Popover>
  );
};
