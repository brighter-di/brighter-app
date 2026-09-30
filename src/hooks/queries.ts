// Every read the app makes, as React Query hooks. Keys are centralised here
// so mutations invalidate exactly what they change, and so pages that fetch
// the same backtest (landing, list, detail) share one cache entry.

import { infiniteQueryOptions, keepPreviousData, queryOptions, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  api,
  isTerminal,
  type AppConfig,
  type Backtest,
  type Operation,
  type Params,
  type Performance,
  type Portfolio,
  type PortfolioDetail,
  type Positions,
  type Range,
  type CatalogueFacets,
  type CataloguePage,
  type StrategySummary,
  type Template,
} from "@/api/client";
import { readUiCache, writeUiCache, type Cached, type CacheValidator } from "@/lib/uiCache";
import type { CatalogueFilters } from "@/lib/catalogueFilters";
import { backtestSince, downsample, mergeBacktest, mergePerformance, performanceSince } from "@/lib/seriesMerge";

export const keys = {
  config: ["config"] as const,
  strategies: (f: CatalogueFilters) =>
    ["strategies", f.period, f.sort, f.assets.join(","), f.cadence.join(","), f.beatsBenchmark, f.leveraged] as const,
  facets: ["facets"] as const,
  templates: ["templates"] as const,
  backtest: (id: string, key: string, range: Range, points?: number) => ["backtest", id, key, range, points ?? 0] as const,
  summaries: (range: Range, points: number, targets: boolean) => ["summaries", range, points, targets] as const,
  target: (id: string, key: string) => ["target", id, key] as const,
  portfolios: (owner: string, archived = false) => ["portfolios", owner.toLowerCase(), archived] as const,
  portfolio: (id: string) => ["portfolio", id] as const,
  positions: (id: string) => ["positions", id] as const,
  performance: (id: string) => ["performance", id] as const,
  operation: (id: string, opId: string) => ["operation", id, opId] as const,
};

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object";
const hasString = (value: Record<string, unknown>, key: string) => typeof value[key] === "string";
const hasNumber = (value: Record<string, unknown>, key: string) => typeof value[key] === "number" && Number.isFinite(value[key]);
const hasNumberParams = (value: unknown) => isRecord(value) && Object.values(value).every((item) => typeof item === "number" && Number.isFinite(item));
const isAllocation = (value: unknown) =>
  Array.isArray(value) && value.every((line) => isRecord(line) && hasString(line, "ticker") && hasNumber(line, "bps"));

const isPortfolio = (value: unknown): value is Portfolio =>
  isRecord(value) &&
  hasString(value, "portfolioId") &&
  hasString(value, "owner") &&
  typeof value.chainId === "number" &&
  hasString(value, "depositAddress") &&
  hasString(value, "templateId") &&
  hasString(value, "templateName") &&
  hasString(value, "paramsLabel") &&
  hasNumberParams(value.params) &&
  isAllocation(value.allocation);

const isPortfolios: CacheValidator<Portfolio[]> = (value): value is Portfolio[] => Array.isArray(value) && value.every(isPortfolio);
const isPortfolioDetail: CacheValidator<PortfolioDetail> = (value): value is PortfolioDetail => {
  if (!isPortfolio(value)) return false;
  const schedule = (value as Portfolio & { schedule?: unknown }).schedule;
  return schedule === null || (isRecord(schedule) && hasString(schedule, "status"));
};
const isPositions: CacheValidator<Positions> = (value): value is Positions =>
  isRecord(value) &&
  hasString(value, "portfolioId") &&
  hasString(value, "totalValueUsd") &&
  hasString(value, "fetchedAt") &&
  Array.isArray(value.assets) &&
  value.assets.every((asset) => isRecord(asset) && hasString(asset, "assetId") && hasString(asset, "symbol") && hasString(asset, "balance") && hasString(asset, "valueUsd")) &&
  Array.isArray(value.warnings) &&
  value.warnings.every((warning) => isRecord(warning) && hasString(warning, "message"));
const isPerformance: CacheValidator<Performance> = (value): value is Performance =>
  isRecord(value) &&
  hasString(value, "method") &&
  hasString(value, "asOf") &&
  Array.isArray(value.points) &&
  value.points.every(
    (point) =>
      isRecord(point) &&
      hasString(point, "date") &&
      hasNumber(point, "value") &&
      hasNumber(point, "deposited") &&
      hasNumber(point, "profit") &&
      (point.return === null || hasNumber(point, "return")),
  );

const isChain = (value: unknown) =>
  isRecord(value) &&
  hasNumber(value, "chainId") &&
  hasString(value, "key") &&
  hasString(value, "name") &&
  hasString(value, "short") &&
  hasString(value, "explorer") &&
  isRecord(value.cash) &&
  hasString(value.cash, "symbol") &&
  hasString(value.cash, "address") &&
  hasNumber(value.cash, "decimals");
