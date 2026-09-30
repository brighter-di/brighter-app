import { type FC, useMemo, useState } from "react";
import type { ExtendedChain } from "@lifi/sdk";
import { AssetLogo } from "@/components/ui/AssetLogo";
import { ECOSYSTEM_LABEL, filterChains } from "@/lib/deposit";
import { Check, SearchField } from "./SearchField";

/** Every chain a deposit can start from, searchable. */
export const ChainList: FC<{ chains: ExtendedChain[] | undefined; loading: boolean; error: boolean; selected: number | undefined; onSelect: (chain: ExtendedChain) => void }> = ({ chains, loading, error, selected, onSelect }) => {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => filterChains(chains ?? [], query), [chains, query]);

  return (
    <section aria-labelledby="deposit-chains" className="min-w-0">
      <h3 id="deposit-chains" className="text-sm font-semibold text-text-primary">From chain</h3>
      <SearchField value={query} onChange={setQuery} placeholder="Search chains" label="Search chains" />
      <div role="listbox" aria-label="Chains" className="mt-2 max-h-[22rem] overflow-y-auto lg:max-h-[30rem]">
        {loading ? (
          Array.from({ length: 8 }, (_, i) => <div key={i} className="my-3 h-6 animate-pulse bg-surface-1" />)
        ) : error ? (
          <p className="py-3 text-sm text-danger">Couldn't load chains. Try again shortly.</p>
        ) : shown.length === 0 ? (
          <p className="py-3 text-sm text-text-muted">No chain matches “{query}”.</p>
        ) : (
          shown.map((chain) => {
            const active = chain.id === selected;
            return (
              <button
                key={chain.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onSelect(chain)}
                className="group flex w-full items-center gap-2.5 py-2 text-left"
              >
                <AssetLogo src={chain.logoURI} symbol={chain.name} size={24} />
                <span className={`min-w-0 flex-1 truncate text-sm font-medium transition-colors group-hover:text-accent ${active ? "text-accent" : "text-text-primary"}`}>{chain.name}</span>
                {chain.chainType !== "EVM" && <span className="text-xs text-text-muted">{ECOSYSTEM_LABEL[chain.chainType] ?? chain.chainType}</span>}
                {active && <Check />}
              </button>
            );
          })
        )}
      </div>
    </section>
  );
};
