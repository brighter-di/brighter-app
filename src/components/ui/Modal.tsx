import { type FC, type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  /** Round the top and clear the home bar, for one that reads as a sheet on a phone. */
  sheet?: boolean;
}

export const Modal: FC<Props> = ({ title, onClose, children, width = 440, sheet }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`fade-in relative max-h-[90vh] w-full overflow-y-auto bg-surface-0 px-5 pb-6 shadow-2xl sm:px-6 ${sheet ? "rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:pb-6" : ""}`} style={{ maxWidth: width }}>
        <div className="mb-4 flex items-center justify-between gap-4 border-b border-surface-border py-4">
          <h2 className="font-display text-lg font-semibold text-text-primary">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center text-text-muted transition-colors hover:text-text-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
};
