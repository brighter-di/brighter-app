import type { FC } from "react";
import type { Route } from "@lifi/sdk";
import { LogoStack } from "@/components/ui/AssetLogo";
import { Pill } from "@/components/ui/Pill";
import { formatDuration, routeSummary } from "@/lib/deposit";
import { formatUsd } from "@/lib/format";

const TAGS: Record<string, string> = { RECOMMENDED: "Best", CHEAPEST: "Cheapest", FASTEST: "Fastest" };
const usdt = (value: string) => Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The best ways to turn the chosen token into USDT at the portfolio, in LI.FI's order: its recommendation first. */
export const RouteList: FC<{ routes: Route[]; loading: boolean; stale: boolean; message: string | undefined; selected: string | undefined; onSelect: (route: Route) => void; disabled: boolean }> = ({
  routes,
  loading,
  stale,
  message,
  selected,
  onSelect,
  disabled,
}) => (
  <section aria-labelledby="deposit-routes" className="min-w-0">
    <h3 id="deposit-routes" className="text-sm font-semibold text-text-primary">Best options</h3>
    <div role="listbox" aria-label="Routes" className={`mt-2 border-t border-surface-border transition-opacity ${stale ? "opacity-50" : ""}`}>
      {loading && routes.length === 0 ? (
        Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="border-b border-surface-border py-3">
            <div className="h-5 w-32 animate-pulse bg-surface-2" />
            <div className="mt-2 h-3.5 w-48 animate-pulse bg-surface-1" />
          </div>
        ))
      ) : routes.length === 0 ? (
        <p className="border-b border-surface-border py-3 text-sm text-text-muted">{message}</p>
      ) : (
        routes.slice(0, 4).map((route) => {
          const s = routeSummary(route);
          const active = route.id === selected;
          return (
            <button
              key={route.id}
              type="button"
              role="option"
              aria-selected={active}
              disabled={disabled}
              onClick={() => onSelect(route)}
              className="group flex w-full items-start gap-3 border-b border-surface-border py-3 text-left disabled:cursor-default"
            >
              <span aria-hidden className={`mt-2 h-2 w-2 shrink-0 rounded-full transition-colors ${active ? "bg-accent" : "bg-surface-3 group-hover:bg-text-muted"}`} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className={`font-mono text-base font-semibold tabular-nums transition-colors group-hover:text-accent ${active ? "text-accent" : "text-text-primary"}`}>{usdt(s.receive)} USDT</span>
                  {(route.tags ?? []).filter((tag) => TAGS[tag]).map((tag) => (
                    <Pill key={tag} tone={tag === "RECOMMENDED" ? "accent" : undefined}>{TAGS[tag]}</Pill>
                  ))}
                </span>
                <span className="mt-1 block text-xs text-text-muted">
                  {formatDuration(s.seconds)} · Gas {formatUsd(s.gasUSD)}
                  {s.feesUSD > 0 && ` · Fees ${formatUsd(s.feesUSD)}`} · At least {usdt(s.receiveMin)}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5" title={s.tools.map((t) => t.name).join(", ")}>
                <LogoStack items={s.tools.map((t) => ({ src: t.logoURI, symbol: t.name }))} size={18} max={3} />
              </span>
            </button>
          );
        })
      )}
    </div>
  </section>
);
