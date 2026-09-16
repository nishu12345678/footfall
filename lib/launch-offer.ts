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
  | {
      live: true;
      days: number;
      urgent: boolean;
      label: string;
      deadline: string;
      /** The exact end, spelled out — shown on hover behind the short label. */
      exact: string;
    };

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
 * The full deadline, for the hover title: "Ends 31 December 2026 at
 * 11:59 pm IST".
 *
 * Built from LAST_DAY and a literal end-of-day time rather than from the
 * end instant, for the same reason the short label is: formatting the
 * end instant gives "1 January, 12:00 am", which is technically true and
 * reads as the offer running a day longer than it does.
 */
export function offerExactLabel(lastDay: number = LAST_DAY): string {
  const day = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(lastDay));
  return `Ends ${day} at 11:59 pm IST`;
}

/**
 * How the deadline should read at a given moment.
 *
 * The unit gets finer as the deadline gets closer, so the line always
 * carries roughly the same amount of pressure:
 *
 *   > 30 days   "Offer till 31 December"   — a date; no hurry to imply
 *   10–30 days  "Offer ends in 3 weeks"    — softer than 22, still moving
 *   1–9 days    "Offer ends in 6 days"     — a number that visibly drops
 *   final day   "Offer ends in 5 hours"    — the last push
 *
 * The exact end is always available on hover (see `exact`), so a reader
 * who wants the real date never has to work it out from "3 weeks".
 *
 * `urgent` — the amber styling — turns on at 10 days, where the wording
 * switches to a daily countdown.
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
  const exact = offerExactLabel();
  const urgent = days < 10;
  const base = { live: true, days, urgent, deadline, exact } as const;

  if (days > 30) return { ...base, label: `Offer till ${deadline}` };

  if (days >= 10) {
    // Rounded, not floored: at 20 days "2 weeks" would understate the time
    // left by nearly a week, and a deadline must never sound tighter than
    // it is. 10-13 days rounds to 1, so the singular is handled.
    const weeks = Math.round(days / 7);
    return { ...base, label: `Offer ends in ${weeks} ${weeks === 1 ? "week" : "weeks"}` };
  }

  if (days > 1) return { ...base, label: `Offer ends in ${days} days` };
  if (days === 1) return { ...base, label: "Offer ends tomorrow" };

  /* The final day. Hours here, not calendar days — this is the one place
     where elapsed time is what a reader means. Rounded UP, so the last
     stretch reads "in 1 hour" rather than "in 0 hours" and never claims
     less time than really remains. */
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  return { ...base, label: `Offer ends in ${hours} ${hours === 1 ? "hour" : "hours"}` };
}
