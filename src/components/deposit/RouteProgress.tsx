import type { FC } from "react";
import type { RouteExtended } from "@lifi/sdk";
import { AssetLogo } from "@/components/ui/AssetLogo";
import { Spinner } from "@/components/ui/Spinner";
import { shortAddr } from "@/lib/format";

const STATUS: Record<string, string> = {
  ACTION_REQUIRED: "Confirm in your wallet",
  PENDING: "In progress",
  DONE: "Done",
  FAILED: "Failed",
};

/** Each step of a running route, with its transactions as they appear. */
export const RouteProgress: FC<{ route: RouteExtended }> = ({ route }) => (
  <ol aria-live="polite" className="space-y-3 border-t border-surface-border pt-4">
    {route.steps.map((step, index) => {
      const status = step.execution?.status;
      const bridge = step.action.fromChainId !== step.action.toChainId;
      const links = (step.execution?.actions ?? []).filter((action) => action.txLink && action.txHash);
      return (
        <li key={step.id} className="flex gap-3">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center">
            {status === "DONE" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-success" aria-hidden><path d="m5 12 4 4L19 6" /></svg>
            ) : status === "FAILED" ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" className="text-danger" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
            ) : status ? (
              <Spinner size="sm" />
            ) : (
              <span className="font-mono text-xs text-text-muted">{index + 1}</span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm text-text-primary">
              <AssetLogo src={step.toolDetails.logoURI} symbol={step.toolDetails.name} size={18} />
              {bridge ? "Bridge" : "Swap"} via {step.toolDetails.name}
            </div>
            <div className={`text-xs ${status === "FAILED" ? "text-danger" : status === "ACTION_REQUIRED" ? "text-warn" : "text-text-muted"}`}>{status ? (STATUS[status] ?? status) : "Waiting"}</div>
            {links.map((action) => (
              <a key={action.txHash} href={action.txLink} target="_blank" rel="noopener noreferrer" className="mr-3 font-mono text-xs text-accent hover:underline">
                {shortAddr(action.txHash)}
              </a>
            ))}
          </div>
        </li>
      );
    })}
  </ol>
);
