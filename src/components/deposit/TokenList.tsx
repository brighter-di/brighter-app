import { type FC, useMemo, useState } from "react";
import { formatUnits } from "viem";
import type { Token, TokenAmount } from "@lifi/sdk";
import { AssetLogo } from "@/components/ui/AssetLogo";
import { Spinner } from "@/components/ui/Spinner";
import { rankTokens, tokenKey } from "@/lib/deposit";
import { formatBalance, formatUsd } from "@/lib/format";
import { Check, SearchField } from "./SearchField";

/** A chain's tokens, what the wallet holds first, searchable by symbol, name or address. */
export const TokenList: FC<{
  chainName: string | undefined;
  tokens: Token[] | undefined;
  loading: boolean;
  error: boolean;
  balances: Map<string, TokenAmount> | undefined;
  balancesLoading: boolean;
  selected: string | undefined;
  onSelect: (token: Token) => void;
}> = ({ chainName, tokens, loading, error, balances, balancesLoading, selected, onSelect }) => {
  const [query, setQuery] = useState("");
  const { shown, matching } = useMemo(() => rankTokens(tokens ?? [], balances, query), [tokens, balances, query]);

  return (
    <section aria-labelledby="deposit-tokens" className="min-w-0">
      <div className="flex items-center justify-between gap-2">
        <h3 id="deposit-tokens" className="text-sm font-semibold text-text-primary">
          Token{chainName ? <span className="font-normal text-text-muted"> on {chainName}</span> : null}
        </h3>
        {balancesLoading && <Spinner size="xs" label="Loading balances" />}
      </div>
      <SearchField value={query} onChange={setQuery} placeholder="Search by name or address" label="Search tokens" />
      <div role="listbox" aria-label="Tokens" className="mt-2 max-h-[22rem] overflow-y-auto lg:max-h-[30rem]">
        {loading ? (
          Array.from({ length: 8 }, (_, i) => <div key={i} className="my-3 h-8 animate-pulse bg-surface-1" />)
        ) : error ? (
          <p className="py-3 text-sm text-danger">Couldn't load tokens. Try again shortly.</p>
        ) : shown.length === 0 ? (
          <p className="py-3 text-sm text-text-muted">{query ? `No token matches “${query}”.` : "No tokens on this chain."}</p>
        ) : (
          shown.map(({ token, amount, valueUSD }) => {
            const key = tokenKey(token);
            const active = key === selected;
            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => onSelect(token)}
                className="group flex w-full items-center gap-2.5 py-2 text-left"
              >
                <AssetLogo src={token.logoURI} symbol={token.symbol} size={24} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-medium transition-colors group-hover:text-accent ${active ? "text-accent" : "text-text-primary"}`}>{token.symbol}</span>
                  <span className="block truncate text-xs text-text-muted">{token.name}</span>
                </span>
                {amount != null && amount > 0n && (
                  <span className="shrink-0 text-right">
                    <span className="block font-mono text-sm tabular-nums text-text-primary">{formatBalance(Number(formatUnits(amount, token.decimals)))}</span>
                    {valueUSD > 0 && <span className="block font-mono text-xs tabular-nums text-text-muted">{formatUsd(valueUSD)}</span>}
                  </span>
                )}
                {active && <Check />}
              </button>
            );
          })
        )}
      </div>
      {matching > shown.length && <p className="mt-2 text-xs text-text-muted">Showing {shown.length} of {matching}. Search to find the rest.</p>}
    </section>
  );
};
