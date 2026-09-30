import { type FC, Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Spinner } from "@/components/ui/Spinner";
import { Header } from "./Header";

export const Layout: FC = () => (
  <div className="flex min-h-screen flex-col bg-surface-0 font-sans">
    <Header />
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
      {/* Pages load on demand; the header stays put while one arrives. */}
      <Suspense fallback={<div className="flex min-h-48 items-center justify-center"><Spinner size="lg" /></div>}>
        <Outlet />
      </Suspense>
    </main>
    <footer className="border-t border-surface-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs leading-relaxed text-text-muted sm:px-6">
        <div className="flex items-center justify-between">
          <span>&copy; 2026 Brighter</span>
          <a href="mailto:info@brighter.fi" className="transition-colors hover:text-text-primary">
            info@brighter.fi
          </a>
        </div>
      </div>
    </footer>
  </div>
);
