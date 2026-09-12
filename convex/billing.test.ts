/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { isOneRupeeTester } from "./billing";

/**
 * The money paths that must never double or drift, exercised without
 * Razorpay: the same payment confirmed twice, a wrong amount, a failure
 * arriving after the capture, a redelivered webhook, and refunds.
 */

const modules = import.meta.glob("./**/*.ts");
const DAY = 24 * 60 * 60 * 1000;

type T = ReturnType<typeof convexTest<typeof schema.tables>>;

let t: T;
let userId: Id<"users">;

async function openOrder(orderId: string, plan: "monthly" | "yearly" = "monthly") {
  await t.mutation(internal.billing.recordPending, {
    userId,
    plan,
    amountPaise: plan === "monthly" ? 199_900 : 999_900,
    oneRupeeTest: false,
    razorpayOrderId: orderId,
  });
}

async function row(orderId: string) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("subscriptions")
      .withIndex("by_order", (q) => q.eq("razorpayOrderId", orderId))
      .first(),
  );
}

beforeEach(async () => {
  t = convexTest(schema, modules);
  userId = await t.run(async (ctx) => ctx.db.insert("users", { name: "owner" }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("one-rupee production testers", () => {
  test("matches only exact normalized emails", () => {
    const allowlist = " Alice@Example.com, bob@example.com\ncarol@example.com ";
    expect(isOneRupeeTester("alice@example.com", allowlist)).toBe(true);
    expect(isOneRupeeTester(" BOB@EXAMPLE.COM ", allowlist)).toBe(true);
    expect(isOneRupeeTester("mallory@example.com", allowlist)).toBe(false);
    expect(isOneRupeeTester("alice@example.com.evil.test", allowlist)).toBe(false);
    expect(isOneRupeeTester(null, allowlist)).toBe(false);
  });

  test("uses only a verified auth email", async () => {
    await t.run(async (ctx) => {
      await ctx.db.patch(userId, { email: " Tester@Example.com " });
    });
    expect(
      await t.query(internal.billing.verifiedEmailForUser, { userId }),
    ).toBeNull();

    await t.run(async (ctx) => {
      await ctx.db.patch(userId, { emailVerificationTime: Date.now() });
    });
    expect(
      await t.query(internal.billing.verifiedEmailForUser, { userId }),
    ).toBe("tester@example.com");
  });
});

describe("createOrder pricing authority", () => {
  test.each([
    {
      label: "verified allowlisted email",
      email: "TESTER@example.com",
      verified: true,
      expectedAmount: 100,
      expectedTest: true,
    },
    {
      label: "verified non-allowlisted email",
      email: "other@example.com",
      verified: true,
      expectedAmount: 199_900,
      expectedTest: false,
    },
    {
      label: "unverified allowlisted email",
      email: "tester@example.com",
      verified: false,
      expectedAmount: 199_900,
      expectedTest: false,
    },
  ])("uses the server price for $label", async ({
    email,
    verified,
    expectedAmount,
    expectedTest,
  }) => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_live_public_test");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "server-secret-never-returned");
    vi.stubEnv("RAZORPAY_ONE_RUPEE_TEST_EMAILS", "tester@example.com");

    await t.run(async (ctx) => {
      await ctx.db.patch(userId, {
        email,
        ...(verified ? { emailVerificationTime: Date.now() } : {}),
      });
    });

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body));
      expect(payload.amount).toBe(expectedAmount);
      expect(payload.notes.oneRupeeTest).toBe(expectedTest ? "true" : "false");
      return new Response(
        JSON.stringify({
          id: `order_${expectedTest ? "tester" : "regular"}`,
          amount: expectedAmount,
          currency: "INR",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const me = t.withIdentity({ subject: `${userId}|session` });
    const order = await me.action(api.billing.createOrder, { plan: "monthly" });

    expect(order.amountPaise).toBe(expectedAmount);
    expect(order.oneRupeeTest).toBe(expectedTest);
    expect(JSON.stringify(order)).not.toContain("server-secret-never-returned");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const stored = await row(order.orderId);
    expect(stored?.amountPaise).toBe(expectedAmount);
    expect(stored?.oneRupeeTest).toBe(expectedTest);
  });

  test("does not reuse a ₹1 order after the email leaves the allowlist", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_live_public_test");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "server-secret");
    vi.stubEnv("RAZORPAY_ONE_RUPEE_TEST_EMAILS", "tester@example.com");
    await t.run(async (ctx) => {
      await ctx.db.patch(userId, {
        email: "tester@example.com",
        emailVerificationTime: Date.now(),
      });
    });

    const amounts: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const payload = JSON.parse(String(init?.body));
        amounts.push(payload.amount);
        return new Response(
          JSON.stringify({
            id: `order_price_${payload.amount}`,
            amount: payload.amount,
            currency: "INR",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    );

    const me = t.withIdentity({ subject: `${userId}|session` });
    const discounted = await me.action(api.billing.createOrder, {
      plan: "monthly",
    });
    expect(discounted.amountPaise).toBe(100);

    vi.stubEnv("RAZORPAY_ONE_RUPEE_TEST_EMAILS", "");
    const regular = await me.action(api.billing.createOrder, { plan: "monthly" });
    expect(regular.amountPaise).toBe(199_900);
    expect(regular.reused).toBe(false);
    expect(amounts).toEqual([100, 199_900]);
  });
});

describe("markPaid", () => {
  test("a ₹1 webhook grants the full plan and a ₹1 refund ends it", async () => {
    await t.mutation(internal.billing.recordPending, {
      userId,
      plan: "yearly",
      amountPaise: 100,
      oneRupeeTest: true,
      razorpayOrderId: "order_test_1",
    });
    const captured = await t.action(internal.billing.handleWebhook, {
      eventId: "evt_test_capture",
      body: {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_test_1",
              order_id: "order_test_1",
              amount: 100,
              currency: "INR",
              status: "captured",
            },
          },
        },
      },
    });

    expect(captured).toBe("processed");
    let paid = await row("order_test_1");
    expect(paid?.status).toBe("paid");
    expect(paid?.amountPaise).toBe(100);
    expect(paid?.oneRupeeTest).toBe(true);
    expect(paid?.expiresAt).toBeGreaterThan(Date.now() + 364 * DAY);

    const refunded = await t.action(internal.billing.handleWebhook, {
      eventId: "evt_test_refund",
      body: {
        event: "refund.processed",
        payload: {
          refund: {
            entity: {
              id: "rfnd_test_1",
              payment_id: "pay_test_1",
              amount: 100,
              status: "processed",
            },
          },
        },
      },
    });
    expect(refunded).toBe("processed");
    paid = await row("order_test_1");
    expect(paid?.status).toBe("refunded");
    expect(paid?.refundedPaise).toBe(100);
    expect(paid?.expiresAt).toBeLessThanOrEqual(Date.now());
  });

  test("grants once, and a second confirmation is a no-op", async () => {
    await openOrder("order_1");
    const first = await t.mutation(internal.billing.markPaid, {
      razorpayOrderId: "order_1",
      razorpayPaymentId: "pay_1",
      amountPaise: 199_900,
      currency: "INR",
      confirmedBy: "browser",
    });
    expect(first).toEqual({ ok: true, already: false });

    const before = await row("order_1");
    expect(before?.status).toBe("paid");
    expect(before?.expiresAt).toBeGreaterThan(Date.now() + 29 * DAY);

    const second = await t.mutation(internal.billing.markPaid, {
      razorpayOrderId: "order_1",
      razorpayPaymentId: "pay_1",
      amountPaise: 199_900,
      currency: "INR",
      confirmedBy: "webhook",
    });
    expect(second).toEqual({ ok: true, already: true });

    const after = await row("order_1");
    expect(after?.expiresAt).toBe(before?.expiresAt);
    expect(after?.confirmedBy).toBe("browser");
  });

  test("a wrong amount or currency grants nothing and is held", async () => {
    await openOrder("order_2");
    const r = await t.mutation(internal.billing.markPaid, {
      razorpayOrderId: "order_2",
      razorpayPaymentId: "pay_2",
      amountPaise: 100,
      currency: "INR",
      confirmedBy: "webhook",
    });
    expect(r.ok).toBe(false);
    const s = await row("order_2");
    expect(s?.status).toBe("mismatch");
    expect(s?.expiresAt).toBeUndefined();

    await openOrder("order_2b");
    const c = await t.mutation(internal.billing.markPaid, {
      razorpayOrderId: "order_2b",
      razorpayPaymentId: "pay_2b",
      amountPaise: 199_900,
      currency: "USD",
      confirmedBy: "webhook",
    });
    expect(c.ok).toBe(false);
    expect((await row("order_2b"))?.status).toBe("mismatch");
  });

  test("paying early stacks on the current period", async () => {
    await openOrder("order_3");
    await t.mutation(internal.billing.markPaid, {
      razorpayOrderId: "order_3",
      razorpayPaymentId: "pay_3",
      amountPaise: 199_900,
      currency: "INR",
      confirmedBy: "browser",
    });
    const firstEnd = (await row("order_3"))!.expiresAt!;

    await openOrder("order_4");
    await t.mutation(internal.billing.markPaid, {
      razorpayOrderId: "order_4",
      razorpayPaymentId: "pay_4",
      amountPaise: 199_900,
      currency: "INR",
      confirmedBy: "webhook",
    });
    const second = await row("order_4");
    expect(second?.startsAt).toBe(firstEnd);
    expect(second?.expiresAt).toBe(firstEnd + 30 * DAY);
  });

  test("an unknown order is refused", async () => {
    const r = await t.mutation(internal.billing.markPaid, {
      razorpayOrderId: "order_nope",
      razorpayPaymentId: "pay_nope",
      amountPaise: 199_900,
      currency: "INR",
      confirmedBy: "webhook",
    });
    expect(r.ok).toBe(false);
  });
});

describe("out-of-order events", () => {
  test("a failure after the capture does not downgrade the order", async () => {
    await openOrder("order_5");
    await t.mutation(internal.billing.markPaid, {
      razorpayOrderId: "order_5",
      razorpayPaymentId: "pay_5",
      amountPaise: 199_900,
      currency: "INR",
      confirmedBy: "webhook",
    });
    await t.mutation(internal.billing.markAttemptFailed, {
      razorpayOrderId: "order_5",
      razorpayPaymentId: "pay_5_old",
      code: "BAD_REQUEST_ERROR",
      reason: "declined",
      source: "webhook",
    });
    await t.mutation(internal.billing.markAuthorized, {
      razorpayOrderId: "order_5",
      razorpayPaymentId: "pay_5",
    });
    expect((await row("order_5"))?.status).toBe("paid");
  });

  test("a failed attempt keeps the order open with the reason", async () => {
    await openOrder("order_6");
    await t.mutation(internal.billing.markAttemptFailed, {
      razorpayOrderId: "order_6",
      razorpayPaymentId: "pay_6a",
      code: "BAD_REQUEST_ERROR",
      reason: "Card declined",
      source: "checkout",
    });
    const s = await row("order_6");
    expect(s?.status).toBe("attempted");
    expect(s?.attempts).toBe(1);
    expect(s?.failureReason).toBe("Card declined");

    // The retry on the same order still lands.
    const r = await t.mutation(internal.billing.markPaid, {
      razorpayOrderId: "order_6",
      razorpayPaymentId: "pay_6b",
      amountPaise: 199_900,
      currency: "INR",
      confirmedBy: "browser",
    });
    expect(r.ok).toBe(true);
    expect((await row("order_6"))?.failureReason).toBeUndefined();
  });
});

describe("webhook idempotency", () => {
  test("the same event id is claimed once", async () => {
    const first = await t.mutation(internal.billing.claimEvent, {
      eventId: "evt_1",
      event: "payment.captured",
      razorpayOrderId: "order_x",
    });
    const second = await t.mutation(internal.billing.claimEvent, {
      eventId: "evt_1",
      event: "payment.captured",
      razorpayOrderId: "order_x",
    });
    expect(first).not.toBeNull();
    expect(second).toBeNull();
  });
});

describe("refunds", () => {
  async function paid(orderId: string, paymentId: string) {
    await openOrder(orderId);
    await t.mutation(internal.billing.markPaid, {
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentId,
      amountPaise: 199_900,
      currency: "INR",
      confirmedBy: "webhook",
    });
  }

  test("a partial refund keeps access; a full one ends it", async () => {
    await paid("order_7", "pay_7");

    await t.mutation(internal.billing.applyRefund, {
      razorpayRefundId: "rfnd_1",
      razorpayPaymentId: "pay_7",
      amountPaise: 50_000,
      status: "processed",
    });
    let s = await row("order_7");
    expect(s?.status).toBe("partially_refunded");
    expect(s?.refundedPaise).toBe(50_000);
    expect(s?.expiresAt).toBeGreaterThan(Date.now());

    await t.mutation(internal.billing.applyRefund, {
      razorpayRefundId: "rfnd_2",
      razorpayPaymentId: "pay_7",
      amountPaise: 149_900,
      status: "processed",
    });
    s = await row("order_7");
    expect(s?.status).toBe("refunded");
    expect(s?.refundedPaise).toBe(199_900);
    expect(s?.expiresAt).toBeLessThanOrEqual(Date.now());
  });

  test("a failed or pending refund changes nothing, and a repeat is idempotent", async () => {
    await paid("order_8", "pay_8");
    await t.mutation(internal.billing.applyRefund, {
      razorpayRefundId: "rfnd_3",
      razorpayPaymentId: "pay_8",
      amountPaise: 199_900,
      status: "created",
    });
    await t.mutation(internal.billing.applyRefund, {
      razorpayRefundId: "rfnd_3",
      razorpayPaymentId: "pay_8",
      amountPaise: 199_900,
      status: "failed",
    });
    const s = await row("order_8");
    expect(s?.status).toBe("paid");
    expect(s?.refundedPaise).toBeUndefined();

    await t.mutation(internal.billing.applyRefund, {
      razorpayRefundId: "rfnd_4",
      razorpayPaymentId: "pay_8",
      amountPaise: 199_900,
      status: "processed",
    });
    await t.mutation(internal.billing.applyRefund, {
      razorpayRefundId: "rfnd_4",
      razorpayPaymentId: "pay_8",
      amountPaise: 199_900,
      status: "processed",
    });
    const after = await row("order_8");
    expect(after?.status).toBe("refunded");
    expect(after?.refundedPaise).toBe(199_900);
    const refunds = await t.run(async (ctx) =>
      ctx.db
        .query("refunds")
        .withIndex("by_payment", (q) => q.eq("razorpayPaymentId", "pay_8"))
        .collect(),
    );
    expect(refunds).toHaveLength(2);
  });
});

describe("stale orders", () => {
  test("open orders older than a day are expired; fresh ones are not", async () => {
    await openOrder("order_9");
    await t.run(async (ctx) => {
      await ctx.db.insert("subscriptions", {
        userId,
        plan: "monthly",
        amountPaise: 199_900,
        currency: "INR",
        razorpayOrderId: "order_old",
        status: "created",
      });
    });
    // convex-test can't backdate _creationTime, so only the sweep's
    // "leave fresh ones alone" half is observable here.
    const r = await t.mutation(internal.billing.expireStaleOrders, {});
    expect(r.expired).toBe(0);
    expect((await row("order_9"))?.status).toBe("created");
  });
});
