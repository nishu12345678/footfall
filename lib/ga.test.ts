import { describe, expect, it } from "vitest";
import {
  beginCheckoutParams,
  claimPurchase,
  ctaClickParams,
  datasetKeyToParam,
  gaEvent,
  gaPush,
  isGaEvent,
  looksLikeIdentifier,
  loginStartParams,
  paramsFromDataset,
  planItem,
  purchaseGuardKey,
  purchaseParams,
  sanitizeGaParams,
  setGaTracking,
} from "./ga";

/* The payload rules, not the wiring. Everything below is a pure function
   or a function with one injected store, because the question worth
   pinning down is "can a person's identity reach Google", and that answer
   must not depend on clicking around a page. */

describe("isGaEvent", () => {
  it("accepts exactly the four contract events", () => {
    for (const e of ["cta_click", "login_start", "begin_checkout", "purchase"]) {
      expect(isGaEvent(e)).toBe(true);
    }
  });

  it("refuses anything else, including GA's own automatic names", () => {
    for (const e of ["page_view", "sign_up", "add_to_cart", "", "purchase "]) {
      expect(isGaEvent(e)).toBe(false);
    }
  });
});

describe("looksLikeIdentifier", () => {
  it("catches the three things that must never be sent", () => {
    expect(looksLikeIdentifier("owner@example.com")).toBe(true);
    expect(looksLikeIdentifier("+91 93191 02143")).toBe(true);
    expect(looksLikeIdentifier("9319102143")).toBe(true);
    // A Convex document id.
    expect(looksLikeIdentifier("k1739sh2mn3q8xcv0zl4ptra")).toBe(true);
  });

  it("leaves the things the contract is made of alone", () => {
    expect(looksLikeIdentifier("hero_primary")).toBe(false);
    expect(looksLikeIdentifier("/app")).toBe(false);
    expect(looksLikeIdentifier("monthly")).toBe(false);
    expect(looksLikeIdentifier("INR")).toBe(false);
    // Razorpay ids are the transaction_id purchase is supposed to carry.
    expect(looksLikeIdentifier("order_PqR9sT7uVwXyZa")).toBe(false);
    expect(looksLikeIdentifier("pay_NabCdEfGhIjKlM")).toBe(false);
    expect(looksLikeIdentifier(1999)).toBe(false);
    expect(looksLikeIdentifier(undefined)).toBe(false);
  });
});

describe("sanitizeGaParams", () => {
  it("keeps only the parameters the event declares", () => {
    const { params, dropped } = sanitizeGaParams("cta_click", {
      cta_id: "hero_primary",
      location: "hero",
      destination: "/app",
      user_id: "k1739sh2mn3q8xcv0zl4ptra",
      email: "owner@example.com",
    });
    expect(params).toEqual({
      cta_id: "hero_primary",
      location: "hero",
      destination: "/app",
    });
    expect(dropped.sort()).toEqual(["email", "user_id"]);
  });

  it("drops an identifier even when its key is allowed", () => {
    const { params, dropped } = sanitizeGaParams("login_start", {
      method: "owner@example.com",
    });
    expect(params).toEqual({});
    expect(dropped).toEqual(["method"]);
  });

  it("never lets user_id through on any event", () => {
    for (const e of ["cta_click", "login_start", "begin_checkout", "purchase"] as const) {
      const { params } = sanitizeGaParams(e, { user_id: "abc" });
      expect(params.user_id).toBeUndefined();
    }
  });

  it("coerces money to a number and refuses nonsense", () => {
    expect(
      sanitizeGaParams("begin_checkout", { currency: "INR", value: "1999" })
        .params,
    ).toEqual({ currency: "INR", value: 1999 });
    expect(
      sanitizeGaParams("begin_checkout", { currency: "INR", value: "lots" })
        .params.value,
    ).toBeUndefined();
  });

  it("scrubs items entries down to the allowed keys", () => {
    const { params, dropped } = sanitizeGaParams("purchase", {
      transaction_id: "order_PqR9sT7uVwXyZa",
      currency: "INR",
      value: 1999,
      items: [
        {
          item_id: "monthly",
          item_name: "footfall monthly plan",
          // Not on the item allowlist — a business name must not travel.
          item_brand: "Sharma Bakery",
          price: 1999,
          quantity: 1,
        },
      ] as never,
    });
    expect(params.items).toEqual([
      {
        item_id: "monthly",
        item_name: "footfall monthly plan",
        price: 1999,
        quantity: 1,
      },
    ]);
    expect(dropped).toContain("items.item_brand");
  });

  it("drops an items entry whose identity fields are missing", () => {
    const { params } = sanitizeGaParams("purchase", {
      items: [{ price: 10 }] as never,
    });
    expect(params.items).toBeUndefined();
  });

  it("ignores null and undefined rather than sending them", () => {
    const { params, dropped } = sanitizeGaParams("cta_click", {
      cta_id: "nav_primary",
      location: "nav",
      destination: undefined as never,
    });
    expect(params).toEqual({ cta_id: "nav_primary", location: "nav" });
    expect(dropped).toEqual([]);
  });
});

