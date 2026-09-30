import type { FC } from "react";

/** Marks the chosen row; selection is shown in text colour, never a background. */
export const Check: FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-accent" aria-hidden>
    <path d="m5 12 4 4L19 6" />
  </svg>
);

/** A search box in the app's underline style. */
export const SearchField: FC<{ value: string; onChange: (value: string) => void; placeholder: string; label: string }> = ({ value, onChange, placeholder, label }) => (
  <label className="mt-3 flex h-10 items-center gap-2 border-b border-surface-3 text-text-muted focus-within:border-text-primary">
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </svg>
    <input
      type="search"
      aria-label={label}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete="off"
      spellCheck={false}
      className="min-w-0 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
    />
  </label>
);
