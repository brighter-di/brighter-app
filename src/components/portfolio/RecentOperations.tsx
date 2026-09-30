import { type FC, type ReactNode, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AllocationChange, PerformancePoint, Template } from "@/api/client";
import { positionsOptions, useActivity, useOperation, usePerformance } from "@/hooks/queries";
import { dismissOperation, type Holding, listOperations, recordAfter, recordBefore, type SavedOperation } from "@/lib/ops";
import { bps, formatDate, formatDateTime, pct, signedUsd, tokenSymbol } from "@/lib/format";
import { AssetLogo } from "@/components/ui/AssetLogo";
import { OperationStatus } from "./OperationStatus";

/** One row of the feed, whatever its source. */
interface Entry {
  key: string;
  /** Milliseconds, for ordering. */
  at: number;
  title: string;
  when: string;
  /** Right-aligned: a status icon or an amount. */
  side?: ReactNode;
  /** Under the title: what changed. */
  body?: ReactNode;
}

/** One asset's share, before and after. */
interface Move {
  symbol: string;
  icon?: string;
  from: string;
  to: string;
}

/**
 * Deposits and withdrawals: the days the money put in changed. The source is
 * daily, so a deposit sits at the start of its day, ahead of the rebalance
 * that invests it, and a withdrawal at the end, after the operation that made
 * it.
 */
function cashFlows(points: PerformancePoint[]): Entry[] {
  const out: Entry[] = [];
  let before = 0;
  for (const p of points) {
    const delta = p.deposited - before;
    before = p.deposited;
    if (Math.abs(delta) < 0.01) continue;
    out.push({
      key: `cash-${p.date}`,
      at: Date.parse(`${p.date}T${delta > 0 ? "00:00:00" : "23:59:59"}Z`),
      title: delta > 0 ? "Deposit" : "Withdrawal",
      when: formatDate(p.date),
      side: <span className="font-mono text-sm tabular-nums text-text-primary">{signedUsd(delta)}</span>,
    });
  }
  return out;
}

/** Each asset whose share moved: from, then to. */
const Moves: FC<{ moves: Move[] }> = ({ moves }) => (
  <ul className="mt-2 space-y-1.5">
    {moves.map((m) => (
      <li key={m.symbol} className="flex items-center gap-2.5 text-sm">
        <AssetLogo src={m.icon} symbol={tokenSymbol(m.symbol)} size={20} />
        <span className="w-24 truncate font-medium text-text-primary">{tokenSymbol(m.symbol)}</span>
        <span className="font-mono tabular-nums text-text-muted">{m.from}</span>
        <span aria-label="to" className="text-text-muted">
          →
        </span>
        <span className="font-mono tabular-nums text-text-primary">{m.to}</span>
      </li>
    ))}
  </ul>
);

const allocationMoves = (c: AllocationChange): Move[] =>
  c.lines.map((l) => ({ symbol: l.ondoSymbol, icon: l.icon || undefined, from: bps(l.fromBps), to: bps(l.toBps) }));

// Share moves smaller than this are price drift, not trades.
const MIN_MOVE = 0.005;

/** Each token whose share of the portfolio moved between two snapshots, largest move first. */
function holdingMoves(before: Holding[], after: Holding[], icons: Map<string, string>): Move[] {
  const shares = (hs: Holding[]) => {
    const total = hs.reduce((s, h) => s + h.valueUsd, 0);
    return new Map(hs.map((h) => [h.symbol, total > 0 ? h.valueUsd / total : 0]));
  };
  const b = shares(before);
  const a = shares(after);
  return [...new Set([...b.keys(), ...a.keys()])]
    .map((symbol) => ({ symbol, from: b.get(symbol) ?? 0, to: a.get(symbol) ?? 0 }))
    .filter((m) => Math.abs(m.to - m.from) >= MIN_MOVE)
    .sort((x, y) => Math.abs(y.to - y.from) - Math.abs(x.to - x.from) || x.symbol.localeCompare(y.symbol))
    .map((m) => ({ symbol: m.symbol, icon: icons.get(m.symbol), from: pct(m.from, 2, false), to: pct(m.to, 2, false) }));
}

/**
 * What an operation changed in the holdings. The portfolio engine reports no trades, so the
 * holdings are read as the operation starts and again once it has completed,
 * and the two are compared.
 */
const OperationMoves: FC<{ op: SavedOperation; icons: Map<string, string> }> = ({ op, icons }) => {
  const { data: operation } = useOperation(op.portfolioId, op.operationId);
  const { data: positions } = useQuery(positionsOptions(op.portfolioId));
  const finishedAt = operation?.state === "completed" ? (operation.finishedAt ?? operation.updatedAt) : null;
  useEffect(() => {
    if (!positions) return;
    recordBefore(op.operationId, positions);
    if (finishedAt) recordAfter(op.operationId, positions, finishedAt);
  }, [positions, finishedAt, op.operationId]);

  if (!op.before || !op.after) return null;
  const moves = holdingMoves(op.before, op.after, icons);
  return moves.length > 0 ? <Moves moves={moves} /> : null;
};

/**
 * The portfolio's recent activity, newest first: the strategy's allocation
 * changes, deposits and withdrawals, and the operations started from this
 * browser with their live state and what they changed.
 */
export const RecentOperations: FC<{ portfolioId: string; template?: Template }> = ({ portfolioId, template }) => {
  const [ops, setOps] = useState<SavedOperation[]>(() => listOperations());
  useEffect(() => {
    const refresh = () => setOps(listOperations());
    window.addEventListener("brighter:ops", refresh);
    return () => window.removeEventListener("brighter:ops", refresh);
  }, []);
  const activity = useActivity(portfolioId);
  const performance = usePerformance(portfolioId);
  const icons = new Map((template?.assets ?? []).map((a) => [a.ondoSymbol, a.icon]));

  const entries: Entry[] = [
    ...ops
      .filter((op) => op.portfolioId === portfolioId)
      .map((op) => ({
        key: `op-${op.operationId}`,
        at: Date.parse(op.submittedAt),
        title: op.label,
        when: formatDateTime(op.submittedAt),
        side: (
          <>
            <OperationStatus portfolioId={op.portfolioId} operationId={op.operationId} compact />
            <button onClick={() => dismissOperation(op.operationId)} className="text-sm text-text-muted hover:text-text-primary" aria-label="Dismiss">
              ✕
            </button>
          </>
        ),
        body: <OperationMoves op={op} icons={icons} />,
      })),
    // Weights drift with prices every day, so the strategy records a change
    // most days even when it has re-picked nothing — a monthly rule ends up
    // looking like a daily one. Only the current allocation is worth showing.
    // Copied before sorting: the array belongs to the query cache.
    ...[...(activity.data?.changes ?? [])]
      .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      .slice(0, 1)
      .map((c) => ({
        key: `change-${c.at}`,
        at: Date.parse(c.at),
        title: "Allocation changed",
        when: formatDateTime(c.at),
        body: <Moves moves={allocationMoves(c)} />,
      })),
    ...cashFlows(performance.data?.points ?? []),
  ].sort((a, b) => b.at - a.at);

  if (entries.length === 0) return null;
  return (
    <section aria-label="Recent activity" className="w-full pt-10">
      <ul className="space-y-5">
        {entries.map((e) => (
          <li key={e.key} className="flex w-full items-start gap-4">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-text-primary">{e.title}</div>
              <div className="text-sm text-text-muted">{e.when}</div>
              {e.body}
            </div>
            {e.side && <div className="ml-auto flex shrink-0 items-center gap-3">{e.side}</div>}
          </li>
        ))}
      </ul>
    </section>
  );
};
