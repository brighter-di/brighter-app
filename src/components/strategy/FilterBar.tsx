import { type FC, useState } from "react";
import type { CatalogueFacets } from "@/api/client";
import { Modal } from "@/components/ui/Modal";
import { Popover } from "@/components/ui/Popover";
import { AssetPicker } from "./AssetPicker";
import { MenuChip, ToggleChip } from "./FilterChip";
import { cadenceLabel } from "@/lib/format";
import {
  activeFilterCount, CADENCES, clearFilters, isFiltered, toggle,
  type Cadence, type CatalogueFilters,
} from "@/lib/catalogueFilters";

interface Props {
  filters: CatalogueFilters;
  onChange: (next: CatalogueFilters) => void;
  facets: CatalogueFacets | undefined;
}

/**
 * The chips row, and the same controls in a sheet on a phone. Five chips do
 * not fit at phone width, so the row is hidden below md: and a single button
 * opens them instead — CSS, not a measured breakpoint, like the rest of the app.
 */
export const FilterBar: FC<Props> = ({ filters, onChange, facets }) => {
  const [sheet, setSheet] = useState(false);
  const count = activeFilterCount(filters);
  const assets = facets?.assets ?? [];
  const cadences = facets?.cadences.map((c) => c.value as Cadence) ?? CADENCES;

  const set = (patch: Partial<CatalogueFilters>) => onChange({ ...filters, ...patch });

  const beatsChip = (
    <ToggleChip
      active={filters.beatsBenchmark}
      onClick={() => set({ beatsBenchmark: !filters.beatsBenchmark })}
      title="Only strategies whose backtest is ahead of their benchmark over this period"
    >
      Beats benchmark
    </ToggleChip>
  );
  return (
    <>
      <div className="hidden flex-wrap items-center gap-5 md:flex">
        <Popover
          label="Assets"
          align="left"
          width="w-80"
          multi
          trigger={(props) => <MenuChip label="Assets" count={filters.assets.length} props={props} />}
        >
          <AssetPicker
            assets={assets}
            selected={filters.assets}
            onChange={(next) => set({ assets: next })}
            includeLeveraged={filters.leveraged}
          />
        </Popover>

        <Popover
          label="Rebalance"
          align="left"
          width="w-52"
          multi
          trigger={(props) => <MenuChip label="Rebalance" count={filters.cadence.length} props={props} />}
        >
          {cadences.map((cadence) => {
            const on = filters.cadence.includes(cadence);
            return (
              <button
                key={cadence}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => set({ cadence: toggle(filters.cadence, cadence) })}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-base hover:bg-surface-1"
              >
                <span className={`flex-1 ${on ? "font-medium text-accent" : "text-text-primary"}`}>{cadenceLabel(cadence)}</span>
                {on && <Tick />}
              </button>
            );
          })}
        </Popover>

        {beatsChip}

        {isFiltered(filters) && (
          <button
            type="button"
            onClick={() => onChange(clearFilters(filters))}
            className="h-9 text-sm text-text-muted transition-colors hover:text-text-primary"
          >
            Clear
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => setSheet(true)}
        aria-label={count > 0 ? `Filters, ${count} active` : "Filters"}
        className="flex h-9 items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary md:hidden"
      >
        Filters
        {count > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-xs font-medium tabular-nums text-surface-0">{count}</span>}
      </button>

      {sheet && (
        <Modal title="Filters" onClose={() => setSheet(false)} sheet>
          <div className="space-y-5 pb-2">
            <section>
              <h3 className="mb-1 text-sm font-medium text-text-primary">Assets</h3>
              <p className="mb-1 text-xs text-text-muted">Strategies that can hold any of these.</p>
              <AssetPicker
                assets={assets}
                selected={filters.assets}
                onChange={(next) => set({ assets: next })}
                includeLeveraged={filters.leveraged}
              />
            </section>

            <section>
              <h3 className="mb-2 text-sm font-medium text-text-primary">Rebalance</h3>
              <div className="flex flex-wrap gap-5">
                {cadences.map((cadence) => (
                  <ToggleChip
                    key={cadence}
                    active={filters.cadence.includes(cadence)}
                    onClick={() => set({ cadence: toggle(filters.cadence, cadence) })}
                  >
                    {cadenceLabel(cadence)}
                  </ToggleChip>
                ))}
              </div>
            </section>

            <section className="flex flex-wrap gap-5">{beatsChip}</section>

            <div className="flex gap-2 border-t border-surface-border pt-4">
              {isFiltered(filters) && (
                <button
                  type="button"
                  onClick={() => onChange(clearFilters(filters))}
                  className="h-11 flex-1 text-base text-text-secondary"
                >
                  Clear
                </button>
              )}
              <button
                type="button"
                onClick={() => setSheet(false)}
                className="h-11 flex-1 rounded-lg bg-text-primary text-base font-medium text-surface-0"
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
};

const Tick: FC = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden className="shrink-0 text-accent">
    <path d="M2.5 7.5l3 3 6-6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