const isAppConfig: CacheValidator<AppConfig> = (value): value is AppConfig =>
  isRecord(value) &&
  Array.isArray(value.chains) &&
  value.chains.length > 0 &&
  value.chains.every(isChain) &&
  typeof value.research === "boolean" &&
  typeof value.trading === "boolean" &&
  isRecord(value.schedule) &&
  hasString(value.schedule, "type") &&
  hasNumber(value, "maxCutoffAgeTradingDays");

const isCardAsset = (value: unknown) => isRecord(value) && hasString(value, "ticker") && hasString(value, "icon");
const isStrategyCard = (value: unknown) =>
  isRecord(value) &&
  hasString(value, "id") &&
  hasString(value, "name") &&
  hasString(value, "cadence") &&
  Array.isArray(value.assets) &&
  value.assets.every(isCardAsset) &&
  typeof value.leveraged === "boolean" &&
  (value.backtest === null ||
    (isRecord(value.backtest) && hasNumber(value.backtest, "totalReturn") && isRecord(value.backtest.series)));
const isCataloguePage: CacheValidator<CataloguePage> = (value): value is CataloguePage =>
  isRecord(value) &&
  hasNumber(value, "total") &&
  hasNumber(value, "offset") &&
  hasNumber(value, "limit") &&
  Array.isArray(value.strategies) &&
  value.strategies.every(isStrategyCard);
const isFacets: CacheValidator<CatalogueFacets> = (value): value is CatalogueFacets =>
  isRecord(value) &&
  hasNumber(value, "total") &&
  Array.isArray(value.assets) &&
  value.assets.every((a) => isRecord(a) && hasString(a, "ticker") && hasString(a, "kind") && hasNumber(a, "count")) &&
  Array.isArray(value.cadences);

const isTemplates: CacheValidator<Template[]> = (value): value is Template[] =>
  Array.isArray(value) &&
  value.every((t) => isRecord(t) && hasString(t, "id") && hasString(t, "name") && Array.isArray(t.params) && Array.isArray(t.assets) && isRecord(t.defaults));
const isSummaries: CacheValidator<StrategySummary[]> = (value): value is StrategySummary[] =>
  Array.isArray(value) &&
  value.every(
    (s) =>
      isRecord(s) &&
      hasString(s, "id") &&
      (s.backtest === null || isBacktest(s.backtest)) &&
      (s.target == null || (isRecord(s.target) && isAllocation(s.target.lines))),
  );

/**
 * A snapshot kept in this browser shows at once while the backend is asked
 * for the current value. By default every mount asks; a list many views share
 * passes `true` to ask only once the snapshot is stale.
 */
function persistentOptions<T>(
  queryKey: readonly unknown[],
  request: () => Promise<T>,
  validate: CacheValidator<T>,
  maxAgeMs?: number,
  refetchOnMount: true | "always" = "always",
) {
  // Read once, and only if asked: React Query calls these while the query has
  // no data, so a mounted list never re-parses its snapshot on every render.
  let snapshot: Cached<T> | undefined;
  let read = false;
  const cached = () => {
    if (!read) {
      snapshot = readUiCache(queryKey, validate, { maxAgeMs });
      read = true;
    }
    return snapshot;
  };
  return {
    queryFn: async () => {
      const data = await request();
      writeUiCache(queryKey, data);
      return data;
    },
    initialData: () => cached()?.data,
    initialDataUpdatedAt: () => cached()?.savedAt,
    refetchOnMount,
  };
}

const stableKey = (p: Params) =>
  Object.keys(p)
    .sort()
    .map((k) => `${k}=${p[k]}`)
    .join(",");

/* ── Series kept in this browser and extended with new days only ─────── */

// A held series is checked against the backend's overlap before new days are
// appended, so it can outlive a display snapshot.
const SERIES_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
/** The universe a strategy can hold changes rarely; a week-old list is fine. */
const FACETS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const isBacktest: CacheValidator<Backtest> = (value): value is Backtest => {
  if (!isRecord(value) || !hasString(value, "startDate") || !isRecord(value.metrics) || !isRecord(value.series)) return false;
  const { dates, strategy, benchmark } = value.series;
  return (
    Array.isArray(dates) && Array.isArray(strategy) && Array.isArray(benchmark) &&
    dates.length === strategy.length && dates.length === benchmark.length &&
    dates.every((d) => typeof d === "string") && strategy.every((v) => typeof v === "number")
  );
};

// One daily series per strategy, parameters and range, whatever `points` a
// view downsamples it to. Parsed once per page load.
const dailyBacktestKey = (id: string, paramsKey: string, range: Range) => ["backtest-daily", id, paramsKey, range] as const;
const heldBacktests = new Map<string, Cached<Backtest> | undefined>();

