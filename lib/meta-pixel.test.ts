import { afterEach, describe, expect, it } from "vitest";
import {
  contactParams,
  ensureFbq,
  fbqPush,
  initiateCheckoutParams,
  isMetaEvent,
  leadParams,
  META_EVENTS,
  metaEvent,
  purchaseParams,
  sanitizeMetaParams,
  setMetaTracking,
  type Fbq,
} from "./meta-pixel";

type W = { fbq?: Fbq; _fbq?: Fbq };

/** A bare window for the transport tests; the edge runtime has none. */
function withWindow<T>(fn: (w: W) => T): T {
  const g = globalThis as unknown as { window?: W };
  const had = "window" in globalThis;
  if (!had) g.window = {};
  try {
    return fn(g.window!);
  } finally {
    if (!had) delete g.window;
    else {
      delete g.window!.fbq;
      delete g.window!._fbq;
    }
  }
}

describe("isMetaEvent", () => {
  it("accepts exactly the four standard events", () => {
    expect(META_EVENTS).toEqual(["Contact", "Lead", "InitiateCheckout", "Purchase"]);
    for (const e of META_EVENTS) expect(isMetaEvent(e)).toBe(true);
  });

  it("refuses anything else, including a differently cased standard name", () => {
    expect(isMetaEvent("purchase")).toBe(false);
    expect(isMetaEvent("ViewContent")).toBe(false);
    expect(isMetaEvent("")).toBe(false);
  });
});

describe("sanitizeMetaParams", () => {
  it("keeps allowed keys and drops the rest", () => {
    const { params, dropped } = sanitizeMetaParams("Lead", {
      content_name: "google",
      email: "a@b.co",
      value: 10,
    });
    expect(params).toEqual({ content_name: "google" });
    expect(dropped.sort()).toEqual(["email", "value"]);
  });

  it("drops an identifier-shaped value even under an allowed key", () => {
    const { params, dropped } = sanitizeMetaParams("Contact", {
      content_name: "owner@shop.in",
      content_category: "+91 98765 43210",
    });
    expect(params).toEqual({});
    expect(dropped.sort()).toEqual(["content_category", "content_name"]);
  });

  it("coerces value and num_items to numbers, refusing junk", () => {
    const ok = sanitizeMetaParams("Purchase", { value: "499", num_items: "1" });
    expect(ok.params).toEqual({ value: 499, num_items: 1 });
    const bad = sanitizeMetaParams("Purchase", { value: "lots" });
    expect(bad.params).toEqual({});
    expect(bad.dropped).toEqual(["value"]);
  });

  it("filters content_ids to plain strings that are not identifiers", () => {
    const { params, dropped } = sanitizeMetaParams("InitiateCheckout", {
      content_ids: ["yearly", "jd7f8a9s0dkf3h2g1lkj4mnb5v", 42 as unknown as string],
    });
    expect(params).toEqual({ content_ids: ["yearly"] });
    expect(dropped).toEqual(["content_ids[]"]);
  });

  it("drops a non-array content_ids", () => {
    const { params, dropped } = sanitizeMetaParams("Purchase", {
      content_ids: "yearly",
    });
    expect(params).toEqual({});
    expect(dropped).toEqual(["content_ids"]);
  });
});

describe("event builders", () => {
  it("Contact carries the cta id and location only", () => {
    expect(contactParams({ ctaId: "hero_start", location: "hero" })).toEqual({
      content_name: "hero_start",
      content_category: "hero",
    });
  });

  it("Lead carries the method only", () => {
    expect(leadParams("email_otp")).toEqual({ content_name: "email_otp" });
  });

  it("InitiateCheckout and Purchase describe the plan, in rupees", () => {
    const input = { plan: "yearly", amountPaise: 499900, currency: "INR" };
    const expected = {
      value: 4999,
      currency: "INR",
      content_ids: ["yearly"],
      content_name: "footfall yearly plan",
      content_type: "product",
      num_items: 1,
    };
    expect(initiateCheckoutParams(input)).toEqual(expected);
    expect(purchaseParams(input)).toEqual(expected);
  });

  it("the one-rupee production test reports ₹1, not the plan price", () => {
    expect(purchaseParams({ plan: "yearly", amountPaise: 100, currency: "INR" }).value).toBe(1);
  });
});

describe("fbq stub", () => {
  it("installs Meta's queueing stub once and reuses it", () => {
    withWindow((w) => {
      const first = ensureFbq(w as unknown as Window);
      expect(w.fbq).toBe(first);
      expect(w._fbq).toBe(first);
      expect(first.loaded).toBe(true);
      expect(first.version).toBe("2.0");
      expect(first.push).toBe(first);
      expect(ensureFbq(w as unknown as Window)).toBe(first);
    });
  });

  it("leaves an fbq that was already there alone", () => {
    withWindow((w) => {
      const existing = (() => {}) as unknown as Fbq;
      w.fbq = existing;
      expect(ensureFbq(w as unknown as Window)).toBe(existing);
    });
  });

  it("queues an arguments object until fbevents.js takes over", () => {
    withWindow((w) => {
      fbqPush("init", "2073667013518721");
      fbqPush("track", "PageView");
      const q = w.fbq!.queue;
      expect(q.length).toBe(2);
      expect(Array.isArray(q[0])).toBe(false);
      expect(q[0][0]).toBe("init");
      expect(q[0][1]).toBe("2073667013518721");
      expect(q[1][0]).toBe("track");
      expect(q[1][1]).toBe("PageView");
    });
  });

  it("hands commands to callMethod once the library has loaded", () => {
    withWindow((w) => {
      const stub = ensureFbq(w as unknown as Window);
      const seen: unknown[][] = [];
      stub.callMethod = (...args: unknown[]) => {
        seen.push(args);
      };
      fbqPush("track", "Lead", { content_name: "google" });
      expect(stub.queue.length).toBe(0);
      expect(seen).toEqual([["track", "Lead", { content_name: "google" }]]);
    });
  });
});

describe("metaEvent transport", () => {
  const original = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  afterEach(() => {
    setMetaTracking(false);
    if (original === undefined) delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    else process.env.NEXT_PUBLIC_META_PIXEL_ID = original;
  });

  it("queues nothing while tracking is off", () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "2073667013518721";
    setMetaTracking(false);
    expect(metaEvent("Lead", { content_name: "google" })).toBe(false);
  });

  it("queues nothing without a pixel id even when tracking is on", () => {
    // Unset, which is the same state as localhost: the switch is on, the
    // id is absent, and nothing may be sent.
    delete process.env.NEXT_PUBLIC_META_PIXEL_ID;
    setMetaTracking(true);
    expect(metaEvent("Lead", { content_name: "google" })).toBe(false);
  });

  it("sends a sanitised track command when allowed", () => {
    process.env.NEXT_PUBLIC_META_PIXEL_ID = "2073667013518721";
    setMetaTracking(true);
    withWindow((w) => {
      expect(
        metaEvent("Purchase", {
          value: 4999,
          currency: "INR",
          content_ids: ["yearly"],
          email: "owner@shop.in",
        }),
      ).toBe(true);
      const last = w.fbq!.queue[w.fbq!.queue.length - 1];
      expect(last[0]).toBe("track");
      expect(last[1]).toBe("Purchase");
      expect(last[2]).toEqual({ value: 4999, currency: "INR", content_ids: ["yearly"] });
    });
  });
});
