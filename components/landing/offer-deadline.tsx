"use client";

import { useEffect, useState } from "react";
import { offerStatus, type OfferStatus } from "@/lib/launch-offer";

/**
 * The launch offer's deadline, shown next to the price.
 *
 * Why this is a client component on an otherwise server-rendered page:
 * the landing page is statically prerendered, so a date compared on the
 * server is compared against the BUILD time. The countdown would be
 * wrong the day after a deploy and would never correct itself — and,
 * worse, the offer would keep showing after it ended until someone
 * happened to rebuild. Reading the clock in the browser makes the
 * deadline true for the person looking at it.
 *
 * It renders the static date first (which is correct for most of the
 * offer's life and safe to prerender), then swaps to the live wording
 * after mount. No layout shift: both are one short line in the same pill.
 */
export function OfferDeadline({ className = "" }: { className?: string }) {
  // Prerender + first client paint agree, so there is no hydration
  // mismatch; the real clock is read in the effect below. Epoch is far
  // from the deadline, so the prerendered markup is the calm date tier —
  // the safest thing to ship in HTML, since it is the only wording that
  // cannot go stale between build and view.
  const [status, setStatus] = useState<OfferStatus>(() => offerStatus(0));

  useEffect(() => {
    const tick = () => setStatus(offerStatus(Date.now()));
    tick();
    /* Every minute, not every hour: on the final day the label counts in
       hours, and a page left open would otherwise sit on a stale count
       for up to an hour — including showing an offer that has ended. A
       one-minute timer on a single string costs nothing. */
    const id = setInterval(tick, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (!status.live) return null;

  return (
    /* The short label rounds — "3 weeks", "6 days" — so the exact end is
       always one hover away and nobody has to work out a real date from
       an approximation. `title` is used rather than a custom tooltip
       because it costs nothing, survives without JavaScript, and is the
       one tooltip mechanism that already works on touch (long-press) and
       for screen readers.

       The dotted underline is the affordance: without it a title is
       invisible and nobody discovers it. `help` cursor says the same
       thing to a mouse. */
    <span
      title={status.exact}
      className={`l-pill cursor-help px-2.5 py-0.5 text-[12px] decoration-dotted underline-offset-2 hover:underline ${
        status.urgent
          ? "bg-[#fef3c7] font-semibold text-[#b45309]"
          : "bg-[var(--l-wash-2)] text-[var(--l-ink-2)]"
      } ${className}`}
    >
      {status.label}
    </span>
  );
}
