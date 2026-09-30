import type { FC } from "react";

// Official marks, inlined so they never 404 and render crisply at any size.
const MARKS: Record<number, { color: string; path: string; label: string }> = {
  56: {
    label: "BNB Chain",
    color: "#F0B90B",
    path: "M16.624 13.9202l2.7175 2.7154-7.353 7.353-7.353-7.352 2.7175-2.7164 4.6355 4.6595 4.6356-4.6595zm4.6366-4.6366L24 12l-2.7154 2.7164L18.5682 12l2.6924-2.7164zm-9.272.001l2.7163 2.6914-2.7164 2.7174v-.001L9.2721 12l2.7164-2.7154zm-9.2722-.001L5.4088 12l-2.6914 2.6924L0 12l2.7164-2.7164zM11.9885.0115l7.353 7.329-2.7174 2.7154-4.6356-4.6356-4.6355 4.6595-2.7174-2.7154 7.353-7.353z",
  },
  1: {
    label: "Ethereum",
    color: "#627EEA",
    path: "M11.944 17.97L4.58 13.62 11.943 24l7.37-10.38-7.372 4.35h.003zM12.056 0L4.69 12.223l7.365 4.354 7.365-4.35L12.056 0z",
  },
  // Chains still to come carry a plain silhouette in their own colour, each
  // distinct at 16px, rather than a copy of their wordmark.
  8453: { label: "Base", color: "#0052FF", path: "M12 2.4a9.6 9.6 0 1 0 0 19.2 9.6 9.6 0 0 0 0-19.2z" },
  42161: { label: "Arbitrum One", color: "#28A0F0", path: "M12 2.2l8.49 4.9v9.8L12 21.8l-8.49-4.9V7.1z" },
  137: { label: "Polygon", color: "#8247E5", path: "M12 2.4L21.6 12 12 21.6 2.4 12z" },
};

export const ChainLogo: FC<{ chainId: number | undefined; size?: number; className?: string }> = ({ chainId, size = 14, className = "" }) => {
  const m = chainId != null ? MARKS[chainId] : undefined;
  if (!m) {
    return <span aria-hidden style={{ width: size, height: size }} className={`inline-block shrink-0 rounded-full bg-surface-3 ${className}`} />;
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className={`shrink-0 ${className}`}>
      <path d={m.path} fill={m.color} />
    </svg>
  );
};

/** Chain logo followed by its name. */
export const ChainName: FC<{ chainId: number | undefined; name: string; size?: number; className?: string }> = ({ chainId, name, size = 14, className = "" }) => (
  <span className={`inline-flex items-center gap-1.5 ${className}`}>
    <ChainLogo chainId={chainId} size={size} />
    {name}
  </span>
);
