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
  // mismatch; the real clock is read in the effect below.
  const [status, setStatus] = useState<OfferStatus>(() =>
    offerStatus(0), // 0 = epoch: far from the deadline, so "Offer ends 31 December"
  );

  useEffect(() => {
    const tick = () => setStatus(offerStatus(Date.now()));
    tick();
    // Re-check hourly so a page left open overnight cannot keep showing
    // "ends today" after it has ended.
    const id = setInterval(tick, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (!status.live) return null;

  return (
    <span
      className={`l-pill px-2.5 py-0.5 text-[12px] ${
        status.urgent
          ? "bg-[#fef3c7] font-semibold text-[#b45309]"
          : "bg-[var(--l-wash-2)] text-[var(--l-ink-2)]"
      } ${className}`}
    >
      {status.label}
    </span>
  );
}
