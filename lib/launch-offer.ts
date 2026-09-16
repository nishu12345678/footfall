/* ---------------------------------------------------------------------------
   The launch offer's deadline.

   One date, one place. Everything about how the offer is worded on the
   page is derived from it, so there is nothing to remember to take down.

   Two things this file exists to prevent:

   1. A stale deadline. A hardcoded "ends 31 December" keeps advertising a
      dead offer the moment it passes, which reads worse than no deadline
      at all. Here, once the date is gone every deadline line disappears
      by itself and the price simply stands on its own.

   2. A frozen date. The landing page is statically prerendered, so a date
      compared at module scope would be the BUILD date, not today's — the
      countdown would be wrong the day after a deploy and would never
      correct itself. So nothing is computed on import: callers pass
      `now`, and the component that shows a live countdown reads the
      clock in the browser.

   The prices themselves are enforced in convex/billing.ts and are NOT
   affected by this date. Nothing expires server-side on its own — when
   the offer really ends, change the amounts there. This file only
   controls what the page says.
--------------------------------------------------------------------------- */

/* The offer runs to the END of 31 December 2026 in India, which is 18:30
   UTC that day. Two separate values, because one cannot do both jobs:

   ENDS  is the instant it stops — midnight IST, i.e. 00:00 on 1 Jan.
   LABEL is the day a reader is given — "31 December".

   Formatting ENDS in IST would print "1 January", since that instant IS
   the first moment of January. The date shown must be the last day the
   offer is usable, so it is taken from noon on the 31st instead. */
export const LAUNCH_OFFER_ENDS = Date.UTC(2026, 11, 31, 18, 30, 0);

/** Noon IST on the final day — used only to spell the date. */
const LAST_DAY = Date.UTC(2026, 11, 31, 6, 30, 0);

const DAY = 24 * 60 * 60 * 1000;

export type OfferStatus =
  | { live: false }
  | { live: true; days: number; urgent: boolean; label: string; deadline: string };

/** "31 December" — the last day the offer can be taken, spelled out. */
export function offerDeadlineLabel(lastDay: number = LAST_DAY): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  }).format(new Date(lastDay));
}

/**
 * How the deadline should read at a given moment.
 *
 * The wording changes with distance because "ends in 106 days" is not
 * urgency, it is trivia — a number that large reads as "no hurry". Far
 * out we name the date; close in we count down; on the last day we say
 * so plainly.
 *
 * `now` is always passed in, never read here — see the note at the top
 * about static prerendering.
 */
export function offerStatus(now: number, endsAt: number = LAUNCH_OFFER_ENDS): OfferStatus {
  const ms = endsAt - now;
  if (ms <= 0) return { live: false };

  const days = Math.ceil(ms / DAY);
  /* Deliberately not offerDeadlineLabel(endsAt): endsAt is midnight, which
     spells as the following day. See the note beside LAST_DAY. */
  const deadline = offerDeadlineLabel();

  if (days > 30) return { live: true, days, urgent: false, label: `Offer ends ${deadline}`, deadline };
  if (days > 1) return { live: true, days, urgent: true, label: `Offer ends in ${days} days`, deadline };
  return { live: true, days, urgent: true, label: "Offer ends today", deadline };
}
