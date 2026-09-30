// Client for the Go backend (../backend). Every backtest and portfolio engine call goes
// through it — no credential, strategy tree or portfolio engine key ever reaches the
// browser.

import type { CatalogueFilters, Period } from "@/lib/catalogueFilters";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfter: number | null;

  constructor(status: number, code: string, message: string, retryAfter: number | null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
  }
}

const BASE = ((import.meta.env.VITE_API_URL as string | undefined)?.trim() || "/api").replace(/\/$/, "");

async function call<T>(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}): Promise<T> {
  const hasBody = init.body !== undefined;
  const res = await fetch(BASE + path, {
    method: init.method ?? "GET",
    headers: hasBody ? { "content-type": "application/json" } : undefined,
    body: hasBody ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error page from a proxy */
  }
  if (!res.ok) {
    const body = (data ?? {}) as { error?: string; code?: string };
    const retryAfter = Number(res.headers.get("retry-after"));
    throw new ApiError(
      res.status,
      body.code ?? `HTTP_${res.status}`,
      body.error ?? `Request failed (HTTP ${res.status})`,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
    );
  }
  return data as T;
}


const enc = encodeURIComponent;

function qs(values: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(values)) if (v !== undefined) q.set(k, String(v));
  return q.toString();
}

/* ── Types (mirror the backend's JSON) ────────────────────────────── */

export type Hex = `0x${string}`;

export interface CashAsset {
  symbol: string;
  address: Hex;
  decimals: number;
}

export interface Chain {
  chainId: number;
  key: string;
  name: string;
  short: string;
  cash: CashAsset;
  explorer: string;
}

export interface RebalanceSchedule {
  type: "interval" | "cron";
  frequency?: string;
  cron?: string;
  timezone?: string;
}

export interface AppConfig {
  chains: Chain[];
  research: boolean;
  trading: boolean;
  schedule: RebalanceSchedule;
  maxCutoffAgeTradingDays: number;
}

export interface ParamSpec {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit: string;
  hint: string;
}

export type Params = Record<string, number>;

export interface Asset {
  ticker: string;
  name: string;
  ondoSymbol: string;
  kind: string;
  isin: string;
  icon: string;
  addresses: Record<string, string>;
}

export interface PublishedBinding extends ParamSpec { path: (string | number)[]; remainderPath?: (string | number)[] }
export interface PublishedRules { name: string; rebalance: string; benchmark: string; corridor?: number; children: unknown[] }

export interface Template {
  id: string;
  name: string;
  author: string;
  publishedAt?: string;
  rules?: PublishedRules;
  bindings?: PublishedBinding[];
  thesis: string;
  universe: string[];
  fallback: string;
  benchmark: string;
  cadence: "daily" | "weekly" | "monthly" | string;
  params: ParamSpec[];
  defaults: Params;
  assets: Asset[];
  /** Closed to new investment and left out of the lists; existing portfolios keep running. */
  retired: boolean;
}

export interface AssetStrategy {
  id: string;
  name: string;
  role: "universe" | "fallback";
  heldBps: number | null;
}

export interface AssetDetail extends Asset {
  about: string;
  chains: { chainId: number; address: Hex }[];
  strategies: AssetStrategy[];
}

export interface Metrics {
  totalReturn: number;
  cagr: number;
  maxDrawdown: number;
  volatility: number;
  sharpe: number;
  sortino: number;
}

export type Range = "1y" | "3y" | "5y" | "10y";

export interface Backtest {
  source: string;
  templateId: string;
  params: Params;
  paramsKey: string;
  range: Range;
  startDate: string;
  endDate: string;
  metrics: Metrics;
  benchmark: { ticker: string; metrics: Metrics | null };
  series: { dates: string[]; strategy: number[]; benchmark: (number | null)[] };
  computedAt: string;
}

/* ── The strategy list ──────────────────────────────────────────────── */

/** A logo on a card. The list needs nothing else about a holding. */
export interface CardAsset {
  ticker: string;
  ondoSymbol: string;
  icon: string;
}

/** The figure and the sparkline, with the benchmark comparison already made. */
export interface CardBacktest {
  range: Period;
  startDate: string;
  endDate: string;
  totalReturn: number;
  benchmarkTicker: string;
  benchmarkReturn: number;
  beatsBenchmark: boolean;
  series: { dates: string[]; strategy: number[]; benchmark: (number | null)[] };
}

/** One card in the list. `backtest` is null when it could not be had. */
export interface StrategyCard {
  id: string;
  name: string;
  thesis: string;
  author: string;
  publishedAt?: string;
  cadence: string;
  assets: CardAsset[];
  leveraged: boolean;
  backtest: CardBacktest | null;
  target?: Target | null;
}

export interface CataloguePage {
  total: number;
  offset: number;
  limit: number;
  strategies: StrategyCard[];
}

