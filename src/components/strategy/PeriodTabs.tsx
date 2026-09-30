import type { FC } from "react";
import { periodLabel } from "@/lib/format";
import { PERIODS, type Period } from "@/lib/catalogueFilters";
import { CHIP_BASE, CHIP_OFF, CHIP_ON } from "@/components/ui/chipStyles";

/**
 * The window every figure on the list covers. It sits in the filter row and
 * reads like the filters beside it — same height, same size, same accent when
 * chosen — rather than like the tabs above a chart, which mark a position in
 * a series rather than a choice among filters.
 *
 * Only periods the backend keeps warm are offered; a cold one would fan a
 * backtest engine call out across the whole catalogue.
 */
export const PeriodTabs: FC<{ value: Period; onChange: (period: Period) => void }> = ({ value, onChange }) => (
  <div className="flex items-center gap-4" role="tablist" aria-label="Period">
    {PERIODS.map((period) => (
      <button
        key={period}
        type="button"
        role="tab"
        aria-selected={period === value}
        title={`${periodLabel(period)} backtest`}
        onClick={() => onChange(period)}
        className={`${CHIP_BASE} ${period === value ? CHIP_ON : CHIP_OFF}`}
      >
        {period.toUpperCase()}
      </button>
    ))}
  </div>
);