function heldBacktest(template: Template, params: Params, range: Range): Cached<Backtest> | undefined {
  const key = dailyBacktestKey(template.id, stableKey(params), range);
  const memo = JSON.stringify(key);
  if (!heldBacktests.has(memo)) heldBacktests.set(memo, readUiCache(key, isBacktest, { maxAgeMs: SERIES_MAX_AGE_MS }));
  return heldBacktests.get(memo);
}

/**
 * A backtest from the held daily series plus only the days after it. With
 * nothing held, a small preview (`points`) is fetched downsampled as before
 * and not kept; a full view fetches and keeps the daily series.
 */
async function loadBacktest(template: Template, params: Params, range: Range, points?: number): Promise<Backtest> {
  const held = heldBacktest(template, params, range)?.data;
  if (!held && points) return api.backtest(template.id, params, range, points);
  let daily = held ? mergeBacktest(held, await api.backtest(template.id, params, range, undefined, backtestSince(held))) : null;
  daily ??= await api.backtest(template.id, params, range);
  const key = dailyBacktestKey(template.id, stableKey(params), range);
  const savedAt = Date.now();
  writeUiCache(key, daily, { now: savedAt });
  heldBacktests.set(JSON.stringify(key), { data: daily, savedAt });
  return points ? downsample(daily, points) : daily;
}

function heldView(template: Template | undefined, params: Params | undefined, range: Range, points?: number) {
  const held = template && params ? heldBacktest(template, params, range) : undefined;
  return held && { data: points ? downsample(held.data, points) : held.data, savedAt: held.savedAt };
}

async function loadPerformance(id: string): Promise<Performance> {
  const held = readUiCache(keys.performance(id), isPerformance, { maxAgeMs: SERIES_MAX_AGE_MS })?.data;
  const since = held ? performanceSince(held) : null;
  const merged = held && since ? mergePerformance(held, await api.performance(id, since), since) : null;
  return merged ?? api.performance(id);
}

/** Chains, cash legs and the rebalance schedule: small, near-static, and needed
 *  by the header on every page, so the stored copy draws while a new one loads. */
export function useConfig() {
  return useQuery({
    queryKey: keys.config,
    ...persistentOptions(keys.config, api.config, isAppConfig, undefined, true),
    staleTime: 5 * 60_000,
  });
}

