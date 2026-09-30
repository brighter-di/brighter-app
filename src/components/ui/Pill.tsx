import type { FC, ReactNode } from "react";

type Tone = "neutral" | "success" | "danger" | "warn" | "accent";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-text-secondary",
  success: "bg-success/12 text-success",
  danger: "bg-danger/12 text-danger",
  warn: "bg-warn-dim text-warn",
  accent: "bg-accent/10 text-accent",
};

export const Pill: FC<{ tone?: Tone; children: ReactNode; title?: string; mono?: boolean }> = ({ tone = "neutral", children, title, mono }) => (
  <span
    title={title}
    className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
      mono ? "font-mono tracking-tight" : ""
    } ${TONES[tone]}`}
  >
    {children}
  </span>
);
