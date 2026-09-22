import { afterEach, describe, expect, it } from "vitest";
import {
  clarityId,
  isShopHost,
  isShopPath,
  shouldTrack,
  shouldTrackClarity,
} from "./analytics";

const D = "footfall.zone";

describe("isShopHost", () => {
  it("apex and www are ours", () => {
    expect(isShopHost("footfall.zone", D)).toBe(false);
    expect(isShopHost("www.footfall.zone", D)).toBe(false);
    expect(isShopHost("FOOTFALL.ZONE", D)).toBe(false);
  });

  it("a single label under the domain is a shop", () => {
    expect(isShopHost("sharma-bakery.footfall.zone", D)).toBe(true);
    expect(isShopHost("Sharma-Bakery.footfall.zone:443", D)).toBe(true);
  });

  it("reserved labels are never shops", () => {
    for (const r of ["app", "api", "admin", "staging", "cdn"]) {
      expect(isShopHost(`${r}.footfall.zone`, D)).toBe(false);
    }
  });

  it("nested labels and other domains are not shops", () => {
    expect(isShopHost("a.b.footfall.zone", D)).toBe(false);
    expect(isShopHost("footfall.zone.evil.com", D)).toBe(false);
    expect(isShopHost("localhost:3000", D)).toBe(false);
    expect(isShopHost("footfall-abc.vercel.app", D)).toBe(false);
    expect(isShopHost(null, D)).toBe(false);
    expect(isShopHost("", D)).toBe(false);
  });
});

describe("isShopPath", () => {
  it("only /s and below", () => {
    expect(isShopPath("/s")).toBe(true);
    expect(isShopPath("/s/sharma-bakery")).toBe(true);
    expect(isShopPath("/s/sharma-bakery/services")).toBe(true);
    expect(isShopPath("/")).toBe(false);
    expect(isShopPath("/app")).toBe(false);
    expect(isShopPath("/settings")).toBe(false);
    expect(isShopPath("/sx")).toBe(false);
    expect(isShopPath(null)).toBe(false);
  });
});

describe("shouldTrack", () => {
  it("marketing page and product are measured", () => {
    expect(shouldTrack("footfall.zone", "/", D)).toBe(true);
    expect(shouldTrack("footfall.zone", "/app/posts", D)).toBe(true);
    expect(shouldTrack("footfall.zone", "/privacy", D)).toBe(true);
    expect(shouldTrack("localhost:3000", "/app", D)).toBe(true);
  });

  it("shop sites are excluded on either address", () => {
    // Subdomain: the browser sees `/services`, the host says shop.
    expect(shouldTrack("sharma-bakery.footfall.zone", "/services", D)).toBe(false);
    expect(shouldTrack("sharma-bakery.footfall.zone", "/", D)).toBe(false);
    // Path form on the main host, previews and localhost.
    expect(shouldTrack("footfall.zone", "/s/sharma-bakery", D)).toBe(false);
    expect(shouldTrack("localhost:3000", "/s/sharma-bakery/about", D)).toBe(false);
  });
});

describe("shouldTrackClarity", () => {
  it("measures marketing and product pages", () => {
    expect(shouldTrackClarity("footfall.zone", "/", D)).toBe(true);
    expect(shouldTrackClarity("footfall.zone", "/app/posts", D)).toBe(true);
  });

  it("excludes the staff dashboard and shop sites", () => {
    expect(shouldTrackClarity("footfall.zone", "/admin", D)).toBe(false);
    expect(shouldTrackClarity("footfall.zone", "/admin/analytics", D)).toBe(false);
    expect(shouldTrackClarity("sharma-bakery.footfall.zone", "/", D)).toBe(false);
    expect(shouldTrackClarity("footfall.zone", "/s/sharma-bakery", D)).toBe(false);
  });
});

describe("clarityId", () => {
  const original = process.env.NEXT_PUBLIC_CLARITY_ID;

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_CLARITY_ID;
    else process.env.NEXT_PUBLIC_CLARITY_ID = original;
  });

  it("accepts a Clarity project id", () => {
    process.env.NEXT_PUBLIC_CLARITY_ID = "ymbaryo6fx";
    expect(clarityId()).toBe("ymbaryo6fx");
  });

  it("rejects an empty or script-shaped value", () => {
    process.env.NEXT_PUBLIC_CLARITY_ID = "";
    expect(clarityId()).toBeNull();
    process.env.NEXT_PUBLIC_CLARITY_ID = 'x";alert(1);//';
    expect(clarityId()).toBeNull();
  });
});
