import type { FC } from "react";
import { Link, NavLink } from "react-router-dom";
import { ConnectButton } from "@/components/wallet/ConnectButton";

const linkClass = "text-sm transition-colors text-text-secondary hover:text-text-primary";
const navClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm transition-colors ${isActive ? "font-medium text-text-primary" : "text-text-secondary hover:text-text-primary"}`;

export const Header: FC = () => (
  <header className="sticky top-0 z-40 border-b border-surface-border bg-surface-0/90 backdrop-blur">
    <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:gap-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-4 sm:gap-6">
        <Link to="/" aria-label="Brighter home" className="flex shrink-0 items-center gap-2">
          <img src="/logo-b.svg" alt="" aria-hidden width={22} height={27} className="h-6 w-auto" />
          {/* On phones the mark alone leaves room for the nav and the wallet. */}
          <span className="hidden font-display text-lg font-semibold text-text-primary sm:inline">Brighter</span>
        </Link>
        <nav className="flex items-center gap-4 sm:gap-5">
          <NavLink to="/strategies" className={navClass}>
            Strategies
          </NavLink>
          <NavLink to="/portfolios" className={navClass}>
            Portfolios
          </NavLink>
          {/* Studio is its own app, so a plain same-tab link rather than a route. */}
          <a href="https://studio.brighter.fi" className={linkClass}>
            Studio
          </a>
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <ConnectButton />
      </div>
    </div>
  </header>
);