/** The strategy catalogue: shown from this browser at once, and checked for new publications every few minutes. */
export function templatesOptions() {
  return queryOptions({
    queryKey: keys.templates,
    ...persistentOptions(keys.templates, api.templates, isTemplates, undefined, true),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useTemplates() {
  return useQuery(templatesOptions());
}

/** Every listed strategy's card in one request, kept in this browser so lists draw before it answers. */
export function summariesOptions(range: Range, points: number, targets: boolean) {
  const queryKey = keys.summaries(range, points, targets);
  return queryOptions({
    queryKey,
    ...persistentOptions(queryKey, () => api.summaries(range, points, targets), isSummaries, SERIES_MAX_AGE_MS, true),
    staleTime: 5 * 60_000,
  });
}

export function useSummaries(range: Range, points: number, targets: boolean) {
  return useQuery({
    ...summariesOptions(range, points, targets),
    select: (list: StrategySummary[]) => new Map(list.map((s) => [s.id, s])),
  });
}

/* ── The strategy list ──────────────────────────────────────────────── */

/** Cards per request. A page is what a reader can scroll past in one go. */
export const STRATEGY_PAGE = 12;

/**
 * The list, a page at a time. The backend applies the filters and the order,
 * so a chip is one request rather than a re-sort of everything the browser
 * happens to hold.
 *
 * `keepPreviousData` is what makes a chip feel instant: the pages already on
 * screen stay while the new ones load, rather than the list blanking.
 */
export function strategiesOptions(filters: CatalogueFilters) {
  const queryKey = keys.strategies(filters);
  // The first page this browser last saw for these filters. Read once and
  // only if asked: React Query wants it just while the query has no data.
  let snapshot: Cached<CataloguePage> | undefined;
  let read = false;
  const cached = () => {
    if (!read) {
      snapshot = readUiCache(queryKey, isCataloguePage, { maxAgeMs: SERIES_MAX_AGE_MS });
      read = true;
    }
    return snapshot;
  };
  return infiniteQueryOptions({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const page = await api.strategies(filters, { limit: STRATEGY_PAGE, offset: pageParam });
      // Only the first page is kept: it is the one that has to draw at once.
      if (pageParam === 0) writeUiCache(queryKey, page);
      return page;
    },
    initialPageParam: 0,
    getNextPageParam: (last: CataloguePage, pages: CataloguePage[]) => {
      const loaded = pages.reduce((n, page) => n + page.strategies.length, 0);
      return loaded < last.total ? loaded : undefined;
    },
    // Cards, figures and sparklines draw from the snapshot on the first frame;
    // the fresh list replaces them when it lands, a moment later.
    initialData: () => {
      const held = cached();
      return held && { pages: [held.data], pageParams: [0] };
    },
    initialDataUpdatedAt: () => cached()?.savedAt,
    // A snapshot that is still fresh is not re-fetched on every mount.
    refetchOnMount: true,
    staleTime: 5 * 60_000,
    // Survive a detour to a strategy's own page, so Back restores the scroll.
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useStrategies(filters: CatalogueFilters) {
  return useInfiniteQuery(strategiesOptions(filters));
}

/**
 * The tickers and cadences the filter row offers. Nothing on the page needs
 * them until a filter is opened, and the set barely moves, so this is held for
 * a week in this browser and only asked for once the list itself is drawn.
 */
export function useStrategyFacets(enabled: boolean) {
  return useQuery({
    queryKey: keys.facets,
    ...persistentOptions(keys.facets, api.strategyFacets, isFacets, FACETS_MAX_AGE_MS, true),
    enabled,
    staleTime: 60 * 60_000,
  });
}

export function useTemplate(id: string | undefined): { template: Template | undefined; isLoading: boolean; error: unknown } {
  const q = useTemplates();
  return { template: q.data?.find((t) => t.id === id), isLoading: q.isLoading, error: q.error };
}

export function useBacktest(template: Template | undefined, params: Params | undefined, range: Range, points?: number) {
  return useQuery({
    queryKey: keys.backtest(template?.id ?? "", params ? stableKey(params) : "", range, points),
    queryFn: () => loadBacktest(template!, params!, range, points),
    initialData: () => heldView(template, params, range, points)?.data,
    initialDataUpdatedAt: () => heldView(template, params, range, points)?.savedAt,
    enabled: !!template && !!params,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useTarget(template: Template | undefined, params: Params | undefined) {
  return useQuery({
    queryKey: keys.target(template?.id ?? "", params ? stableKey(params) : ""),
    queryFn: () => api.target(template!.id, params!),
    enabled: !!template && !!params,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

/**
 * A wallet's portfolios. Archived ones are a separate list: they hold nothing
 * and run nothing — archiving requires the portfolio to be empty — so mixing
 * them with the live ones would only make the total harder to read.
 */
export function usePortfolios(owner: string | undefined, archived = false) {
  const queryKey = keys.portfolios(owner ?? "", archived);
  return useQuery({
    queryKey,
    ...(owner ? persistentOptions(queryKey, () => api.portfolios(owner, archived), isPortfolios) : {}),
    enabled: !!owner,
    // Nothing moves in an archived portfolio, so it need not be rechecked.
    staleTime: archived ? 5 * 60_000 : 15_000,
  });
}

export function usePortfolioDetail(id: string | undefined) {
  const queryKey = keys.portfolio(id ?? "");
  return useQuery({
    queryKey,
    ...(id ? persistentOptions(queryKey, () => api.portfolio(id), isPortfolioDetail) : {}),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/** A portfolio's daily value curve and profit: held in this browser, refreshed with new days only. */
export function usePerformance(id: string | undefined) {
  const queryKey = keys.performance(id ?? "");
  return useQuery({
    queryKey,
    ...(id ? persistentOptions(queryKey, () => loadPerformance(id), isPerformance, SERIES_MAX_AGE_MS) : {}),
    enabled: !!id,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

/** A portfolio's allocation changes, each against the one before. */
export function useActivity(id: string | undefined) {
  return useQuery({
    queryKey: ["activity", id ?? ""],
    queryFn: () => api.activity(id!),
    enabled: !!id,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });
}

/** A portfolio's holdings, refreshed every minute. Shared by the list and the detail page. */
export function positionsOptions(id: string) {
  const queryKey = keys.positions(id);
  return queryOptions({
    queryKey,
    ...persistentOptions(queryKey, () => api.positions(id), isPositions),
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

export function useAsset(ticker: string | undefined) {
  return useQuery({ queryKey: ["asset", ticker ?? ""], queryFn: () => api.asset(ticker!), enabled: !!ticker, staleTime: 60_000 });
}

/** Polls an operation every 3s until it reaches a terminal state. */
export function useOperation(portfolioId: string | undefined, operationId: string | undefined) {
  return useQuery<Operation>({
    queryKey: keys.operation(portfolioId ?? "", operationId ?? ""),
    queryFn: () => api.operation(portfolioId!, operationId!),
    enabled: !!portfolioId && !!operationId,
    refetchInterval: (q) => (q.state.data && isTerminal(q.state.data.state) ? false : 3_000),
    refetchIntervalInBackground: true,
    staleTime: 1_000,
  });
}
