// Recent portfolio operations (rebalances, withdrawals), kept in localStorage
// so a portfolio page can show their status across reloads. The portfolio engine has no
// list-operations endpoint and reports no trades, so this is the only record
// the browser has — including the holdings before and after each operation,
// which is how the page shows what it changed. Entries that have been
// terminal for a day expire.

import type { Positions } from "@/api/client";
import { toNumber } from "./format";

/** What the portfolio held at one moment: dollar value per token. */
export interface Holding {
  symbol: string;
  valueUsd: number;
}

export interface SavedOperation {
  operationId: string;
  portfolioId: string;
  label: string;
  submittedAt: string;
  /** Holdings as the operation was submitted, and once it had completed. */
  before?: Holding[];
  after?: Holding[];
}

interface Stored extends SavedOperation {
  terminalAt?: string;
  /** When the before snapshot was read. */
  beforeAt?: string;
}

const KEY = "brighter:ops:v2";
const MAX_KEEP = 25;
const EXPIRE_TERMINAL_MS = 24 * 60 * 60 * 1000;
// An operation takes minutes to execute, so holdings read this soon after it
// was submitted are still what it started from…
const BEFORE_WINDOW_MS = 30_000;
// …and holdings read this long after it completed include its trades.
const AFTER_DELAY_MS = 30_000;

function readAll(): Stored[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Stored[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_KEEP) : [];
  } catch {
    return [];
  }
}

function writeAll(rows: Stored[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows.slice(0, MAX_KEEP)));
  } catch {
    /* private mode / quota */
  }
  window.dispatchEvent(new Event("brighter:ops"));
}

export function recordOperation(op: SavedOperation): void {
  writeAll([op, ...readAll().filter((r) => r.operationId !== op.operationId)]);
}

export function listOperations(): SavedOperation[] {
  const now = Date.now();
  const all = readAll();
  const keep = all.filter((r) => !r.terminalAt || now - Date.parse(r.terminalAt) < EXPIRE_TERMINAL_MS);
  if (keep.length !== all.length) writeAll(keep);
  return keep.map((r) => ({
    operationId: r.operationId,
    portfolioId: r.portfolioId,
    label: r.label,
    submittedAt: r.submittedAt,
    before: r.before,
    after: r.after,
  }));
}

export function markTerminal(operationId: string): void {
  const all = readAll();
  if (!all.some((r) => r.operationId === operationId && !r.terminalAt)) return;
  writeAll(all.map((r) => (r.operationId === operationId && !r.terminalAt ? { ...r, terminalAt: new Date().toISOString() } : r)));
}

export function dismissOperation(operationId: string): void {
  writeAll(readAll().filter((r) => r.operationId !== operationId));
}

/** Every position worth at least a cent. */
function holdings(p: Positions): Holding[] {
  return p.assets.map((a) => ({ symbol: a.symbol, valueUsd: toNumber(a.valueUsd) })).filter((h) => h.valueUsd >= 0.01);
}

/** Keeps the newest holdings read before the operation could have traded. */
export function recordBefore(operationId: string, p: Positions): void {
  const read = Date.parse(p.fetchedAt);
  const all = readAll();
  const r = all.find((x) => x.operationId === operationId);
  if (!r || !(read <= Date.parse(r.submittedAt) + BEFORE_WINDOW_MS) || (r.beforeAt && Date.parse(r.beforeAt) >= read)) return;
  writeAll(all.map((x) => (x === r ? { ...x, before: holdings(p), beforeAt: p.fetchedAt } : x)));
}

/** Keeps the first holdings read well after the operation completed. */
export function recordAfter(operationId: string, p: Positions, finishedAt: string): void {
  if (!(Date.parse(p.fetchedAt) >= Date.parse(finishedAt) + AFTER_DELAY_MS)) return;
  const all = readAll();
  if (!all.some((x) => x.operationId === operationId && !x.after)) return;
  writeAll(all.map((x) => (x.operationId === operationId && !x.after ? { ...x, after: holdings(p) } : x)));
}