describe("datasetKeyToParam", () => {
  it("turns the dataset camelCase back into GA snake_case", () => {
    expect(datasetKeyToParam("analyticsCtaId")).toBe("cta_id");
    expect(datasetKeyToParam("analyticsLocation")).toBe("location");
    expect(datasetKeyToParam("analyticsDestination")).toBe("destination");
    expect(datasetKeyToParam("analyticsTransactionId")).toBe("transaction_id");
  });

  it("refuses the event key itself and anything unrelated", () => {
    expect(datasetKeyToParam("analyticsEvent")).toBeNull();
    expect(datasetKeyToParam("analytics")).toBeNull();
    expect(datasetKeyToParam("testid")).toBeNull();
    expect(datasetKeyToParam("href")).toBeNull();
  });
});

describe("paramsFromDataset", () => {
  it("reads a CTA off the markup", () => {
    expect(
      paramsFromDataset({
        analyticsEvent: "cta_click",
        analyticsCtaId: "hero_primary",
        analyticsLocation: "hero",
        analyticsDestination: "/app",
      }),
    ).toEqual({
      event: "cta_click",
      params: {
        cta_id: "hero_primary",
        location: "hero",
        destination: "/app",
      },
    });
  });

  it("refuses an event name the contract does not have", () => {
    expect(
      paramsFromDataset({ analyticsEvent: "add_to_cart", analyticsCtaId: "x" }),
    ).toBeNull();
    expect(paramsFromDataset({})).toBeNull();
  });

  it("cannot widen the contract from markup", () => {
    const parsed = paramsFromDataset({
      analyticsEvent: "cta_click",
      analyticsCtaId: "pricing_monthly",
      analyticsLocation: "pricing",
      // Someone tries to attach identity in the HTML.
      analyticsUserId: "k1739sh2mn3q8xcv0zl4ptra",
      analyticsEmail: "owner@example.com",
    });
    expect(parsed?.params).toEqual({
      cta_id: "pricing_monthly",
      location: "pricing",
    });
  });
});

