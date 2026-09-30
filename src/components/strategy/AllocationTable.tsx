import type { FC } from "react";
import { Link } from "react-router-dom";
import type { TargetLine } from "@/api/client";
import { AssetLogo } from "@/components/ui/AssetLogo";
import { bps, tokenSymbol } from "@/lib/format";

/** Weights per asset with a bar, largest first. Each row opens the asset. */
export const AllocationTable: FC<{ lines: TargetLine[]; compact?: boolean }> = ({ lines, compact }) => (
  <div>
    {lines.map((l) => (
      <Link key={l.ticker} to={`/assets/${l.ticker}`} className={`group flex items-center gap-3 ${compact ? "py-2" : "py-2.5"}`}>
        <AssetLogo src={l.icon} symbol={tokenSymbol(l.ondoSymbol || l.ticker)} size={compact ? 24 : 30} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-text-primary transition-colors group-hover:text-accent">{tokenSymbol(l.ondoSymbol || l.ticker)}</span>
            {!compact && <span className="truncate text-xs text-text-muted">{l.name}</span>}
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-text-primary/80" style={{ width: `${l.bps / 100}%` }} />
          </div>
        </div>
        <span className="w-16 text-right font-mono text-sm tabular-nums text-text-primary">{bps(l.bps, 2)}</span>
      </Link>
    ))}
  </div>
);
