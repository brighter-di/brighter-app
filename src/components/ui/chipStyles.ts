// The one look a row of choices shares — the strategy filters, the portfolio
// tabs: no box and no rule of its own. The row sits above a single separator,
// and whatever is on takes the accent. Kept out of the component files so any
// of them can import it without a module exporting more than its components.

export const CHIP_BASE = "flex h-9 shrink-0 items-center gap-1.5 text-sm transition-colors";
export const CHIP_OFF = "text-text-secondary hover:text-text-primary";
export const CHIP_ON = "font-medium text-accent";
