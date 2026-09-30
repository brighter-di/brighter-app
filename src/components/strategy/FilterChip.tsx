import type { FC, ReactNode } from "react";
import { CHIP_BASE, CHIP_OFF, CHIP_ON } from "@/components/ui/chipStyles";

// A filter is something you switch on, so it is a button that says whether it
// is pressed. Nothing encloses or underlines it: the whole row sits above one
// rule, and a filter that is on simply takes the accent.

const BASE = CHIP_BASE;
const OFF = CHIP_OFF;
const ON = CHIP_ON;

const Chevron: FC = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden className="opacity-60">
    <path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** A filter that is simply on or off. */
export const ToggleChip: FC<{ active: boolean; onClick: () => void; children: ReactNode; title?: string }> = ({ active, onClick, children, title }) => (
  <button type="button" aria-pressed={active} onClick={onClick} title={title} className={`${BASE} ${active ? ON : OFF}`}>
    {children}
  </button>
);

/**
 * A filter that opens a list. The count rides in the label so the button says
 * what it is doing without the panel being open.
 */
export const MenuChip: FC<{
  label: string;
  count: number;
  props: { onClick: () => void; "aria-haspopup": "listbox"; "aria-expanded": boolean; "aria-controls": string };
}> = ({ label, count, props }) => (
  <button type="button" {...props} className={`${BASE} ${count > 0 ? ON : OFF}`}>
    {label}
    {count > 0 && <span className="tabular-nums">· {count}</span>}
    <Chevron />
  </button>
);
