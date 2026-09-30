import { type FC, useMemo, useState } from "react";
import type { FacetAsset } from "@/api/client";
import { AssetLogo } from "@/components/ui/AssetLogo";
import { SearchField } from "@/components/deposit/SearchField";
import { tokenSymbol } from "@/lib/format";
import { toggle } from "@/lib/catalogueFilters";

/**
 * Which tickers a strategy has to be able to hold. Grouped by the kind the
 * registry already carries, so the list reads as stocks, then funds, then the
 * geared ones — and searchable, because the catalogue's universe grows with
 * every strategy published.
 *
 * Selection is shown in the text colour and a check, never a filled row: the
 * rule the chain and token lists already follow.
 */
export const AssetPicker: FC<{
  assets: FacetAsset[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Geared funds are only worth listing once the reader has asked for them. */
  includeLeveraged: boolean;
}> = ({ assets, selected, onChange, includeLeveraged }) => {
  const [query, setQuery] = useState("");

  // What is already chosen sits at the top, so it can be seen and undone
  // without hunting back through the kinds for it. Search still searches
  // everything; the chosen ones simply keep their place above the rest.
  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (asset: FacetAsset) => !needle || `${asset.ticker} ${asset.name}`.toLowerCase().includes(needle);
    const chosen = assets.filter((asset) => selected.includes(asset.ticker) && matches(asset));
    const out: { kind: string; assets: FacetAsset[] }[] = chosen.length ? [{ kind: "Selected", assets: chosen }] : [];
    for (const asset of assets) {
      if (selected.includes(asset.ticker)) continue;
      if (asset.leveraged && !includeLeveraged) continue;
      if (!matches(asset)) continue;
      const group = out.at(-1);
      if (group?.kind === asset.kind) group.assets.push(asset);
      else out.push({ kind: asset.kind, assets: [asset] });
    }
    return out;
  }, [assets, query, includeLeveraged, selected]);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="px-1 pb-1">
        <SearchField value={query} onChange={setQuery} label="Search assets" placeholder="Search a ticker or name" />
      </div>
      <div className="max-h-[19rem] overflow-y-auto">
        {groups.map((group) => (
          <div key={group.kind}>
            <div className="sticky top-0 bg-surface-0 px-2.5 pb-1 pt-2.5 text-xs font-medium text-text-muted">{group.kind}</div>
            {group.assets.map((asset) => {
              const on = selected.includes(asset.ticker);
              return (
                <button
                  key={asset.ticker}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => onChange(toggle(selected, asset.ticker))}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-base hover:bg-surface-1"
                >
                  <AssetLogo src={asset.icon} symbol={tokenSymbol(asset.ondoSymbol || asset.ticker)} size={18} />
                  <span className={`font-medium ${on ? "text-accent" : "text-text-primary"}`}>{asset.ticker}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-text-muted">{asset.name}</span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-text-muted">{asset.count}</span>
                  {on && (
                    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="shrink-0 text-accent">
                      <path d="M2.5 7.5l3 3 6-6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        ))}
        {groups.length === 0 && <p className="px-2.5 py-6 text-center text-sm text-text-muted">No asset matches “{query}”.</p>}
      </div>
    </div>
  );
};
