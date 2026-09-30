// What the strategy list is being asked to show. The URL is the only copy —
// the page derives this from the query string and writes it back, so a
// filtered list is a link somebody can send.
//
// Two rules make the rest work. A value equal to its default is left out of
// the URL, so `/strategies` stays clean. And every list is canonical — sorted
// and deduped — so the same filters always produce the same query string and
// the same cache key, whatever order they were clicked in.

export type Period = "1y" | "3y" | "5y";
export type Sort = "return" | "newest";
export type Cadence = "daily" | "weekly" | "monthly";

export const PERIODS: readonly Period[] = ["1y", "3y", "5y"];
export const SORTS: readonly Sort[] = ["return", "newest"];
export const CADENCES: readonly Cadence[] = ["daily", "weekly", "monthly"];

export interface CatalogueFilters {
  period: Period;
  sort: Sort;
  assets: string[];
  cadence: Cadence[];
  beatsBenchmark: boolean;
  /** Leveraged and inverse strategies are hidden until this is on. */
  leveraged: boolean;
}

export const DEFAULT_FILTERS: CatalogueFilters = {
  period: "1y",
  sort: "return",
  assets: [],
  cadence: [],
  beatsBenchmark: false,
  leveraged: false,
};

const canonical = <T extends string>(values: T[], allowed?: readonly T[]): T[] => {
  const kept = allowed ? values.filter((v) => allowed.includes(v)) : values;
  return [...new Set(kept)].sort();
};

const list = (raw: string | null): string[] =>
  (raw ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

/** Read filters from a URL, keeping only values the API will accept. */
export function parseFilters(search: URLSearchParams): CatalogueFilters {
  const one = <T extends string>(key: string, allowed: readonly T[], fallback: T): T => {
    const value = search.get(key) as T | null;
    return value && allowed.includes(value) ? value : fallback;
  };
  return {
    period: one("period", PERIODS, DEFAULT_FILTERS.period),
    sort: one("sort", SORTS, DEFAULT_FILTERS.sort),
    assets: canonical(list(search.get("assets")).map((t) => t.toUpperCase())),
    cadence: canonical(list(search.get("cadence")).map((c) => c.toLowerCase()) as Cadence[], CADENCES),
    beatsBenchmark: search.get("beats") === "1",
    leveraged: search.get("leveraged") === "1",
  };
}

/**
 * Write filters onto a copy of the current query, so keys this page does not
 * own survive. A value at its default is deleted rather than written.
 */
export function applyFilters(search: URLSearchParams, filters: CatalogueFilters): URLSearchParams {
  const next = new URLSearchParams(search);
  const set = (key: string, value: string, isDefault: boolean) => {
    if (isDefault) next.delete(key);
    else next.set(key, value);
  };
  set("period", filters.period, filters.period === DEFAULT_FILTERS.period);
  set("sort", filters.sort, filters.sort === DEFAULT_FILTERS.sort);
  set("assets", canonical(filters.assets).join(","), filters.assets.length === 0);
  set("cadence", canonical(filters.cadence, CADENCES).join(","), filters.cadence.length === 0);
  set("beats", "1", !filters.beatsBenchmark);
  set("leveraged", "1", !filters.leveraged);
  return next;
}

/** How many filters are narrowing the list — the count on the mobile button. */
export function activeFilterCount(filters: CatalogueFilters): number {
  return (
    filters.assets.length +
    filters.cadence.length +
    (filters.beatsBenchmark ? 1 : 0) +
    (filters.leveraged ? 1 : 0)
  );
}

/** Whether anything is narrowing the list. Period and sort are not filters. */
export const isFiltered = (filters: CatalogueFilters): boolean => activeFilterCount(filters) > 0;

/** Clear the filters, keeping the period and order the reader chose. */
export const clearFilters = (filters: CatalogueFilters): CatalogueFilters => ({
  ...DEFAULT_FILTERS,
  period: filters.period,
  sort: filters.sort,
});

/** Toggle one value of a multi-select filter. */
export function toggle<T extends string>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

/* ── What this browser last looked at ───────────────────────────────── */

// Opening /strategies with no query should show the list the way it was left,
// so the chips do not have to be set again on every visit. The URL still wins
// whenever it says anything, so a shared link is never overridden.

const REMEMBERED = "brighter:strategies:filters";

/** True when the URL says nothing about how to show the list. */
export const urlIsBare = (search: URLSearchParams): boolean =>
  !["period", "sort", "assets", "cadence", "beats", "leveraged"].some((key) => search.has(key));

export function rememberFilters(filters: CatalogueFilters): void {
  try {
    localStorage.setItem(REMEMBERED, applyFilters(new URLSearchParams(), filters).toString());
  } catch {
    /* private mode / disabled storage */
  }
}

/** The filters last used here, or undefined when there are none worth restoring. */
export function rememberedFilters(): CatalogueFilters | undefined {
  try {
    const raw = localStorage.getItem(REMEMBERED);
    if (!raw) return undefined;
    const filters = parseFilters(new URLSearchParams(raw));
    // Nothing to restore is the same as no memory at all.
    return urlIsBare(new URLSearchParams(applyFilters(new URLSearchParams(), filters))) ? undefined : filters;
  } catch {
    return undefined;
  }
}
