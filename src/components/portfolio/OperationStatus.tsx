import { type FC, useEffect } from "react";
import type { OperationState } from "@/api/client";
import { isTerminal } from "@/api/client";
import { useOperation } from "@/hooks/queries";
import { markTerminal } from "@/lib/ops";
import { Spinner } from "@/components/ui/Spinner";
import { Tooltip } from "@/components/ui/InfoTip";

// Acceptance is not execution: an operation is only "done" once it completed
// on-chain. Every state is shown as what it is.
const COPY: Record<OperationState, { label: string; tone: string }> = {
  accepted: { label: "Submitted, waiting to run", tone: "text-text-secondary" },
  running: { label: "Executing on-chain", tone: "text-accent" },
  retrying: { label: "Retrying", tone: "text-warn" },
  awaiting_user: { label: "Needs another signature", tone: "text-warn" },
  completed: { label: "Completed", tone: "text-success" },
  failed: { label: "Failed", tone: "text-danger" },
  cancelled: { label: "Cancelled", tone: "text-text-muted" },
};

/** A check for done, a cross for failed, a spinner while it runs. */
const StateIcon: FC<{ state: OperationState | undefined }> = ({ state }) => {
  if (!state || !isTerminal(state)) return <Spinner size="sm" />;
  if (state === "cancelled") return <span className="block h-2.5 w-2.5 rounded-full bg-surface-3" />;
  const done = state === "completed";
  return (
    <svg viewBox="0 0 16 16" width={16} height={16} className={done ? "text-success" : "text-danger"} aria-hidden>
      <circle cx="8" cy="8" r="7.5" fill="currentColor" opacity={0.16} />
      {done ? (
        <path d="M4.8 8.3l2.1 2.1 4.3-4.6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M5.5 5.5l5 5m0-5l-5 5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      )}
    </svg>
  );
};

/**
 * An operation's live state. compact shows only the icon, with the state (and
 * any error) on hover.
 */
export const OperationStatus: FC<{ portfolioId: string; operationId: string; label?: string; showKind?: boolean; compact?: boolean }> = ({
  portfolioId,
  operationId,
  label,
  showKind = true,
  compact = false,
}) => {
  const { data, error } = useOperation(portfolioId, operationId);
  useEffect(() => {
    if (data && isTerminal(data.state)) markTerminal(operationId);
  }, [data, operationId]);

  const c = data ? COPY[data.state] : null;
  const fetchError = error && !data ? `Couldn't fetch status: ${(error as Error).message}` : null;

  if (compact) {
    const tip = fetchError ?? [c?.label ?? "Checking status…", data?.error].filter(Boolean).join(". ");
    return (
      <Tooltip content={tip} align="right">
        <span aria-label={tip} className="grid h-6 w-6 place-items-center">
          <StateIcon state={data?.state} />
        </span>
      </Tooltip>
    );
  }

  return (
    <div className="flex items-start gap-2.5 py-1">
      <span className="mt-0.5">
        <StateIcon state={data?.state} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`text-sm font-semibold ${c?.tone ?? "text-text-secondary"}`}>{c?.label ?? "Checking status…"}</span>
          {showKind && <span className="text-sm text-text-muted">{label ?? data?.kind}</span>}
        </div>
        {data?.error && <p className="mt-1 text-sm leading-snug text-danger">{data.error}</p>}
        {fetchError && <p className="mt-1 text-sm text-danger">{fetchError}</p>}
      </div>
    </div>
  );
};
