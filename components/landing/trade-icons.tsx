import type { SVGProps } from "react";

/*
 * One stroke glyph per trade, drawn on the same 24-unit grid and in the
 * same lucide-ish hand as ./icons.tsx. These exist so the "Built for
 * shops like yours" tiles can be read at a glance — a picture of the
 * trade lands before the sentence does — without reaching for emoji,
 * which is the single biggest "this was generated" tell on a landing
 * page, and without shipping fifteen stock photographs.
 */

const TRADE_PATHS = {
  /** Salons & parlours — barber's scissors. */
  scissors: [
    "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    "M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
    "M20 4 8.12 15.88",
    "M14.47 14.48 20 20",
    "M8.12 8.12 12 12",
  ],

  /** Clinics & dentists — a molar, two crowns over two roots. */
  tooth: [
    "M12 6.5c-1.5-2-4-3.3-5.7-2.3S4.2 7.6 4.8 10.2c.5 2.2 1 4.4 1.4 6.6.3 1.8.7 3.7 1.8 3.7s1.5-1.7 1.8-3.3c.3-1.6.8-2.8 2.2-2.8s1.9 1.2 2.2 2.8c.3 1.6.7 3.3 1.8 3.3s1.5-1.9 1.8-3.7c.4-2.2.9-4.4 1.4-6.6.6-2.6.2-5-1.5-6S13.5 4.5 12 6.5Z",
  ],

  /** Sari & clothing — a shop hanger. Falling drape was tried first and
      read as water; the hanger says "clothing shop" with no thinking. */
  hanger: [
    "M12 8a2.6 2.6 0 1 1 2.6-2.6",
    "M12 8 3.7 14.3A1 1 0 0 0 4.3 16h15.4a1 1 0 0 0 .6-1.7L12 8Z",
  ],

  /** Style & fashion — a shirt on the rail. */
  shirt: [
    "M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23Z",
  ],

  /** Kirana & grocery — the shopping basket. */
  basket: [
    "M2 11h20",
    "m5 11 4-7",
    "m19 11-4-7",
    "m3.6 11 1.7 7.4a2 2 0 0 0 2 1.6h9.4a2 2 0 0 0 2-1.6l1.7-7.4",
    "m9.5 14.5.5 3",
    "m14.5 14.5-.5 3",
  ],

  /** Gyms & fitness — a loaded dumbbell. */
  dumbbell: [
    "M6.5 12h11",
    "M6.5 6v12",
    "M17.5 6v12",
    "M3.5 9v6",
    "M20.5 9v6",
  ],

  /** Restaurants & cafés — fork and knife. */
  utensils: [
    "M3 2v7a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2V2",
    "M5.5 2v20",
    "M21 15V2a5 5 0 0 0-5 5v6a2 2 0 0 0 2 2Z",
    "M21 15v7",
  ],

  /** Tiles, marble & hardware — a running-bond tile course. */
  tiles: [
    "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z",
    "M3 12h18",
    "M12 3v9",
    "M8 12v9",
  ],

  /** Coaching & classes — the graduation cap. */
  cap: [
    "M12.83 3.18a2 2 0 0 0-1.66 0L2.6 7.08a1 1 0 0 0 0 1.84l8.57 3.9a2 2 0 0 0 1.66 0l8.57-3.9a1 1 0 0 0 0-1.84Z",
    "M22 8v6",
    "M6 10.5V15a6 3 0 0 0 12 0v-4.5",
  ],

  /** Repairs & services — the spanner. */
  wrench: [
    "M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z",
  ],

  /** Sweet shops & bakeries — a cake with candles. */
  cake: [
    "M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8",
    "M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2 1 2 1",
    "M2 21h20",
    "M7 8v3",
    "M12 8v3",
    "M17 8v3",
    "M7 4.5h.01",
    "M12 4.5h.01",
    "M17 4.5h.01",
  ],

  /** Mobile & electronics — the handset. */
  phone: [
    "M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z",
    "M12 18h.01",
  ],

  /** Jewellers — a cut stone. */
  gem: ["M6 3h12l4 6-10 13L2 9Z", "M11 3 8 9l4 13 4-13-3-6", "M2 9h20"],

  /** Chemists & pharmacies — the capsule. */
  pill: [
    "m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z",
    "m8.5 8.5 7 7",
  ],

  /** Boutiques & tailors — a spool of thread: wide flanges, wound barrel.
      Plain bars read as a ladder, so the silhouette is drawn properly. */
  spool: [
    "M5 3h14v3h-4v12h4v3H5v-3h4V6H5Z",
    "M9 9.5h6",
    "M9 12h6",
    "M9 14.5h6",
  ],
} as const;

export type TradeIconName = keyof typeof TRADE_PATHS;

export function TradeIcon({
  name,
  size = 20,
  strokeWidth = 1.75,
  ...rest
}: { name: TradeIconName; size?: number; strokeWidth?: number } & Omit<
  SVGProps<SVGSVGElement>,
  "name"
>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {TRADE_PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/*
 * Eight soft tints. Every tile uses the same recipe — a near-white card
 * wash, a stronger chip behind the glyph, one ink for both the glyph and
 * its oversized watermark — so fifteen different colours still read as
 * one family rather than a bag of sweets.
 */
export const TRADE_TONES = {
  rose: { wash: "#fff7f9", chip: "#ffe4ec", ink: "#be123c" },
  blue: { wash: "#f5f9ff", chip: "#dbeafe", ink: "#1d4ed8" },
  violet: { wash: "#faf7ff", chip: "#ede4ff", ink: "#6d28d9" },
  orange: { wash: "#fff8f4", chip: "#ffe6d9", ink: "#c2410c" },
  green: { wash: "#f5fbf6", chip: "#d9f2e0", ink: "#15803d" },
  slate: { wash: "#f8fafc", chip: "#e6ecf2", ink: "#334155" },
  amber: { wash: "#fffbf2", chip: "#fdefc8", ink: "#b45309" },
  teal: { wash: "#f4fbf9", chip: "#d6f2ea", ink: "#0f766e" },
} as const;

export type TradeTone = keyof typeof TRADE_TONES;
