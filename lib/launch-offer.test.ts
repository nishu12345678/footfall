import { describe, expect, it } from "vitest";
import { LAUNCH_OFFER_ENDS, offerDeadlineLabel, offerStatus } from "./launch-offer";

/**
 * Every bug this file guards against is invisible today and only appears
 * on a specific date — which is why it is tested rather than eyeballed.
 *
 * Two have already been caught this way:
 *
 *   · Formatting the end instant in IST printed "1 January", because
 *     midnight-of-the-31st IS the first moment of January.
 *   · Dividing elapsed milliseconds by 86,400,000 said "ends tomorrow"
 *     at 8pm on 31 December — the last day it could be taken.
 */

const DAY = 24 * 60 * 60 * 1000;

/** A visitor at a given hour of a given 2026 date, Indian time. */
const ist = (month: number, day: number, hourIST = 20) =>
  Date.UTC(2026, month - 1, day, hourIST, 0) - 5.5 * 60 * 60 * 1000;

/**
 * `n` whole days before the last day, read at midday so the instant sits
 * squarely inside one Indian calendar date. Subtracting exact 24h blocks
 * from the midnight boundary instead would straddle two dates and be off
 * by one — which is the very thing the countdown gets wrong if it counts
 * elapsed time rather than calendar days.
 */
const at = (daysBefore: number) => ist(12, 31, 12) - daysBefore * DAY;

const label = (t: number) => {
  const s = offerStatus(t);
  return s.live ? s.label : null;
};

describe("offerDeadlineLabel", () => {
  it("names the last usable day, not the midnight that follows it", () => {
    expect(offerDeadlineLabel()).toBe("31 December");
  });
});

describe("offerStatus wording", () => {
  it("always counts down in days", () => {
    expect(label(at(107))).toBe("Offer ends in 107 days");
    expect(label(at(35))).toBe("Offer ends in 35 days");
    expect(label(at(8))).toBe("Offer ends in 8 days");
  });

  it("says 'tomorrow' and 'today' instead of '1 days' / '0 days'", () => {
    expect(label(ist(12, 30))).toBe("Offer ends tomorrow");
    expect(label(ist(12, 31))).toBe("Offer ends today");
  });

  it("still says 'today' at 23:59 on the final day", () => {
    // 18:29 UTC = 23:59 IST on 31 Dec. Elapsed-time maths called this
    // "tomorrow", which would be wrong on the last day of the offer.
    expect(label(Date.UTC(2026, 11, 31, 18, 29))).toBe("Offer ends today");
  });

  it("counts calendar days, so the number does not change mid-evening", () => {
    // Same civil date in India, 14 hours apart: same answer.
    expect(label(ist(12, 24, 7))).toBe(label(ist(12, 24, 21)));
  });

  it("never emits a broken plural, at any hour of the final 40 days", () => {
    for (let h = 1; h <= 24 * 40; h++) {
      const l = label(LAUNCH_OFFER_ENDS - h * 60 * 60 * 1000);
      expect(l, `at ${h}h before the end`).toBeTypeOf("string");
      expect(l).not.toBe("Offer ends in 1 days");
      expect(l).not.toBe("Offer ends in 0 days");
      expect(l).not.toMatch(/-\d|\bNaN\b/);
    }
  });
});

describe("offerStatus urgency", () => {
  it("is calm beyond a month out and urgent inside it", () => {
    const far = offerStatus(at(60));
    const near = offerStatus(at(30));
    expect(far.live && far.urgent).toBe(false);
    expect(near.live && near.urgent).toBe(true);
  });
});

describe("offerStatus expiry", () => {
  it("goes dark at the deadline and stays dark", () => {
    expect(offerStatus(LAUNCH_OFFER_ENDS).live).toBe(false);
    expect(offerStatus(LAUNCH_OFFER_ENDS + 1).live).toBe(false);
    expect(offerStatus(LAUNCH_OFFER_ENDS + 365 * DAY).live).toBe(false);
  });

  it("ends at midnight IST, not midnight UTC", () => {
    // 23:00 IST on the 31st is 17:30 UTC — still live. A UTC-midnight
    // deadline would have cut India off 5.5 hours early.
    expect(offerStatus(Date.UTC(2026, 11, 31, 17, 30)).live).toBe(true);
    expect(offerStatus(Date.UTC(2026, 11, 31, 18, 30)).live).toBe(false);
  });

  it("is pure: the same instant always gives the same answer", () => {
    expect(offerStatus(at(10))).toEqual(offerStatus(at(10)));
  });
});
