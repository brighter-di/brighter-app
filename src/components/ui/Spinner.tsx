import type { FC } from "react";

// Generic loading spinner. Replaces ~12 inline copies of the same
// `animate-spin rounded-full border-2 border-text-muted border-t-text-primary`
// recipe. Picks a tone based on the `tone` prop so it can be dropped onto
// solid CTAs (where border-text-primary would be invisible against a dark
// button) without per-site overrides.

const SIZES = {
  xs: "h-3 w-3 border-2",
  sm: "h-3.5 w-3.5 border-2",
  md: "h-4 w-4 border-2",
  lg: "h-5 w-5 border-2",
  xl: "h-8 w-8 border-2",
} as const;

const TONES = {
  // Default — for use on page backgrounds (surface-0/1).
  default: "border-text-muted border-t-text-primary",
  // For use ON the primary CTA button (bg-text-primary, text-surface-0):
  // contrast against the dark fill.
  invert:  "border-current/30 border-t-current",
  // Muted gray, low-contrast — when the spinner shouldn't draw attention.
  muted:   "border-text-muted/40 border-t-text-muted",
  // Brighter brand yellow on transparent — for page-level full-screen
  // loading states (Markets, Leaderboard, Insights, TokenDetail).
  brand:   "border-brand border-t-transparent",
} as const;

export interface SpinnerProps {
  size?: keyof typeof SIZES;
  tone?: keyof typeof TONES;
  className?: string;
  label?: string;
}

export const Spinner: FC<SpinnerProps> = ({ size = "md", tone = "default", className = "", label }) => (
  <span
    className={`inline-block animate-spin rounded-full ${SIZES[size]} ${TONES[tone]} ${className}`}
    role="status"
    aria-label={label ?? "Loading"}
  />
);