/** A ticker the filter row can offer, with how many strategies can hold it. */
export interface FacetAsset {
  ticker: string;
  name: string;
  ondoSymbol: string;
  kind: string;
  icon: string;
  leveraged: boolean;
  count: number;
}

export interface CatalogueFacets {
  assets: FacetAsset[];
  cadences: { value: string; count: number }[];
  total: number;
  leveraged: number;
}

/** One listed strategy's card: its downsampled backtest and, when asked for, current allocation. Null when unavailable. */
export interface StrategySummary {
  id: string;
  backtest: Backtest | null;
  target?: Target | null;
}

export interface Quote {
  price: number;
  change: number;
  changePct: number;
  asOf: string;
}

/** One calendar year of an asset's daily closes, oldest first. */
export interface Closes {
  ticker: string;
  year: number;
  dates: string[];
  closes: number[];
}

export interface TargetLine {
  ticker: string;
  name: string;
  ondoSymbol: string;
  icon: string;
  bps: number;
  weight: number;
}

export interface ChainReadiness {
  chainId: number;
  executable: boolean;
  reason?: string;
}

export interface Target {
  source: string;
  templateId: string;
  params: Params;
  paramsKey: string;
  cutoff: string;
  marketDay?: string;
  dataLagDays: number;
  ageTradingDays: number;
  fresh: boolean;
  problem?: string;
  lines: TargetLine[];
  changeHash?: string;
  chains: ChainReadiness[];
  evaluatedAt: string;
}

export interface Portfolio {
  /** Set only on an archived portfolio: when its owner retired it. */
  archivedAt?: string;
  portfolioId: string;
  owner: string;
  chainId: number;
  depositAddress: Hex;
  createdAt: string;
  templateId: string;
  templateName: string;
  params: Params;
  paramsLabel: string;
  strategyId: string;
  allocation: TargetLine[];
  cutoff: string;
  version: number;
}

export interface PortfolioSchedule {
  status: "active" | "paused";
  frequency: string | null;
  nextDueAt: string | null;
  lastRebalanceAt: string | null;
}

export interface PortfolioDetail extends Portfolio {
  schedule: PortfolioSchedule | null;
}

export interface Enrollment {
  strategyId: string;
  chainIds: number[];
  flowId: string;
  accountIndex: string;
  agentAccountId: string;
  accountType?: string;
  message: { kind: string; raw: Hex };
}

export interface PrepareResult {
  status: "sign" | "existing";
  portfolio?: Portfolio;
  enrollment?: Enrollment;
}

export interface InvestRequest {
  templateId: string;
  params: Params;
  chainId: number;
  owner: string;
}

/** One day of a portfolio's value against the money put in. */
export interface PerformancePoint {
  date: string;
  value: number;
  /** Deposits to this day, net of withdrawals. */
  deposited: number;
  profit: number;
  /** Money-weighted return as a fraction; null when unavailable. */
  return: number | null;
  live: boolean;
}

export interface Performance {
  method: string;
  asOf: string;
  points: PerformancePoint[];
}

/** One asset whose weight moved in an allocation change, in basis points. */
export interface ChangeLine {
  ticker: string;
  ondoSymbol: string;
  icon: string;
  fromBps: number;
  toBps: number;
}

/** An allocation Brighter published for the portfolio's strategy, against the one it replaced. */
export interface AllocationChange {
  at: string;
  /** The close the new allocation was computed from. */
  cutoff: string;
  /** Largest move first. */
  lines: ChangeLine[];
}

export interface Activity {
  /** Newest first. */
  changes: AllocationChange[];
}

export interface Position {
  assetId: string;
  smartAccountId: string;
  symbol: string;
  decimals: number;
  balance: string;
  balanceRaw: string;
  priceUsd: string;
  valueUsd: string;
}

export interface Positions {
  portfolioId: string;
  totalValueUsd: string;
  fetchedAt: string;
  assets: Position[];
  inTransit?: { totalUsd: string };
  warnings: { kind: string; message: string }[];
}

export interface OperationRef {
  operationId: string;
  submittedAt: string;
}

export type OperationState =
  | "accepted"
  | "running"
  | "retrying"
  | "awaiting_user"
  | "completed"
  | "failed"
  | "cancelled";

