import { type FC, useState } from "react";
import { shortAddr } from "@/lib/format";

/** A shortened address that opens the block explorer, with a copy button. */
export const Address: FC<{ address: string; explorer?: string; label?: string; className?: string; kind?: "address" | "token" }> = ({
  address,
  explorer,
  label,
  className = "",
  kind = "address",
}) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  };

  const text = <span className="font-mono text-[11px]">{shortAddr(address)}</span>;

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {label && <span className="text-[11px] text-text-muted">{label}</span>}
      {explorer ? (
        <a
          href={`${explorer}/${kind}/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          title="View on block explorer"
          className="inline-flex items-center gap-1 text-text-secondary transition-colors hover:text-accent"
        >
          {text}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M7 17 17 7M8 7h9v9" />
          </svg>
        </a>
      ) : (
        <span className="text-text-secondary">{text}</span>
      )}
      <button
        type="button"
        onClick={copy}
        aria-label="Copy address"
        title={copied ? "Copied" : "Copy address"}
        className="grid h-6 w-6 place-items-center text-text-muted transition-colors hover:text-text-primary"
      >
        {copied ? (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success" aria-hidden>
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </span>
  );
};
