import { describe, expect, it } from "vitest";
import { LAUNCH_OFFER_ENDS, offerDeadlineLabel, offerStatus } from "./launch-offer";

/**
 * Every bug this file guards against is invisible today and only appears
 * on a specific date — which is why it is tested rather than eyeballed.
 *
 * The one that already happened: formatting the end instant in IST
 * printed "1 January", because midnight-of-the-31st IS the first moment
 * of January. The page would have advertised the wrong day.
 */

const DAY = 24 * 60 * 60 * 1000;
const at = (daysBefore: number) => LAUNCH_OFFER_ENDS - daysBefore * DAY;

describe("offerDeadlineLabel", () => {
  it("names the last usable day, not the midnight that follows it", () => {
    expect(offerDeadlineLabel()).toBe("31 December");
  });
});

describe("offerStatus", () => {
  it("names the date while the deadline is far off", () => {
    const s = offerStatus(at(60));
    expect(s.live).toBe(true);
    if (!s.live) return;
    expect(s.urgent).toBe(false);
    expect(s.label).toBe("Offer ends 31 December");
  });

  it("does not count down in large numbers, which read as 'no hurry'", () => {
    const s = offerStatus(at(31));
    if (!s.live) throw new Error("expected live");
    expect(s.label).not.toMatch(/\d+ days/);
  });

  it("switches to a countdown inside the last 30 days", () => {
    const s = offerStatus(at(30));
    if (!s.live) throw new Error("expected live");
    expect(s.urgent).toBe(true);
    expect(s.label).toBe("Offer ends in 30 days");
  });

  it("says 'today' on the final day", () => {
    const s = offerStatus(LAUNCH_OFFER_ENDS - 60 * 60 * 1000);
    if (!s.live) throw new Error("expected live");
    expect(s.label).toBe("Offer ends today");
  });

  it("never says 'in 1 days'", () => {
    for (let h = 1; h <= 48; h++) {
      const s = offerStatus(LAUNCH_OFFER_ENDS - h * 60 * 60 * 1000);
      if (!s.live) throw new Error("expected live");
      expect(s.label).not.toBe("Offer ends in 1 days");
    }
  });

  it("goes dark at the deadline and stays dark", () => {
    expect(offerStatus(LAUNCH_OFFER_ENDS).live).toBe(false);
    expect(offerStatus(LAUNCH_OFFER_ENDS + 1).live).toBe(false);
    expect(offerStatus(LAUNCH_OFFER_ENDS + 365 * DAY).live).toBe(false);
  });

  it("ends at midnight IST, not midnight UTC", () => {
    // 23:00 IST on the 31st is 17:30 UTC — still live. A UTC-midnight
    // deadline would have killed the offer 5.5 hours early for India.
    expect(offerStatus(Date.UTC(2026, 11, 31, 17, 30)).live).toBe(true);
    expect(offerStatus(Date.UTC(2026, 11, 31, 18, 30)).live).toBe(false);
  });

  it("is pure: the same instant always gives the same answer", () => {
    expect(offerStatus(at(10))).toEqual(offerStatus(at(10)));
  });
});
