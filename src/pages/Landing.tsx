// brighter.fi — the public landing page.
//
// Carries the site's existing identity (black stage, ice-blue brand, "…
// Onchain.") over to the strategies product. The one memorable element is
// live: the hero draws the five strongest unleveraged strategies' real
// five-year backtests, each labelled where it ends. Everything else is quiet and divided
// only by hairline rules, until you point at it: after 1inch, the black
// sections answer a hover with bright, proud colour. Type follows the app's
// scale.

import { type CSSProperties, type FC, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { Backtest, Template } from "@/api/client";
import { strategiesOptions, useSummaries, useTemplates } from "@/hooks/queries";
import { DEFAULT_FILTERS } from "@/lib/catalogueFilters";
import { holdsLeveraged } from "@/lib/leverage";
import { useElementWidth } from "@/hooks/useElementWidth";
import { useTitle } from "@/hooks/useTitle";
import { AssetLogo } from "@/components/ui/AssetLogo";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { pct, tokenSymbol } from "@/lib/format";
import { axisPct, logTicks, needsLog } from "@/lib/axis";
import { load } from "@/pages/lazy";

const ICE = "#9BC4FF";

// The hover palette: loud on black, and dark text reads on every one of them.
const PROUD = { yellow: "#FFEE00", cyan: "#3FE0FF", pink: "#FF5CA8", lime: "#C6FF3D", orange: "#FF9E4E" };

// brighter.fi's cold theme: ice-blue replaces the warm brand on this page.
const THEME = {
  ["--color-brand" as string]: ICE,
  ["--color-brand-hover" as string]: "#7AA8F0",
  ["--color-accent" as string]: ICE,
} as CSSProperties;

const fill = (color: string) => ({ ["--proud" as string]: color }) as CSSProperties;

const CTA = "rounded-md bg-text-primary font-semibold text-surface-0 transition-opacity hover:opacity-90";

// How many strategies the hero chart draws, beside the S&P 500.
const SHOWN = 5;

interface Row {
  template: Template;
  backtest?: Backtest;
}

export const Landing: FC = () => {
  useTitle();
  // Fetch the catalogue's code once the page is idle, so "Explore strategies"
  // and a click on the chart open without waiting on another download. The
  // list's own first page goes with it: the landing page reads five-year
  // curves, the list one-year ones with today's targets, so its cards would
  // otherwise wait on a round trip that could have happened while the reader
  // was here.
  const queryClient = useQueryClient();
  useEffect(() => {
    const warm = () => {
      void load.strategyDetail();
      void queryClient.prefetchInfiniteQuery(strategiesOptions(DEFAULT_FILTERS));
    };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(warm, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(warm, 1500);
    return () => clearTimeout(id);
  }, [queryClient]);
  const { data: templates } = useTemplates();
  // Every strategy's five-year curve in one request, drawn from this browser's copy first.
  const summaries = useSummaries("5y", 90, false);
  const list = (templates ?? []).filter((t) => !t.retired);
  const rows: Row[] = list.map((t) => ({ template: t, backtest: summaries.data?.get(t.id)?.backtest ?? undefined }));
  const pending = !templates || summaries.isPending;

  return (
    <div data-theme="dark" style={THEME} className="min-h-screen bg-surface-0 font-sans text-text-primary">
      <Hero rows={rows} pending={pending} />
      <Steps />
      <Ownership rows={rows} />
      <Closer />
      <SiteFooter />
    </div>
  );
};

/* ── Hero ─────────────────────────────────────────────────────────────── */

const Hero: FC<{ rows: Row[]; pending: boolean }> = ({ rows, pending }) => (
  <section className="relative overflow-hidden bg-black">
    {/* brighter.fi's lamp, lighting the headline from the right. Dimmed and
        cooled so it sits under the ice-blue chart instead of competing. */}
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[720px] overflow-hidden sm:h-[780px]">
      {/* The source is low-resolution: a soft blur keeps the glow and the
          lamp's silhouette while hiding compression artefacts. Scaled a
          touch so the blurred edges fall outside the clip. */}
      {/* Share the content's anchor. The 180px overhang preserves the lamp's
          placement at the 14-inch MacBook's default 1512px browser width:
          (1512px - the 1152px content container) / 2. */}
      <div className="absolute inset-0 mx-auto max-w-6xl">
        <img
          src="/hero-lamp.webp"
          alt=""
          width={1500}
          height={1001}
          fetchPriority="high"
          className="absolute -right-[180px] top-0 h-full w-auto max-w-none origin-top-right scale-[1.03] select-none object-cover opacity-80"
          style={{ filter: "blur(3.5px) saturate(0.5) brightness(0.8)" }}
        />
      </div>
      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, #000 0%, rgba(0,0,0,0.82) 32%, rgba(0,0,0,0.2) 68%, rgba(0,0,0,0.45) 100%)" }} />
      <div className="absolute inset-x-0 bottom-0 h-72" style={{ background: "linear-gradient(to bottom, transparent, #000)" }} />
    </div>
    {/* Same size and spacing as the app's Header, so the brand doesn't jump between them. */}
    <header className="relative mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6">
      <Link to="/" className="flex items-center gap-2 font-display text-lg font-semibold">
        <img src="/logo-b.svg" alt="" aria-hidden width={22} height={27} className="h-6 w-auto" />
        Brighter
      </Link>
    </header>

    <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 sm:px-8 sm:pt-24">
      <h1 className="font-display font-bold" style={{ fontSize: "clamp(52px, 8.4vw, 112px)", lineHeight: 0.93, letterSpacing: "-0.04em" }}>
        Buy strategies.
        <br />
        Onchain.
      </h1>
      <div className="mt-8 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-[36rem] text-xl leading-relaxed text-text-secondary">
          Pick a rule-based portfolio, see how it would have done, and hold it as tokenized US stocks in your own
          wallet. Brighter re-checks the rule after every market close and keeps you on target.
        </p>
        <div className="flex shrink-0 gap-3">
          <Link to="/strategies" className={`${CTA} px-6 py-3.5 text-base`}>
            Explore strategies
          </Link>
          <Link to="/how-it-works" className="rounded-md px-6 py-3.5 text-base font-semibold text-text-primary transition-colors hover:bg-surface-2">
            How it works
          </Link>
        </div>
      </div>

      <div className="mt-16 border-t border-surface-border pt-8">
        <HeroChart rows={rows} pending={pending} />
      </div>
    </div>
  </section>
);

/** The strongest strategies' five-year curves on one scale, each named where it ends. */
const HeroChart: FC<{ rows: Row[]; pending: boolean }> = ({ rows, pending }) => {
  const wrap = useRef<HTMLDivElement>(null);
  const width = useElementWidth(wrap);
  const navigate = useNavigate();
  const [active, setActive] = useState<string | null>(null);

  // Wait for every backtest, so the strongest are picked once rather than
  // swapped in as results arrive. Strategies that hold leveraged or inverse
  // funds are left out: their compounding would dwarf every other line.
  const ready = pending
    ? []
    : rows
        .filter((r): r is Row & { backtest: Backtest } => !!r.backtest && r.backtest.series.dates.length > 1)
        .filter((r) => !holdsLeveraged(r.template.assets))
        .sort((a, b) => b.backtest.series.strategy.at(-1)! - a.backtest.series.strategy.at(-1)!)
        .slice(0, SHOWN);
  const narrow = width > 0 && width < 640;
  const H = narrow ? 280 : 440;
  const gutter = narrow ? 8 : 260;
  const PL = 56;
  const PT = 12;
  const PB = 28;

  let chart: null | {
    grid: { y: number; label: string }[];
    years: { x: number; label: string }[];
    lines: { id: string; name: string; d: string; y: number; ret: number }[];
    bench: { d: string; y: number; ret: number };
    labelY: Map<string, number>;
  } = null;

  if (width > 0 && ready.length > 0) {
    const ref = ready[0].backtest;
    const t0 = Math.min(...ready.map((r) => Date.parse(r.backtest.series.dates[0])));
    const t1 = Math.max(...ready.map((r) => Date.parse(r.backtest.series.dates.at(-1)!)));
    const X = (d: string) => PL + ((Date.parse(d) - t0) / (t1 - t0 || 1)) * (width - PL - gutter);
    const benchVals = ref.series.benchmark.filter((v): v is number => v != null);
    const vals = [...ready.flatMap((r) => r.backtest.series.strategy), ...benchVals];
    const min = Math.min(...vals) * 0.96;
    const max = Math.max(...vals) * 1.02;
    const log = needsLog(min, max);
    const f = (v: number) => (log ? Math.log(v) : v);
    const lo = f(min);
    const hi = f(max);
    const Y = (v: number) => PT + (1 - (f(v) - lo) / (hi - lo)) * (H - PT - PB);
    const path = (dates: string[], vs: (number | null)[]) => {
      let d = "";
      let pen = false;
      vs.forEach((v, i) => {
        if (v == null) {
          pen = false;
          return;
        }
        d += `${pen ? "L" : "M"}${X(dates[i]).toFixed(1)} ${Y(v).toFixed(1)}`;
        pen = true;
      });
      return d;
    };

    const lines = ready.map((r) => {
      const s = r.backtest.series.strategy;
      return { id: r.template.id, name: r.template.name, d: path(r.backtest.series.dates, s), y: Y(s.at(-1)!), ret: s.at(-1)! / 100 - 1 };
    });
    const lastBench = benchVals.at(-1) ?? 100;
    const bench = { d: path(ref.series.dates, ref.series.benchmark), y: Y(lastBench), ret: lastBench / 100 - 1 };

    // Keep end labels from colliding: sort by position, push apart, then
    // pull back up if the stack ran off the bottom.
    const GAP = 24;
    const stack = [...lines.map((l) => ({ key: l.id, y: l.y })), { key: "SPY", y: bench.y }].sort((a, b) => a.y - b.y);
    for (let i = 1; i < stack.length; i++) stack[i].y = Math.max(stack[i].y, stack[i - 1].y + GAP);
    const floor = H - 10;
    for (let i = stack.length - 1; i >= 0; i--) stack[i].y = Math.min(stack[i].y, i === stack.length - 1 ? floor : stack[i + 1].y - GAP);
    const labelY = new Map(stack.map((s) => [s.key, s.y]));

    // Return decades on a log axis; every 50 or 100 points on a linear one.
    let ticks: number[] = [];
    if (log) {
      ticks = logTicks(min, max);
    } else {
      const step = (max - min) / 100 > 2.4 ? 100 : 50;
      for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(v);
    }
    const grid = ticks.map((v) => ({ y: Y(v), label: axisPct(v / 100 - 1) }));

    const years: { x: number; label: string }[] = [];
    for (let y = new Date(t0).getUTCFullYear() + 1; Date.UTC(y, 0, 1) <= t1; y++) {
      years.push({ x: X(`${y}-01-01`), label: String(y) });
    }
    chart = { grid, years, lines, bench, labelY };
  }

  const opacity = (id: string) => (active == null ? 0.72 : active === id ? 1 : 0.14);

  return (
    <div>
      <div ref={wrap} className="relative" style={{ height: H }}>
        {chart ? (
          <>
            <svg width={width} height={H} role="img" aria-label="Five-year simulated growth of the strongest Brighter strategies against the S&P 500" className="block">
              {chart.grid.map((g) => (
                <g key={g.label}>
                  <line x1={PL} x2={width - gutter} y1={g.y} y2={g.y} stroke="var(--color-surface-border)" />
                  <text x={PL - 10} y={g.y + 4} textAnchor="end" fontSize={12} fill="var(--color-text-muted)" fontFamily="var(--font-mono)">
                    {g.label}
                  </text>
                </g>
              ))}
              {chart.years.map((y) => (
                <text key={y.label} x={y.x} y={H - 6} textAnchor="middle" fontSize={12} fill="var(--color-text-muted)" fontFamily="var(--font-mono)">
                  {y.label}
                </text>
              ))}
              <path d={chart.bench.d} className="line-fade" fill="none" stroke="var(--color-text-muted)" strokeWidth={1.5} strokeDasharray="4 4" opacity={active ? 0.5 : 1} />
              {chart.lines.map((l, i) => (
                <path
                  key={l.id}
                  d={l.d}
                  pathLength={1}
                  className="line-draw"
                  style={{ animationDelay: `${0.15 + i * 0.12}s`, transition: "opacity .15s, stroke-width .15s" }}
                  fill="none"
                  stroke={ICE}
                  strokeWidth={active === l.id ? 2.5 : 1.6}
                  strokeLinejoin="round"
                  opacity={opacity(l.id)}
                />
              ))}
              {chart.lines.map((l) => (
                <path
                  key={`hit-${l.id}`}
                  d={l.d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={14}
                  className="cursor-pointer"
                  onMouseEnter={() => setActive(l.id)}
                  onMouseLeave={() => setActive(null)}
                  onClick={() => navigate(`/strategies/${l.id}`)}
                />
              ))}
            </svg>
            {!narrow && (
              <div className="absolute inset-y-0 right-0" style={{ width: gutter - 12 }}>
                {chart.lines.map((l) => (
                  <Link
                    key={l.id}
                    to={`/strategies/${l.id}`}
                    onMouseEnter={() => setActive(l.id)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(l.id)}
                    onBlur={() => setActive(null)}
                    className="absolute left-0 flex w-full items-baseline justify-between gap-2 text-base transition-colors"
                    style={{ top: chart.labelY.get(l.id)! - 12, color: active == null || active === l.id ? "var(--color-text-primary)" : "var(--color-text-muted)" }}
                  >
                    <span className="truncate">{l.name}</span>
                    <span className="font-mono text-sm tabular-nums" style={{ color: ICE }}>
                      {pct(l.ret)}
                    </span>
                  </Link>
                ))}
                <span className="absolute left-0 flex w-full items-baseline justify-between gap-2 text-base text-text-muted" style={{ top: chart.labelY.get("SPY")! - 12 }}>
                  <span>S&P 500</span>
                  <span className="font-mono text-sm tabular-nums">{pct(chart.bench.ret)}</span>
                </span>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full items-center text-base text-text-muted">Loading five years of results…</div>
        )}
      </div>
      {narrow && chart && (
        <ul className="mt-4 divide-y divide-surface-border border-t border-surface-border">
          {chart.lines.map((l) => (
            <li key={l.id}>
              <Link to={`/strategies/${l.id}`} className="flex items-baseline justify-between py-3 text-base">
                <span>{l.name}</span>
                <span className="font-mono text-sm tabular-nums" style={{ color: ICE }}>
                  {pct(l.ret)}
                </span>
              </Link>
            </li>
          ))}
          <li className="flex items-baseline justify-between py-3 text-base text-text-muted">
            <span>S&P 500</span>
            <span className="font-mono text-sm tabular-nums">{pct(chart.bench.ret)}</span>
          </li>
        </ul>
      )}
    </div>
  );
};

/* ── How it works ─────────────────────────────────────────────────────── */

const Steps: FC = () => (
  <section id="how" className="border-t border-surface-border">
    <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <h2 className="max-w-xl font-display text-3xl font-bold sm:text-4xl">From rule to portfolio in three steps.</h2>
      <ol className="mt-12 grid border-t border-surface-border md:grid-cols-3 md:divide-x md:divide-surface-border">
        <Step n={1} title="Choose a rule" color={PROUD.yellow}>
          Seven strategies, each one plain rule: momentum, trend, volatility, dip-buying or risk-off. Adjust its settings and
          see five years of results straight away.
        </Step>
        <Step n={2} title="Sign once" color={PROUD.cyan}>
          Your wallet creates a portfolio: a smart account onchain that only you can withdraw from.
        </Step>
        <Step n={3} title="Fund your portfolio" color={PROUD.pink}>
          Add funds to your portfolio. Brighter invests according to your strategy and rebalances as its rules change
          the allocation.
        </Step>
      </ol>
    </div>
  </section>
);

const Step: FC<{ n: number; title: string; color: string; children: React.ReactNode }> = ({ n, title, color, children }) => (
  <li className="proud border-b border-surface-border px-6 py-8 md:border-b-0 md:px-8" style={fill(color)}>
    <span className="font-mono text-base text-brand">{n}</span>
    <h3 className="mt-3 text-xl font-semibold">{title}</h3>
    <p className="mt-2 text-base leading-relaxed text-text-secondary">{children}</p>
  </li>
);

/* ── What you own ─────────────────────────────────────────────────────── */

const Ownership: FC<{ rows: Row[] }> = ({ rows }) => {
  const circleSize = 30;
  const assetsRef = useRef<HTMLDivElement>(null);
  const assetsWidth = useElementWidth(assetsRef);
  const assets = new Map<string, { icon: string; symbol: string; name: string }>();
  for (const r of rows) for (const a of r.template.assets) assets.set(a.ticker, { icon: a.icon, symbol: a.ondoSymbol, name: a.name });
  // Fit the available width and reserve the last cell of four rows for dots.
  const columns = Math.max(1, Math.floor((assetsWidth + 20) / (96 + 20)));
  const shownAssets = [...assets.entries()].slice(0, columns * 4 - 1);
  const facts: [string, string, string][] = [
    ["Tokenized US stocks", "Your portfolio holds tokenized stocks and ETFs selected by your strategy.", PROUD.lime],
    ["An account only you control", "Your portfolio sits in a smart account your wallet owns. Brighter can rebalance it; only you can take money out.", PROUD.cyan],
    ["Leave whenever you like", "Sell your positions or withdraw the tokens themselves, with one signature.", PROUD.pink],
  ];
  return (
    <section className="border-t border-surface-border">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
        <div>
          <h2 className="font-display text-3xl font-bold sm:text-4xl">What you actually own.</h2>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-text-secondary">
            Real exposure to the companies and funds each rule picks, held in your wallet, not on a broker's books.
          </p>
          <div ref={assetsRef} className="mt-8 grid gap-x-5 gap-y-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {shownAssets.map(([ticker, a]) => (
              <Link key={ticker} to={`/assets/${ticker}`} className="group flex min-w-0 items-center gap-2" title={a.name}>
                <span className="transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-110">
                  <AssetLogo src={a.icon} symbol={tokenSymbol(a.symbol)} size={circleSize} />
                </span>
                <span className="truncate font-mono text-sm text-text-secondary transition-colors group-hover:text-text-primary">{tokenSymbol(a.symbol)}</span>
              </Link>
            ))}
            {assets.size > 0 && <span role="img" aria-label="More tokenized stocks and ETFs" style={{ width: circleSize, height: circleSize }} className="grid shrink-0 self-center place-items-center rounded-full bg-surface-2 text-text-secondary">
              <svg aria-hidden width={18} height={18} viewBox="0 0 24 24" fill="currentColor"><circle cx={5} cy={12} r={1.5} /><circle cx={12} cy={12} r={1.5} /><circle cx={19} cy={12} r={1.5} /></svg>
            </span>}
          </div>
        </div>
        <dl>
          {facts.map(([title, body, color]) => (
            <div key={title} className="proud proud-x grid gap-1 px-4 py-5 sm:grid-cols-[240px_minmax(0,1fr)] sm:gap-6" style={fill(color)}>
              <dt className="text-lg font-semibold">{title}</dt>
              <dd className="text-base leading-relaxed text-text-secondary">{body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};

/* ── Closer ───────────────────────────────────────────────────────────── */

const Closer: FC = () => (
  <section className="border-t border-surface-border">
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-24 sm:px-8 md:flex-row md:items-end md:justify-between">
      <h2 className="proud-text font-display font-bold" style={{ fontSize: "clamp(40px, 6vw, 72px)", lineHeight: 0.98, letterSpacing: "-0.035em" }}>
        Start with one rule.
      </h2>
      <Link to="/strategies" className={`${CTA} self-start px-7 py-4 text-base md:self-auto`}>
        Explore strategies
      </Link>
    </div>
  </section>
);
