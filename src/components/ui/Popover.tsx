import { type FC, type ReactNode, useEffect, useId, useRef, useState } from "react";

/**
 * A panel that hangs off a button and closes when you look away. The chain
 * switcher and the strategy filters both want one, so the click-outside
 * listener, the Escape key and the panel's shell live here once.
 *
 * `trigger` is given the state it needs to describe itself, so a caller can
 * label its own button without also owning the open/closed logic.
 */
export const Popover: FC<{
  /** The button. `props` carries the accessibility state it must spread. */
  trigger: (props: { open: boolean; onClick: () => void; "aria-haspopup": "listbox"; "aria-expanded": boolean; "aria-controls": string }) => ReactNode;
  children: ReactNode;
  label: string;
  align?: "left" | "right";
  /** Panel width in rem-ish Tailwind terms, e.g. "w-60". */
  width?: string;
  /** Multi-select lists say so; a single-choice list leaves it off. */
  multi?: boolean;
}> = ({ trigger, children, label, align = "right", width = "w-60", multi }) => {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    // Escape closes and hands focus back, which a click outside cannot do.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      wrap.current?.querySelector("button")?.focus();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      {trigger({ open, onClick: () => setOpen((o) => !o), "aria-haspopup": "listbox", "aria-expanded": open, "aria-controls": id })}
      {open && (
        <div
          id={id}
          role="listbox"
          aria-label={label}
          aria-multiselectable={multi}
          className={`fade-in absolute ${align === "right" ? "right-0" : "left-0"} top-11 z-50 ${width} rounded-xl border border-surface-border bg-surface-0 p-1.5 shadow-lg`}
        >
          {children}
        </div>
      )}
    </div>
  );
};
