import { type FC, type ReactNode, useId, useState } from "react";

/**
 * Shows secondary information while its trigger is hovered or focused. Inside
 * a link or button pass focusable={false}: the parent already takes focus.
 */
export const Tooltip: FC<{ content: ReactNode; children: ReactNode; align?: "left" | "right"; focusable?: boolean }> = ({
  content,
  children,
  align = "left",
  focusable = true,
}) => {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span
        tabIndex={focusable ? 0 : undefined}
        aria-describedby={id}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex cursor-help rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {children}
      </span>
      <span
        id={id}
        role="tooltip"
        hidden={!open}
        className={`absolute top-full z-50 mt-2 w-72 whitespace-normal bg-surface-0 p-3 text-left font-sans text-xs font-normal normal-case leading-relaxed tracking-normal text-text-secondary shadow-[0_12px_40px_-8px_rgba(0,0,0,0.35)] ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        {content}
      </span>
    </span>
  );
};

/** A "?" that reveals an explanation on hover or focus. */
export const InfoTip: FC<{ body: string; align?: "left" | "right" }> = ({ body, align = "right" }) => (
  <Tooltip content={body} align={align}>
    <span aria-label={body} className="inline-grid h-3.5 w-3.5 place-items-center rounded-full bg-surface-2 text-[9px] font-bold leading-none text-text-muted">
      ?
    </span>
  </Tooltip>
);
