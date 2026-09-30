import { type FC, type ReactNode, useId } from "react";
import { generatedMarkIndex } from "@/lib/glyph";

// One flat mark per strategy, drawn from what its rule does: a solid tile in
// the strategy's colour, the rule's whole field in translucent white, and the
// part the rule acts on — the winners it keeps, the zone that trips it — in
// solid white. No gradients, glows or shadows.
//
// Marks live here and nowhere else — the backend never names one. The
// templates Brighter ships have their own, drawn for the rule they run.
// Everything else — anything published from Studio — draws from a finite set
// of abstract marks below, picked by a hash of the strategy's id, so a
// strategy keeps the same mark on every page, in every browser, for good.
// The generated ones claim nothing about the rule: no threshold lines, no
// kept-and-dropped, nothing a reader could mistake for what it does.

const FULL = "#FFFFFF";
const HALF = "rgba(255,255,255,0.72)";
const FAINT = "rgba(255,255,255,0.42)";

interface Mark {
  color: string;
  draw: (uid: string) => ReactNode;
}

const MARKS: Record<string, Mark> = {
  // Rank seven names, keep the strongest three.
  "mag7-rank": {
    color: "#D97706",
    draw: () => {
      const heights = [8, 15, 11, 18, 6, 13, 9];
      const kept = new Set([3, 1, 5]);
      return heights.map((h, i) => (
        <rect key={i} x={4.4 + i * 3.4} y={25 - h} width={2.3} height={h} rx={1.15} fill={kept.has(i) ? FULL : FAINT} />
      ));
    },
  },

  // An oscillator; only the stretch above the threshold trips risk-off.
  "rsi-riskoff": {
    color: "#2563EB",
    draw: (uid) => {
      const wave = "M4 21c3 0 4-6 7-6s3 7 6 7 3-15 6-14 3 8 5 7";
      return (
        <>
          <defs>
            <clipPath id={`${uid}-above`}>
              <rect x="0" y="0" width="32" height="12" />
            </clipPath>
          </defs>
          <path d="M3 12h26" stroke={FAINT} strokeWidth={1.4} strokeDasharray="1.6 2.2" />
          <path d={wave} stroke={HALF} strokeWidth={2} />
          <path d={wave} stroke={FULL} strokeWidth={2.6} clipPath={`url(#${uid}-above)`} />
        </>
      );
    },
  },

  // Two contenders race from one start; the stronger is held if it beats
  // the T-bill baseline.
  "dual-momentum": {
    color: "#7C3AED",
    draw: () => (
      <>
        <path d="M4 23h24" stroke={FAINT} strokeWidth={1.4} strokeDasharray="1.6 2.2" />
        <path d="M4 19c6 0 9 1 13-1s7-1 11-1" stroke={HALF} strokeWidth={2} />
        <path d="M4 19c6 0 8-3 12-6s7-5 12-6" stroke={FULL} strokeWidth={2.6} />
        <circle cx="4" cy="19" r="1.9" fill={HALF} />
        <circle cx="28" cy="7" r="2.4" fill={FULL} />
      </>
    ),
  },

  // Seven unequal slices: the calmest names get the largest share.
  "inv-vol": {
    color: "#059669",
    draw: () => {
      const slices = [24, 18, 15, 13, 12, 10, 8];
      const fills = [FULL, HALF, HALF, FAINT, FAINT, FAINT, FAINT];
      let offset = 0;
      return slices.map((s, i) => {
        const el = (
          <circle
            key={i}
            cx="16"
            cy="16"
            r="9"
            pathLength={100}
            stroke={fills[i]}
            strokeWidth={4.6}
            strokeLinecap="butt"
            strokeDasharray={`${s - 2.6} ${100 - s + 2.6}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 16 16)"
          />
        );
        offset += s;
        return el;
      });
    },
  },

  // Price against its moving average; only the stretch above it is held.
  "trend-filter": {
    color: "#E11D48",
    draw: (uid) => {
      const price = "M4 24c4 0 5-6 9-7s4 4 7 3 5-10 8-12";
      return (
        <>
          <defs>
            <clipPath id={`${uid}-above`}>
              <polygon points="0,0 32,0 32,10.33 0,23.67" />
            </clipPath>
          </defs>
          <path d="M4 22L28 12" stroke={FAINT} strokeWidth={1.4} strokeDasharray="1.6 2.2" />
          <path d={price} stroke={HALF} strokeWidth={2} />
          <path d={price} stroke={FULL} strokeWidth={2.6} clipPath={`url(#${uid}-above)`} />
          <circle cx="28" cy="8" r="2.4" fill={FULL} />
        </>
      );
    },
  },

  // The fast average crosses up through the slow one; the cross is the signal.
  "golden-cross": {
    color: "#0891B2",
    draw: () => (
      <>
        <path d="M4 18c7-1 14-3 24-6" stroke={HALF} strokeWidth={2} />
        <path d="M4 24c4 0 7-2 10-6s8-9 14-11" stroke={FULL} strokeWidth={2.6} />
        <circle cx="16.4" cy="15.1" r="2.4" fill={FULL} />
      </>
    ),
  },

  // Seven asset classes on a wheel; the strongest two are held.
  "global-rotation": {
    color: "#C026D3",
    draw: () => (
      <>
        <circle cx="16" cy="16" r="8.5" stroke={FAINT} strokeWidth={1.4} strokeDasharray="1.6 2.2" />
        {Array.from({ length: 7 }, (_, i) => {
          const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
          const held = i < 2;
          return <circle key={i} cx={16 + 8.5 * Math.cos(a)} cy={16 + 8.5 * Math.sin(a)} r={held ? 2.7 : 1.7} fill={held ? FULL : HALF} />;
        })}
      </>
    ),
  },

  // Unlike weights, level beam: each asset carries an equal share of risk.
  "all-weather": {
    color: "#0F766E",
    draw: () => (
      <>
        <path d="M16 13l-4.5 11h9z" fill={FULL} />
        <path d="M4.5 12.5h23" stroke={FULL} strokeWidth={2.4} />
        <rect x="6" y="5" width="4.5" height="6.5" rx="1" fill={HALF} />
        <rect x="19" y="8" width="8" height="3.5" rx="1" fill={HALF} />
      </>
    ),
  },

  // Three price paths; only the calmest is kept.
  "low-vol": {
    color: "#65A30D",
    draw: () => (
      <>
        <path d="M4 9l3-3 3 5 3-6 3 6 3-4 3 5 3-3 3 2" stroke={FAINT} strokeWidth={1.6} />
        <path d="M4 16.5c2-2 4 2 6 0s4 2 6 0 4 2 6 0 4 2 6 0" stroke={HALF} strokeWidth={2} />
        <path d="M4 24c3-.8 5 .8 8 0s5 .8 8 0 5 .8 8 0" stroke={FULL} strokeWidth={2.6} />
      </>
    ),
  },

  // An oscillator; the dip below the line is what gets bought.
  "oversold-rebound": {
    color: "#4F46E5",
    draw: (uid) => {
      const wave = "M4 11c3 0 4 6 7 6s3-7 6-7 3 15 6 14 3-8 5-7";
      return (
        <>
          <defs>
            <clipPath id={`${uid}-below`}>
              <rect x="0" y="20" width="32" height="12" />
            </clipPath>
          </defs>
          <path d="M3 20h26" stroke={FAINT} strokeWidth={1.4} strokeDasharray="1.6 2.2" />
          <path d={wave} stroke={HALF} strokeWidth={2} />
          <path d={wave} stroke={FULL} strokeWidth={2.6} clipPath={`url(#${uid}-below)`} />
        </>
      );
    },
  },

  // A chip the rule steps into, or out of to T-bills.
  "semis-switch": {
    color: "#EA580C",
    draw: () => (
      <>
        {[11.5, 16, 20.5].map((v) => (
          <path key={v} d={`M${v} 4.5v3.5M${v} 24v3.5M4.5 ${v}h3.5M24 ${v}h3.5`} stroke={FAINT} strokeWidth={1.6} />
        ))}
        <rect x="8.5" y="8.5" width="15" height="15" rx="2.5" stroke={HALF} strokeWidth={2} />
        <path d="M12 18.5l4-4.5 4 4.5" stroke={FULL} strokeWidth={2.6} />
      </>
    ),
  },

  // One path forks: long tech above, the hedge below.
  "tech-trend-switch": {
    color: "#DB2777",
    draw: () => (
      <>
        <path d="M12 16c6 0 8 9 16 9" stroke={HALF} strokeWidth={2} />
        <path d="M4 16h8c6 0 8-9 16-9" stroke={FULL} strokeWidth={2.6} />
        <circle cx="12" cy="16" r="2.4" fill={FULL} />
      </>
    ),
  },

  // Three chevrons, the lead one solid: it moves ahead of the market.
  frontrunner: {
    color: "#B91C1C",
    draw: () => (
      <>
        <path d="M5 9l6 7-6 7" stroke={FAINT} strokeWidth={2.4} />
        <path d="M12 9l6 7-6 7" stroke={HALF} strokeWidth={2.4} />
        <path d="M19 9l6 7-6 7" stroke={FULL} strokeWidth={2.8} />
      </>
    ),
  },
};

/* ── The finite set, for strategies without a mark of their own ─────── */

const POOL: Mark[] = [
  // Rings.
  { color: "#1D4ED8", draw: () => (<>
    <circle cx="16" cy="16" r="10" stroke={FAINT} strokeWidth={1.6} />
    <circle cx="16" cy="16" r="6" stroke={HALF} strokeWidth={2} />
    <circle cx="16" cy="16" r="2.4" fill={FULL} />
  </>) },
  // A rising step of four.
  { color: "#9333EA", draw: () => (<>
    {[7, 11, 15, 19].map((h, i) => (
      <rect key={i} x={5 + i * 6} y={25 - h} width={4} height={h} rx={1.6} fill={i === 3 ? FULL : i === 2 ? HALF : FAINT} />
    ))}
  </>) },
  // A grid of nine, the diagonal solid.
  { color: "#047857", draw: () => (<>
    {Array.from({ length: 9 }, (_, i) => (
      <circle key={i} cx={9 + (i % 3) * 7} cy={9 + Math.floor(i / 3) * 7} r={i % 4 === 0 ? 2.6 : 1.7} fill={i % 4 === 0 ? FULL : FAINT} />
    ))}
  </>) },
  // Squares inside squares.
  { color: "#B45309", draw: () => (<>
    <rect x="5.5" y="5.5" width="21" height="21" rx="3" stroke={FAINT} strokeWidth={1.6} />
    <rect x="10" y="10" width="12" height="12" rx="2" stroke={HALF} strokeWidth={2} />
    <rect x="14" y="14" width="4" height="4" rx="1" fill={FULL} />
  </>) },
  // A solid wedge standing on a rule.
  { color: "#BE123C", draw: () => (<>
    <path d="M4.5 24.5h23" stroke={FAINT} strokeWidth={1.6} />
    <path d="M16 7l8 14H8z" fill={FULL} />
  </>) },
  // A disc, half of it filled.
  { color: "#0E7490", draw: () => (<>
    <circle cx="16" cy="16" r="9.5" stroke={HALF} strokeWidth={2} />
    <path d="M16 6.5a9.5 9.5 0 010 19z" fill={FULL} />
  </>) },
  // Six spokes, two of them solid.
  { color: "#A21CAF", draw: () => (<>
    {Array.from({ length: 6 }, (_, i) => {
      const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const lead = i < 2;
      return <path key={i} d={`M16 16L${(16 + 11 * Math.cos(angle)).toFixed(2)} ${(16 + 11 * Math.sin(angle)).toFixed(2)}`} stroke={lead ? FULL : FAINT} strokeWidth={lead ? 2.6 : 1.8} />;
    })}
    <circle cx="16" cy="16" r="2.2" fill={FULL} />
  </>) },
  // Three steps up.
  { color: "#15803D", draw: () => (<>
    <path d="M4 25h7v-6h7v-6h7V7" stroke={FULL} strokeWidth={2.6} />
    <path d="M4 25h24" stroke={FAINT} strokeWidth={1.6} />
  </>) },
  // Chevrons pointing up, the top one solid.
  { color: "#6D28D9", draw: () => (<>
    <path d="M7 24l9-6 9 6" stroke={FAINT} strokeWidth={2.4} />
    <path d="M7 18l9-6 9 6" stroke={HALF} strokeWidth={2.4} />
    <path d="M7 12l9-6 9 6" stroke={FULL} strokeWidth={2.8} />
  </>) },
  // Three bands, the middle one solid.
  { color: "#C2410C", draw: () => (<>
    <rect x="5" y="8" width="22" height="4" rx="2" fill={FAINT} />
    <rect x="5" y="14" width="22" height="4" rx="2" fill={FULL} />
    <rect x="5" y="20" width="22" height="4" rx="2" fill={FAINT} />
  </>) },
  // Two diagonals and the node where they meet.
  { color: "#1E40AF", draw: () => (<>
    <path d="M6 6l20 20" stroke={FAINT} strokeWidth={2} />
    <path d="M26 6L6 26" stroke={HALF} strokeWidth={2} />
    <circle cx="16" cy="16" r="3.4" fill={FULL} />
  </>) },
  // A pair of arcs around a dot.
  { color: "#831843", draw: () => (<>
    <path d="M6.5 16a9.5 9.5 0 019.5-9.5" stroke={FULL} strokeWidth={2.8} />
    <path d="M25.5 16a9.5 9.5 0 01-9.5 9.5" stroke={HALF} strokeWidth={2.4} />
    <circle cx="16" cy="16" r="2.6" fill={FULL} />
  </>) },
];

export const StrategyGlyph: FC<{ id: string; size?: number }> = ({ id, size = 32 }) => {
  const uid = "g" + useId().replace(/[^a-zA-Z0-9]/g, "");
  // An id with no mark of its own is not a missing mark: it is one of these.
  const mark = MARKS[id] ?? POOL[generatedMarkIndex(id, POOL.length)];
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-lg"
      style={{ width: size, height: size, backgroundColor: mark.color }}
    >
      <svg viewBox="0 0 32 32" width={size * 0.8} height={size * 0.8} fill="none" strokeLinecap="round" strokeLinejoin="round">
        {mark.draw(uid)}
      </svg>
    </span>
  );
};
