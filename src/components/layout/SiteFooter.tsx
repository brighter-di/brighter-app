import type { FC } from "react";
import { Link } from "react-router-dom";

// The landing page's footer: a white band under the dark page, after 1inch's.
// Colours are fixed rather than themed, so it stays white whatever the theme.

export const SiteFooter: FC = () => (
  <footer className="bg-white text-[#1A1A1A]">
    <div className="mx-auto max-w-6xl px-5 pb-10 pt-16 sm:px-8">
      <div className="flex flex-wrap items-start justify-between gap-10">
        <div>
          <Link to="/" className="flex items-center gap-3 font-display text-2xl font-bold">
            <img src="/logo-b.svg" alt="" aria-hidden width={26} height={32} className="h-8 w-auto" />
            Brighter
          </Link>
          <p className="mt-4 max-w-sm text-lg leading-relaxed text-[#6B7280]">Rule-based portfolios of tokenized US stocks, held in a wallet you own.</p>
        </div>
        <nav className="flex flex-col items-start gap-3 text-lg font-semibold">
          <Link to="/how-it-works" className="transition-colors hover:text-[#6B7280]">
            How it works
          </Link>
          <a href="https://studio.brighter.fi" className="transition-colors hover:text-[#6B7280]">
            Studio
          </a>
        </nav>
      </div>
      <div className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-[#EEEFF2] pt-6 text-base text-[#6B7280]">
        <span>© 2026 Brighter</span>
        <a href="mailto:info@brighter.fi" className="transition-colors hover:text-[#1A1A1A]">
          info@brighter.fi
        </a>
      </div>
    </div>
  </footer>
);
