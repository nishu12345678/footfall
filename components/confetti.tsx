"use client";

import { useEffect, useState } from "react";

/**
 * A short burst of confetti for the one moment that deserves it.
 *
 * Deliberately not a library: this fires once, in one place, and a
 * canvas dependency for twenty coloured squares would cost more to ship
 * than the effect is worth. Plain absolutely-positioned spans with a CSS
 * keyframe do the same job with nothing to load.
 *
 * It removes itself when the animation ends, so nothing is left painting
 * or holding layout afterwards.
 */

const PIECES = 18;
/* The app's own accents, not party colours — a celebration should still
   look like the product it happens in. */
const COLOURS = ["#2563eb", "#16a34a", "#f59e0b", "#e11d48", "#7c3aed"];

export function Confetti() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    /* Clear the pieces once the animation has finished, so nothing is
       left painting or holding layout.

       Reduced motion is handled in CSS (.ff-confetti is display:none
       under the media query) rather than by setting state here: doing it
       in an effect would mean a synchronous setState on mount, and the
       pieces would render for one frame before vanishing. */
    const id = setTimeout(() => setDone(true), 2600);
    return () => clearTimeout(id);
  }, []);

  if (done) return null;

  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 block h-0 overflow-visible"
    >
      {Array.from({ length: PIECES }).map((_, i) => {
        // Spread across the card, with varied timing so the burst does
        // not read as a single falling row.
        const left = (i / (PIECES - 1)) * 100;
        const delay = (i % 6) * 90;
        const drift = i % 2 ? 16 : -16;
        return (
          <span
            key={i}
            className="ff-confetti absolute block h-1.5 w-1.5 rounded-[1px]"
            style={{
              left: `${left}%`,
              backgroundColor: COLOURS[i % COLOURS.length],
              animationDelay: `${delay}ms`,
              ["--ff-drift" as string]: `${drift}px`,
            }}
          />
        );
      })}
    </span>
  );
}