describe("event builders", () => {
  it("cta_click carries the three stable fields", () => {
    expect(
      ctaClickParams({ ctaId: "nav_login", location: "nav", destination: "/app/login" }),
    ).toEqual({ cta_id: "nav_login", location: "nav", destination: "/app/login" });
  });

  it("cta_click omits destination when there is none", () => {
    expect(ctaClickParams({ ctaId: "hero_whatsapp", location: "hero" })).toEqual({
      cta_id: "hero_whatsapp",
      location: "hero",
    });
  });

  it("login_start carries a method, never an identifier", () => {
    expect(loginStartParams("google")).toEqual({ method: "google" });
    expect(loginStartParams("email_otp")).toEqual({ method: "email_otp" });
    expect(loginStartParams("phone_otp")).toEqual({ method: "phone_otp" });
  });

  it("planItem is a plan, not a customer", () => {
    expect(planItem("yearly", 999900)).toEqual({
      item_id: "yearly",
      item_name: "footfall yearly plan",
      item_category: "subscription",
      price: 9999,
      quantity: 1,
    });
  });

  it("begin_checkout is the standard GA shape in rupees", () => {
    expect(
      beginCheckoutParams({ plan: "monthly", amountPaise: 199900, currency: "INR" }),
    ).toEqual({
      currency: "INR",
      value: 1999,
      items: [
        {
          item_id: "monthly",
          item_name: "footfall monthly plan",
          item_category: "subscription",
          price: 1999,
          quantity: 1,
        },
      ],
    });
  });

  it("purchase carries the Razorpay order id as transaction_id", () => {
    const p = purchaseParams({
      transactionId: "order_PqR9sT7uVwXyZa",
      plan: "yearly",
      amountPaise: 999900,
      currency: "INR",
    });
    expect(p.transaction_id).toBe("order_PqR9sT7uVwXyZa");
    expect(p.value).toBe(9999);
    expect(p.currency).toBe("INR");
  });

  it("the ₹1 production test price survives the paise conversion", () => {
    expect(
      beginCheckoutParams({ plan: "monthly", amountPaise: 100, currency: "INR" })
        .value,
    ).toBe(1);
  });
});

describe("claimPurchase", () => {
  function store() {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    };
  }

  it("reports a transaction once and refuses the repeat", () => {
    const s = store();
    expect(claimPurchase("order_A", s)).toBe(true);
    expect(claimPurchase("order_A", s)).toBe(false);
    expect(claimPurchase("order_A", s)).toBe(false);
  });

  it("treats a different order as a different sale", () => {
    const s = store();
    expect(claimPurchase("order_A", s)).toBe(true);
    expect(claimPurchase("order_B", s)).toBe(true);
  });

  it("namespaces the key so it cannot collide with app state", () => {
    expect(purchaseGuardKey("order_A")).toBe("ff_ga_purchase:order_A");
  });

  it("reports rather than loses the sale when storage is unusable", () => {
    expect(claimPurchase("order_A", null)).toBe(true);
    const hostile = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(claimPurchase("order_A", hostile)).toBe(true);
  });

  it("refuses an empty transaction id outright", () => {
    expect(claimPurchase("", store())).toBe(false);
  });
});

describe("gaEvent transport", () => {
  it("queues nothing while tracking is off", () => {
    setGaTracking(false);
    expect(gaEvent("cta_click", { cta_id: "x", location: "y" })).toBe(false);
  });

  it("queues nothing without a measurement id even when tracking is on", () => {
    // NEXT_PUBLIC_GA_ID is unset in the test environment, which is the
    // same state as localhost: the switch is on, the id is absent, and
    // nothing may be sent.
    setGaTracking(true);
    expect(gaEvent("cta_click", { cta_id: "x", location: "y" })).toBe(false);
    setGaTracking(false);
  });

  it("pushes an arguments object, not an array — gtag.js ignores arrays", () => {
    const w = globalThis as unknown as { window?: { dataLayer?: unknown[] } };
    const had = "window" in globalThis;
    if (!had) w.window = {};
    const before = w.window!.dataLayer?.length ?? 0;
    gaPush("event", "page_view", { page_path: "/" });
    const queue = w.window!.dataLayer!;
    expect(queue.length).toBe(before + 1);
    const pushed = queue[queue.length - 1] as IArguments;
    expect(Array.isArray(pushed)).toBe(false);
    expect(pushed[0]).toBe("event");
    expect(pushed[1]).toBe("page_view");
    if (!had) delete w.window;
  });
});