export interface Operation {
  operationId: string;
  portfolioId: string;
  kind: string;
  state: OperationState;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

export const isTerminal = (s: OperationState) => s === "completed" || s === "failed" || s === "cancelled";

export type WithdrawMode = "liquidate" | "withdraw";

export interface TypedData {
  domain: { name?: string; version?: string; chainId?: number; verifyingContract?: Hex };
  types: Record<string, { name: string; type: string }[]>;
  primaryType: string;
  message: Record<string, unknown>;
}

export interface WithdrawAuthorization {
  authorizationId?: string;
  expiresAt?: string | number;
  typedData?: TypedData;
}

/* ── Endpoints ────────────────────────────────────────────────────── */

export const api = {
  config: () => call<AppConfig>("/v1/config"),
  templates: () => call<{ templates: Template[] }>("/v1/templates").then((r) => r.templates),
  /** One page of the strategy list, filtered and ordered by the backend. */
  strategies: (filters: CatalogueFilters, page: { limit: number; offset: number }) =>
    call<CataloguePage>(
      `/v1/strategies?${qs({
        period: filters.period,
        sort: filters.sort,
        assets: filters.assets.length ? filters.assets.join(",") : undefined,
        cadence: filters.cadence.length ? filters.cadence.join(",") : undefined,
        beatsBenchmark: filters.beatsBenchmark ? 1 : undefined,
        leveraged: filters.leveraged ? 1 : undefined,
        limit: page.limit,
        offset: page.offset || undefined,
      })}`,
    ),
  /** What the filter row can offer: tickers grouped by kind, and cadences. */
  strategyFacets: () => call<CatalogueFacets>("/v1/strategies/facets"),
  /** Every listed strategy's card in one request. */
  summaries: (range: Range, points: number, targets: boolean) =>
    call<{ summaries: StrategySummary[] }>(`/v1/templates/summaries?${qs({ range, points, targets: targets ? 1 : undefined })}`).then((r) => r.summaries),
  /** `since` (YYYY-MM-DD) returns only the days from then on; metrics still cover the whole range. */
  backtest: (id: string, params: Params, range: Range, points?: number, since?: string) =>
    call<Backtest>(`/v1/templates/${enc(id)}/backtest?${qs({ ...params, range, points, since })}`),
  target: (id: string, params: Params) => call<Target>(`/v1/templates/${enc(id)}/target?${qs(params)}`),
  asset: (ticker: string) => call<AssetDetail>(`/v1/assets/${enc(ticker)}`),
  closes: (ticker: string, year: number) => call<Closes>(`/v1/assets/${enc(ticker)}/closes?${qs({ year })}`),

  /**
   * Tell the backend a deposit finished. A success is only a transaction hash:
   * everything said about it is read back off the chain, so nothing here is
   * taken on trust. A failure cannot be checked, and reaches operators only.
   */
  reportDeposit: (portfolioId: string, body: { status: "succeeded"; txHash: string } | { status: "failed"; reason: string }) =>
    call<{ amount: string; token: string; txHash: string } | null>(`/v1/portfolios/${enc(portfolioId)}/deposits/report`, { method: "POST", body }),

  prepareInvest: (body: InvestRequest) => call<PrepareResult>("/v1/invest/prepare", { method: "POST", body }),
  confirmInvest: (
    body: InvestRequest &
      Omit<Enrollment, "message"> & { signature: Hex },
  ) => call<Portfolio>("/v1/invest/confirm", { method: "POST", body }),

  /** A wallet's live portfolios, or the ones it has archived. Never both. */
  portfolios: (owner: string, archived = false) =>
    call<{ portfolios: Portfolio[] }>(`/v1/portfolios?${qs({ owner, archived: archived ? 1 : undefined })}`).then((r) => r.portfolios),
  portfolio: (id: string) => call<PortfolioDetail>(`/v1/portfolios/${enc(id)}`),
  positions: (id: string) => call<Positions>(`/v1/portfolios/${enc(id)}/positions`),
  performance: (id: string, since?: string) =>
    call<Performance>(`/v1/portfolios/${enc(id)}/performance${since ? `?${qs({ since })}` : ""}`),
  activity: (id: string) => call<Activity>(`/v1/portfolios/${enc(id)}/activity`),
  operation: (id: string, opId: string) =>
    call<Operation>(`/v1/portfolios/${enc(id)}/operations/${enc(opId)}`),
  deploy: (id: string) => call<OperationRef>(`/v1/portfolios/${enc(id)}/deploy`, { method: "POST", body: {} }),
  withdrawSignature: (id: string, body: { mode: WithdrawMode; assets?: { assetId: string; amountRaw: string }[] }) =>
    call<WithdrawAuthorization>(`/v1/portfolios/${enc(id)}/withdraw/signature`, { method: "POST", body }),
  withdraw: (id: string, body: { mode: WithdrawMode; message: unknown; signature: Hex }) =>
    call<OperationRef>(`/v1/portfolios/${enc(id)}/withdraw`, { method: "POST", body }),
  archive: (id: string, body: { issuedAt: string; signature: Hex }) =>
    call<{ archived: boolean }>(`/v1/portfolios/${enc(id)}/archive`, { method: "POST", body }),
};

/**
 * What the owner signs to archive a portfolio. Must match the backend's
 * service.ArchiveMessage exactly; issuedAt is RFC 3339 to the second.
 */
export function archiveMessage(id: string, issuedAt: string): string {
  return `Archive Brighter portfolio ${id}\n\nThis stops its automation and hides it from your portfolios. It moves no funds.\n\nIssued At: ${issuedAt}`;
}