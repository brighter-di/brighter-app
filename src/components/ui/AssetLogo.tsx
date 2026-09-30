import { type FC, useState } from "react";

/** Round token logo from Ondo's CDN, falling back to initials. */
export const AssetLogo: FC<{ src?: string; symbol: string; size?: number; ring?: boolean }> = ({ src, symbol, size = 28, ring }) => {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  const ringCls = ring ? "ring-2 ring-surface-0" : "";
  if (!src || failed) {
    return (
      <span
        aria-hidden
        style={{ ...style, fontSize: Math.max(8, size * 0.32) }}
        className={`grid shrink-0 place-items-center rounded-full bg-surface-2 font-bold text-text-secondary ${ringCls}`}
      >
        {symbol.replace(/on$/, "").slice(0, 3).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      style={style}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`shrink-0 rounded-full bg-surface-2 ${ringCls}`}
    />
  );
};

/** Overlapping stack of logos. */
export const LogoStack: FC<{ items: { src?: string; symbol: string }[]; size?: number; max?: number }> = ({ items, size = 22, max = 7 }) => {
  const shown = items.slice(0, max);
  const extra = items.length - shown.length;
  return (
    <span className="flex -space-x-1.5">
      {shown.map((a) => (
        <AssetLogo key={a.symbol} src={a.src} symbol={a.symbol} size={size} ring />
      ))}
      {extra > 0 && (
        <span
          style={{ width: size, height: size }}
          className="grid place-items-center rounded-full bg-surface-2 text-[9px] font-semibold text-text-secondary ring-2 ring-surface-0"
        >
          +{extra}
        </span>
      )}
    </span>
  );
};
