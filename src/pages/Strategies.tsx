import { type FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStrategies, useStrategyFacets } from "@/hooks/queries";
import { useTitle } from "@/hooks/useTitle";
import { StrategyCard, StrategyCardSkeleton } from "@/components/strategy/StrategyCard";
import { FilterBar } from "@/components/strategy/FilterBar";
import { MenuChip } from "@/components/strategy/FilterChip";
import { PeriodTabs } from "@/components/strategy/PeriodTabs";
import { Popover } from "@/components/ui/Popover";
import { Spinner } from "@/components/ui/Spinner";
import { friendlyError } from "@/lib/errors";
import {
  applyFilters, clearFilters, isFiltered, parseFilters, rememberedFilters,
  rememberFilters, SORTS, urlIsBare,
  type CatalogueFilters, type Sort,
} from "@/lib/catalogueFilters";

// How the list can be ordered. Newest is the order strategies were added, most
// recent first; best return reads the same backtests the cards show, over
// whichever period is selected.
const ORDERS: Record<Sort, string> = { return: "Best return", newest: "Newest" };

export const Strategies: FC = () => {
  const [search, setSearch] = useSearchParams();
  // The URL is the only copy of what is being shown, so a filtered list is a
  // link, and Back through the filters works without any state of our own.
  const filters = useMemo(() => parseFilters(search), [search]);
  const setFilters = useCallback(
    (next: CatalogueFilters) => setSearch(applyFilters(search, next), { replace: true }),
    [search, setSearch],
  );
  useTitle("Strategies");

  // A bare /strategies opens the way this browser left it. A link that says
  // anything is honoured as it is.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    if (!urlIsBare(search)) return;
    const last = rememberedFilters();
    if (last) setSearch(applyFilters(search, last), { replace: true });
  }, [search, setSearch]);
  useEffect(() => rememberFilters(filters), [filters]);

  const list = useStrategies(filters);
  // The filter row is the only thing that needs the ticker list, and it is
  // held for a week, so it is fetched once the list itself has drawn.
  const [wantFacets, setWantFacets] = useState(false);
  useEffect(() => {
    const ask = () => setWantFacets(true);
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(ask, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(ask, 800);
    return () => clearTimeout(id);
  }, []);
  const facets = useStrategyFacets(wantFacets);

  const strategies = useMemo(() => list.data?.pages.flatMap((page) => page.strategies) ?? [], [list.data]);
  const total = list.data?.pages[0]?.total ?? 0;
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = list;

  // The next page starts loading before the reader reaches the end of this one.
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // A filter that cuts forty rows to three would otherwise leave the reader
  // staring at empty space, since a query-only change never scrolls.
  const grid = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (window.scrollY > 0) grid.current?.scrollIntoView({ block: "start" });
  }, [filters]);

  const loading = list.isPending;
  const refreshing = list.isFetching && !isFetchingNextPage;

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-3xl font-bold text-text-primary sm:text-4xl">Strategies</h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-text-secondary">
          Each strategy is one plain rule over tokenized US stocks and T-bills. Open one to tune its settings, see how
          it would have performed, and invest.
        </p>
      </section>

      <section className="border-b border-surface-border pb-2">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <FilterBar filters={filters} onChange={setFilters} facets={facets.data} />
          <div className="flex items-center gap-4">
            {refreshing && <Spinner size="xs" />}
            <PeriodTabs value={filters.period} onChange={(period) => setFilters({ ...filters, period })} />
            <Popover
              label="Order"
              width="w-44"
              trigger={(props) => <MenuChip label={ORDERS[filters.sort]} count={0} props={props} />}
            >
              {SORTS.map((sort) => (
                <button
                  key={sort}
                  type="button"
                  role="option"
                  aria-selected={sort === filters.sort}
                  onClick={() => setFilters({ ...filters, sort })}
                  className={`flex w-full items-center rounded-lg px-2.5 py-2 text-left text-base ${
                    sort === filters.sort ? "bg-surface-1 font-medium text-text-primary" : "text-text-secondary hover:bg-surface-1 hover:text-text-primary"
                  }`}
                >
                  {ORDERS[sort]}
                </button>
              ))}
            </Popover>
          </div>
        </div>

      </section>

      {list.error ? (
        <p className="text-sm text-danger">Couldn't load strategies: {friendlyError(list.error)}</p>
      ) : (
        <>
          <div ref={grid} className="grid gap-x-12 md:grid-cols-2">
            {loading
              ? Array.from({ length: 6 }, (_, i) => <StrategyCardSkeleton key={i} />)
              : strategies.map((strategy) => (
                  <StrategyCard key={strategy.id} strategy={strategy} period={filters.period} loading={false} />
                ))}
            {/* Skeletons are the only thing but a card that may sit in this
                grid: the hairline rule keys off nth-child. */}
            {isFetchingNextPage && Array.from({ length: 2 }, (_, i) => <StrategyCardSkeleton key={`next-${i}`} />)}
          </div>

          {!loading && total === 0 && <EmptyState filters={filters} onChange={setFilters} />}

          <div ref={sentinel} aria-hidden className="h-px" />
          {hasNextPage && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
                className="h-10 text-sm text-text-secondary transition-colors hover:text-text-primary disabled:opacity-60"
              >
                {isFetchingNextPage ? "Loading…" : `Show more (${total - strategies.length} left)`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const EmptyState: FC<{ filters: CatalogueFilters; onChange: (next: CatalogueFilters) => void }> = ({ filters, onChange }) => (
  <div className="border-t border-surface-border py-16 text-center">
    <p className="text-base text-text-primary">No strategy matches these filters.</p>
    <div className="mt-3 flex flex-col items-center gap-2 text-sm">
      {isFiltered(filters) && (
        <button type="button" onClick={() => onChange(clearFilters(filters))} className="text-text-muted hover:text-text-primary">
          Clear all filters
        </button>
      )}
    </div>
  </div>
);
