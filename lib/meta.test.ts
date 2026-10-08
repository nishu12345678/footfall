import { describe, expect, it } from "vitest";
import {
  isMetaPage,
  metaBrowserId,
  parseMetaPageView,
  readCookie,
} from "./meta";

describe("Meta website campaign boundaries", () => {
  it("allows only Footfall's public pages", () => {
    expect(isMetaPage("footfall.zone", "/")).toBe(true);
    expect(isMetaPage("www.footfall.zone", "/privacy")).toBe(true);
    for (const host of [
      "salon.footfall.zone",
      "app.footfall.zone",
      "footfall-delta.vercel.app",
      "localhost",
      "footfall.zone.evil.test",
    ]) {
      expect(isMetaPage(host, "/")).toBe(false);
    }
    for (const path of [
      "/app",
      "/app/login",
      "/app/report",
      "/admin",
      "/s/salon",
      "/api/auth",
      "/?email=a@example.com",
    ]) {
      expect(isMetaPage("footfall.zone", path)).toBe(false);
    }
  });

  it("requires a recent event and preserves the browser's deduplication ID", () => {
    const now = Date.now();
    const event = {
      eventId: "aba03e81-26d0-40ad-9189-12bd03e8d0ea",
      eventTime: Math.floor(now / 1000),
      pathname: "/",
    };
    expect(
      parseMetaPageView(
        {
          ...event,
          email: "not-forwarded@example.com",
          event_name: "Purchase",
        },
        now,
      ),
    ).toEqual(event);
    expect(
      parseMetaPageView({ ...event, eventTime: event.eventTime - 301 }, now),
    ).toBeNull();
    expect(
      parseMetaPageView({ ...event, eventTime: event.eventTime + 61 }, now),
    ).toBeNull();
    expect(
      parseMetaPageView({ ...event, eventId: "not-an-id" }, now),
    ).toBeNull();
    expect(
      parseMetaPageView({ ...event, pathname: "/app/report" }, now),
    ).toBeNull();
    expect(parseMetaPageView(null, now)).toBeNull();
  });

  it("reads exact cookie names and accepts only valid matching identifiers", () => {
    expect(
      readCookie(
        "other_footfall_meta_consent=granted; footfall_meta_consent=denied",
        "footfall_meta_consent",
      ),
    ).toBe("denied");
    expect(metaBrowserId("fb.1.1791450000000.123456789", "fbp")).toBe(
      "fb.1.1791450000000.123456789",
    );
    expect(metaBrowserId("fb.1.1791450000000.real-click_id", "fbc")).toBe(
      "fb.1.1791450000000.real-click_id",
    );
    expect(metaBrowserId("someone@example.com", "fbc")).toBeUndefined();
  });
});
