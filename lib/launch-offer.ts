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

/** The civil date in India at an instant, as YYYY-MM-DD. */
function istDate(ms: number): string {
  // en-CA formats as YYYY-MM-DD, which subtracts correctly as a string
  // and needs no parsing.
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date(ms));
}

/**
 * Whole days between two instants, counted as CALENDAR days in India.
 *
 * Not (end - now) / 86400000. Elapsed-time division counts part-days, so
 * at 8pm on the final day — four hours left — it returns 1 and the page
 * says "ends tomorrow" on the very last day it can be taken. A reader
 * counts dates on a calendar, not 24-hour blocks, so we do too.
 */
function daysBetweenIST(now: number, end: number): number {
  const a = Date.parse(`${istDate(now)}T00:00:00Z`);
  const b = Date.parse(`${istDate(end - 1)}T00:00:00Z`); // -1ms: midnight belongs to the day before
  return Math.round((b - a) / DAY);
}

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
 * Always a countdown — "Offer ends in 35 days" — because a number that
 * shrinks every time you come back is the thing that creates urgency; a
 * fixed date just sits there. The last two days are special-cased only
 * because "in 1 days" is broken English and "in 0 days" is nonsense.
 *
 * `urgent` turns on inside the final month, which is what drives the
 * amber styling. The wording does not change, only the emphasis.
 *
 * `now` is always passed in, never read here — see the note at the top
 * about static prerendering.
 */
export function offerStatus(now: number, endsAt: number = LAUNCH_OFFER_ENDS): OfferStatus {
  const ms = endsAt - now;
  if (ms <= 0) return { live: false };

  const days = daysBetweenIST(now, endsAt);
  /* Deliberately not offerDeadlineLabel(endsAt): endsAt is midnight, which
     spells as the following day. See the note beside LAST_DAY. */
  const deadline = offerDeadlineLabel();
  const urgent = days <= 30;

  if (days > 1) return { live: true, days, urgent, label: `Offer ends in ${days} days`, deadline };
  if (days === 1) return { live: true, days, urgent, label: "Offer ends tomorrow", deadline };
  return { live: true, days, urgent, label: "Offer ends today", deadline };
}
