import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigationType } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { ApiError } from "@/api/client";
import { Layout } from "@/components/layout/Layout";
import { RequireWallet } from "@/components/wallet/RequireWallet";
import { ToastViewport } from "@/components/ToastViewport";
import { Landing } from "@/pages/Landing";
// The list ships with the app rather than as its own download. It is the page
// most visits open, and its cards draw from this browser's copy on the first
// frame — which a chunk that has not arrived yet cannot do.
import { Strategies } from "@/pages/Strategies";
import {
  AssetDetail,
  DepositPage,
  HowItWorks,
  PortfolioPage,
  Portfolios,
  Settings,
  StrategyDetail,
  WithdrawPage,
} from "@/pages/lazy";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 4xx is an answer, not a blip — retrying it only delays the message.
      retry: (count, err) => !(err instanceof ApiError && err.status < 500 && err.status !== 429) && count < 2,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * A new page opens at the top. Back and forward keep the browser's own
 * behaviour, and a change to the query alone (a strategy's sliders) keeps the
 * reader's place.
 */
function ScrollToTop() {
  const { pathname } = useLocation();
  const type = useNavigationType();
  useEffect(() => {
    if (type !== "POP") window.scrollTo(0, 0);
  }, [pathname, type]);
  return null;
}

export default function App() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            <Route index element={<Landing />} />
            <Route element={<Layout />}>
              <Route path="strategies" element={<Strategies />} />
              <Route path="strategies/:id" element={<StrategyDetail />} />
              <Route path="portfolios" element={<Portfolios />} />
              <Route path="portfolios/:id" element={<PortfolioPage />} />
              <Route path="portfolios/:id/deposit/:method?" element={<RequireWallet><DepositPage /></RequireWallet>} />
              <Route path="portfolios/:id/withdraw" element={<RequireWallet><WithdrawPage /></RequireWallet>} />
              <Route path="assets/:ticker" element={<AssetDetail />} />
              <Route path="how-it-works" element={<HowItWorks />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <ToastViewport />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
