import type { Range } from "@/api/client";

/**
 * The 1Y / 3Y / … switch above a performance chart, and the 1Y / 5Y one over
 * the strategy list. Generic over the ranges it is given, so a caller offering
 * two of them gets a callback narrowed to those two.
 */
export const RangeTabs = <T extends Range>({
  ranges,
  value,
  onChange,
  label = "Range",
}: {
  ranges: readonly T[];
  value: T;
  onChange: (range: T) => void;
  label?: string;
}) => (
  <div className="flex gap-4" role="tablist" aria-label={label}>
    {ranges.map((r) => (
      <button
        key={r}
        type="button"
        role="tab"
        aria-selected={r === value}
        onClick={() => onChange(r)}
        className={`border-b-2 pb-0.5 font-mono text-xs font-semibold transition-colors ${
          r === value ? "border-text-primary text-text-primary" : "border-transparent text-text-muted hover:text-text-primary"
        }`}
      >
        {r.toUpperCase()}
      </button>
    ))}
  </div>
);
