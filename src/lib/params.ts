// Parameter grid handling, mirroring the backend's coercion so the URL, the
// sliders and the server always agree on which strategy is meant.

import type { Params, Template } from "@/api/client";

export function coerceParams(t: Template, get: (key: string) => string | null | undefined): Params {
  const out: Params = {};
  for (const s of t.params) {
    const raw = get(s.key);
    const v = raw == null || raw === "" ? NaN : Number(raw);
    if (!Number.isFinite(v)) {
      out[s.key] = s.default;
      continue;
    }
    const anchor = t.publishedAt ? s.default : 0;
    const delta = (v - anchor) / s.step;
    const nearest = t.publishedAt ? Math.sign(delta) * Math.round(Math.abs(delta)) : Math.round(delta);
    const snapped = t.publishedAt && v === s.default ? s.default : Number((anchor + nearest * s.step).toPrecision(15));
    out[s.key] = Math.min(s.max, Math.max(s.min, snapped));
  }
  return out;
}

/** Canonical identity, identical to the backend's: "lookback=126,count=3". */
export function paramsKey(t: Template, p: Params): string {
  return t.params.map((s) => `${s.key}=${p[s.key]}`).join(",");
}

/** Short label: "126d · 3". */
export function paramsLabel(t: Template, p: Params): string {
  return t.params.map((s) => `${p[s.key]}${s.unit}`).join(" · ");
}

export function isDefault(t: Template, p: Params): boolean {
  return t.params.every((s) => p[s.key] === s.default);
}

/** Query string for a strategy link. */
export function paramsSearch(t: Template, p: Params): string {
  if (isDefault(t, p)) return "";
  const q = new URLSearchParams();
  for (const s of t.params) q.set(s.key, String(p[s.key]));
  return `?${q.toString()}`;
}

/** Plain-language rules for each template, with the chosen parameters. */
export function describeRules(t: Template, p: Params): string[] {
  switch (t.id) {
    case "mag7-rank":
      return [
        `Rank the Magnificent 7 by total return over the last ${p.lookback} trading days.`,
        `Hold the top ${p.count}, equally weighted.`,
        "Re-rank once a month.",
      ];
    case "rsi-riskoff":
      return [
        `Compute the ${p.lookback}-day RSI of the S&P 500 (SPY).`,
        `If RSI is above ${p.threshold}, the market is overbought: move 100% into T-bills.`,
        "Otherwise hold all seven Mag7 names in equal weight.",
        "Checked every trading day.",
      ];
    case "dual-momentum":
      return [
        `Compare the total return of the Nasdaq-100 (QQQ) and the S&P 500 (SPY) over ${p.lookback} trading days.`,
        "Hold the stronger one — but only if it also beat T-bills over the same window.",
        "If neither beats T-bills, hold T-bills.",
        "Checked once a month.",
      ];
    case "inv-vol":
      return [
        "Hold all seven Mag7 names.",
        `Weight each by the inverse of its realised volatility over ${p.lookback} trading days — calmer names get more.`,
        "Reweighted once a month.",
      ];
    case "trend-filter":
      return [
        "Split the portfolio into seven equal sleeves, one per Mag7 name.",
        `A sleeve holds its stock only while the price is above its ${p.lookback}-day moving average; otherwise it holds T-bills.`,
        "Checked once a week.",
      ];
    case "golden-cross":
      return [
        `Compare the ${p.fast}-day and ${p.slow}-day moving averages of the Nasdaq-100 (QQQ).`,
        "While the fast average is above the slow one, hold QQQ.",
        "Otherwise hold T-bills.",
        "Checked every trading day.",
      ];
    case "global-rotation":
      return [
        `Rank seven asset classes by total return over the last ${p.lookback} trading days: US large caps, small caps, developed and emerging markets, long Treasuries, gold and T-bills.`,
        `Hold the top ${p.count}, equally weighted. When T-bills rank among them, that share sits in cash.`,
        "Re-rank once a month.",
      ];
    case "all-weather":
      return [
        "Hold US stocks, long and intermediate Treasuries, gold and commodities.",
        `Weight each by the inverse of its volatility over ${p.lookback} trading days, so each carries a similar share of the risk.`,
        "Reweighted once a month.",
      ];
    case "low-vol":
      return [
        `Measure the volatility of thirteen US blue chips over the last ${p.lookback} trading days.`,
        `Hold the ${p.count} calmest, equally weighted.`,
        "Re-rank once a month.",
      ];
    case "oversold-rebound":
      return [
        "Check whether the S&P 500 (SPY) is above its 200-day moving average.",
        `If it is, hold the ${p.count} Mag7 names with the lowest ${p.lookback}-day RSI, equally weighted.`,
        "If it is not, hold T-bills.",
        "Checked every trading day.",
      ];
    case "semis-switch":
      return [
        `Compare the ${p.window}-day RSI of bonds (BND) with that of high-beta stocks (SPHB).`,
        "When bonds lead, hold 3× semiconductors (SOXL) — unless chips (SOXX) are overbought or volatility is climbing, then T-bills. A full volatility spike buys SOXL anyway.",
        `When high-beta stocks lead, hold SOXL only after a sharp drop (its RSI below ${p.oversold}); otherwise T-bills.`,
        "Checked every trading day.",
      ];
    case "tech-trend-switch":
      return [
        `If any of eleven US market gauges is overbought (10-day RSI above about ${p.overbought}), hedge with 3× inverse Nasdaq (SQQQ).`,
        `After a sharp drop (RSI below ${p.oversold}), buy the dip in 3× Nasdaq (TQQQ) or 3× semiconductors (SOXL). A biotech crash moves it to T-bills.`,
        "Otherwise compare tech (XLK) with a trend-following fund (KMLM). When tech leads, hold the two least stretched of TQQQ, SOXL and QQQ; when trend leads, the stronger of SQQQ and long Treasuries (TLT).",
        "Checked every trading day.",
      ];
    case "frontrunner":
      return [
        `If the S&P 500, global large caps, 3× Nasdaq, value stocks or banks are overbought (10-day RSI above ${p.overbought}), hold T-bills.`,
        `After a sharp drop in the Nasdaq or the S&P 500 (RSI below ${p.oversold}), buy 3× Nasdaq (TQQQ).`,
        "Above the S&P 500's 200-day average, hold 3× Nasdaq and 3× semiconductors while tech leads a trend-following fund (KMLM) or that fund is falling; their 3× inverse funds otherwise.",
        "Below it, split between two hedging rules that pick among the Nasdaq-100, inverse Nasdaq funds and T-bills.",
        "Checked every trading day.",
      ];
  }
  return [t.thesis];
}
