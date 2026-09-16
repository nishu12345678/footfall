import { describe, expect, it } from "vitest";
import {
  LAUNCH_OFFER_ENDS,
  offerDeadlineLabel,
  offerExactLabel,
  offerStatus,
} from "./launch-offer";

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
const HOUR = 60 * 60 * 1000;

/** A visitor at a given hour of a given 2026 date, Indian time. */
const ist = (month: number, day: number, hourIST = 20) =>
  Date.UTC(2026, month - 1, day, hourIST, 0) - 5.5 * HOUR;

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

describe("labels", () => {
  it("names the last usable day, not the midnight that follows it", () => {
    expect(offerDeadlineLabel()).toBe("31 December");
    expect(offerExactLabel()).toBe("Ends 31 December 2026 at 11:59 pm IST");
  });
});

describe("tier 1 — beyond 30 days, a date", () => {
  it("shows the date and does not imply hurry", () => {
    expect(label(at(107))).toBe("Offer till 31 December");
    expect(label(at(31))).toBe("Offer till 31 December");
  });
});

describe("tier 2 — 10 to 30 days, weeks", () => {
  it("counts in weeks", () => {
    expect(label(at(30))).toBe("Offer ends in 4 weeks");
    expect(label(at(21))).toBe("Offer ends in 3 weeks");
    expect(label(at(14))).toBe("Offer ends in 2 weeks");
  });

  it("rounds rather than floors, so it never sounds tighter than it is", () => {
    // 20 days floored would be "2 weeks" — nearly a week short.
    expect(label(at(20))).toBe("Offer ends in 3 weeks");
  });

  it("uses the singular when it rounds to one", () => {
    expect(label(at(10))).toBe("Offer ends in 1 week");
  });
});

describe("tier 3 — under 10 days, days", () => {
  it("counts down in days", () => {
    expect(label(at(9))).toBe("Offer ends in 9 days");
    expect(label(at(2))).toBe("Offer ends in 2 days");
  });

  it("says 'tomorrow' rather than 'in 1 days'", () => {
    expect(label(ist(12, 30))).toBe("Offer ends tomorrow");
  });
});

describe("tier 4 — the final day, hours", () => {
  it("counts hours once it is the last day", () => {
    // 6pm IST on 31 Dec: six hours to midnight.
    expect(label(ist(12, 31, 18))).toBe("Offer ends in 6 hours");
    expect(label(ist(12, 31, 9))).toBe("Offer ends in 15 hours");
  });

  it("rounds hours UP, so it never claims less time than remains", () => {
    // 90 minutes left must not read "in 1 hour".
    expect(label(LAUNCH_OFFER_ENDS - 90 * 60 * 1000)).toBe("Offer ends in 2 hours");
  });

  it("uses the singular in the last hour, and never says 0", () => {
    expect(label(LAUNCH_OFFER_ENDS - HOUR)).toBe("Offer ends in 1 hour");
    expect(label(LAUNCH_OFFER_ENDS - 60_000)).toBe("Offer ends in 1 hour");
  });
});

describe("no broken output at any hour", () => {
  it("never emits a bad plural, a zero, or a negative", () => {
    for (let h = 1; h <= 24 * 120; h++) {
      const l = label(LAUNCH_OFFER_ENDS - h * HOUR);
      expect(l, `at ${h}h before the end`).toBeTypeOf("string");
      expect(l).not.toMatch(/\b1 (days|weeks|hours)\b/);
      expect(l).not.toMatch(/\b0 \w+\b/);
      expect(l).not.toMatch(/-\d|\bNaN\b/);
    }
  });

  it("only ever uses the four intended shapes", () => {
    const shapes = new Set<string>();
    for (let h = 1; h <= 24 * 120; h++) {
      const l = label(LAUNCH_OFFER_ENDS - h * HOUR)!;
      shapes.add(l.replace(/\d+/, "N"));
    }
    expect([...shapes].sort()).toEqual([
      "Offer ends in N days",
      "Offer ends in N hour",
      "Offer ends in N hours",
      "Offer ends in N week",
      "Offer ends in N weeks",
      "Offer ends tomorrow",
      "Offer till N December", // the date is normalised by the replace above
    ]);
  });
});

describe("urgency", () => {
  it("stays calm while the wording is a date or weeks", () => {
    for (const d of [60, 31, 30, 14, 10]) {
      const s = offerStatus(at(d));
      expect(s.live && s.urgent, `${d} days out`).toBe(false);
    }
  });

  it("turns urgent once it counts in days", () => {
    for (const d of [9, 5, 1]) {
      const s = offerStatus(at(d));
      expect(s.live && s.urgent, `${d} days out`).toBe(true);
    }
  });
});

describe("expiry", () => {
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
