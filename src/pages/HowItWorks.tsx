import type { FC } from "react";
import { Link } from "react-router-dom";
import { useTitle } from "@/hooks/useTitle";

// The cash leg differs by chain (USDT on BNB Chain, USDC on Ethereum), so the
// copy names none of them.
const STEPS: { title: string; body: string[] }[] = [
  {
    title: "Pick a rule",
    body: [
      "Every Brighter strategy is one plain rule applied to a fixed list of tokenized US stocks and ETFs: rank by momentum, follow a trend, weight by volatility, or step aside when the market looks stretched.",
      "You can tune each rule's settings, such as how many trading days it looks back or how many names it holds. Every combination is its own strategy with its own history.",
    ],
  },
  {
    title: "See how it would have done",
    body: [
      "Brighter runs the exact rule over years of daily prices of the underlying stocks and ETFs, charging modelled trading fees and slippage along the way, and compares the result with the S&P 500.",
    ],
  },
  {
    title: "Create your portfolio",
    body: [
      "Connect any EVM wallet and sign once. The signature creates your portfolio: a smart account onchain that your wallet owns.",
      "Brighter can rebalance that account into the strategy's allocation and nothing else. It can't send funds anywhere; every withdrawal needs a new signature from you.",
    ],
  },
  {
    title: "Deposit stablecoins",
    body: [
      "Send stablecoins from your wallet to the portfolio. They're converted into tokenized stocks at the strategy's current allocation, at the next scheduled rebalance or right away with Invest now.",
      "The tokens are issued by Ondo Global Markets and backed one-to-one by the real shares and ETFs. They trade during US market hours, so a deposit made outside them waits for the open.",
    ],
  },
  {
    title: "Stay on target",
    body: [
      "After every US market close Brighter re-runs the rule on the latest prices. When the allocation changes, your portfolio moves to the new one at its next rebalance.",
      "A new allocation is used only if it passes every check: it adds up to exactly 100%, holds only assets the strategy allows, and comes from fresh market data. If any check fails, your portfolio keeps the allocation it has.",
    ],
  },
  {
    title: "Withdraw anytime",
    body: [
      "Sell everything back to stablecoins, or take the tokens themselves, with one signature. Proceeds go only to the wallet that owns the portfolio.",
    ],
  },
];

export const HowItWorks: FC = () => {
  useTitle("How it works");
  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-4xl font-bold text-text-primary sm:text-5xl">How Brighter works</h1>
      <p className="mt-4 text-xl leading-relaxed text-text-secondary">
        From choosing a rule to taking your money out, in six steps. Your funds stay in an account your wallet owns the whole way through.
      </p>

      <ol className="mt-8">
        {STEPS.map((s, i) => (
          <li key={s.title} className="grid gap-2 border-b border-surface-border py-8 sm:grid-cols-[56px_minmax(0,1fr)]">
            <span className="font-mono text-lg text-text-muted">{i + 1}</span>
            <div>
              <h2 className="text-2xl font-semibold text-text-primary">{s.title}</h2>
              {s.body.map((p) => (
                <p key={p} className="mt-3 text-lg leading-relaxed text-text-secondary">
                  {p}
                </p>
              ))}
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Link to="/strategies" className="inline-flex h-12 items-center rounded-md bg-text-primary px-6 text-base font-semibold text-surface-0 hover:opacity-90">
          Explore strategies
        </Link>
        <a href="mailto:info@brighter.fi" className="inline-flex h-12 items-center rounded-md px-6 text-base font-semibold text-text-primary hover:bg-surface-1">
          Ask a question
        </a>
      </div>
    </div>
  );
};
