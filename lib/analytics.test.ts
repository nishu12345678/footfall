import { describe, expect, it } from "vitest";
import { isShopHost, isShopPath, shouldTrack } from "./analytics";

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
