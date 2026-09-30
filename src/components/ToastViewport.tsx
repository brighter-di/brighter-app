import { type FC, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { subscribe, dismissToast, type Toast } from "@/lib/toast";

const COLORS: Record<Toast["variant"], { bg: string; fg: string; border: string }> = {
  error: { bg: "rgba(255, 59, 48, 0.10)", fg: "var(--color-danger)", border: "rgba(255, 59, 48, 0.25)" },
  info: { bg: "var(--color-surface-1)", fg: "var(--color-text-primary)", border: "var(--color-surface-border)" },
  success: { bg: "rgba(0, 179, 65, 0.10)", fg: "var(--color-success)", border: "rgba(0, 179, 65, 0.25)" },
};

export const ToastViewport: FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => subscribe(setToasts), []);

  if (toasts.length === 0) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: "min(360px, calc(100vw - 32px))",
        fontFamily: "YS Text, -apple-system, sans-serif",
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => {
        const c = COLORS[t.variant];
        return (
          <div
            key={t.id}
            style={{
              pointerEvents: "auto",
              background: "var(--color-surface-0)",
              border: `1px solid ${c.border}`,
              borderLeft: `3px solid ${c.fg}`,
              borderRadius: 8,
              padding: "10px 12px",
              boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              animation: "bt-slide-in 160ms ease-out",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: c.fg, marginBottom: t.body || t.href ? 2 : 0 }}>{t.title}</div>
              {t.body && (
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)", lineHeight: 1.4, overflowWrap: "break-word" }}>
                  {t.body}
                </div>
              )}
              {t.href && (
                <a
                  href={t.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 11, color: "var(--color-accent)", textDecoration: "underline", marginTop: 4, display: "inline-block" }}
                >
                  {t.hrefLabel ?? "Open"}
                </a>
              )}
            </div>
            <button
              onClick={() => dismissToast(t.id)}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-text-muted)",
                padding: 0,
                fontSize: 16,
                lineHeight: 1,
                marginTop: -2,
              }}
              aria-label="Dismiss"
            >
              ×
            </button>
          </div>
        );
      })}
      <style>{`@keyframes bt-slide-in { from { transform: translateX(8px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }`}</style>
    </div>,
    document.body,
  );
};
