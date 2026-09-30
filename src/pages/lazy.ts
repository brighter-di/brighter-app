// Pages that load on demand. The landing page and the strategy list ship with
// the app; everything else is its own chunk. The loader lives here so the
// landing page can warm a strategy's own page before a visitor clicks into it.

import { lazy } from "react";

export const load = {
  strategyDetail: () => import("./StrategyDetail"),
};

export const StrategyDetail = lazy(() => load.strategyDetail().then((m) => ({ default: m.StrategyDetail })));
export const Portfolios = lazy(() => import("./Portfolios").then((m) => ({ default: m.Portfolios })));
export const PortfolioPage = lazy(() => import("./PortfolioPage").then((m) => ({ default: m.PortfolioPage })));
export const DepositPage = lazy(() => import("./DepositPage").then((m) => ({ default: m.DepositPage })));
export const WithdrawPage = lazy(() => import("./WithdrawPage").then((m) => ({ default: m.WithdrawPage })));
export const AssetDetail = lazy(() => import("./AssetDetail").then((m) => ({ default: m.AssetDetail })));
export const HowItWorks = lazy(() => import("./HowItWorks").then((m) => ({ default: m.HowItWorks })));
export const Settings = lazy(() => import("./Settings").then((m) => ({ default: m.Settings })));
