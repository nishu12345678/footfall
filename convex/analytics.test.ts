/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import schema from "./schema";
import {
  dedupe,
  istDay,
  recordAnalyticsEvent,
  sanitizeMetadata,
} from "./analytics";
import { isAnalyticsAdminEmail } from "./access";
import { maskEmail, maskPhone } from "./adminDash";

/**
 * The product event ledger and the internal dashboard.
 *
 * The failures worth catching here are all silent ones: a count that
 * doubles when a webhook is redelivered, revenue recorded for a payment
 * that was never granted, an aggregate that drifts from the events it
 * summarises, a non-admin reading the customer table, and an email or a
 * review body ending up in an analytics row.
 */

const modules = import.meta.glob("./**/*.ts");

type T = ReturnType<typeof convexTest<typeof schema.tables>>;

let t: T;
let userId: Id<"users">;

async function seedBusiness(name = "The Mocha Club"): Promise<Id<"businesses">> {
  return await t.run(async (ctx) =>
    ctx.db.insert("businesses", {
      userId,
      orgName: name,
      city: "Meerut",
      gbpLocationName: `locations/${name}`,
      onboardingStep: 2,
      onboardingComplete: false,
      agentActive: false,
    }),
  );
}

async function selectBusiness(businessId: Id<"businesses">) {
  await t.run(async (ctx) => {
    const sel = await ctx.db
      .query("businessSelections")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (sel) await ctx.db.patch(sel._id, { businessId });
    else await ctx.db.insert("businessSelections", { userId, businessId });
  });
}

/** A plan that grants access, so the paid* wrappers let mutations through. */
async function grantPlan(businessId: Id<"businesses">) {
  await t.run(async (ctx) => {
    await ctx.db.insert("subscriptions", {
      userId,
      businessId,
      plan: "monthly",
      amountPaise: 199_900,
      currency: "INR",
      razorpayOrderId: `order_grant_${businessId}`,
      status: "paid",
      paidAt: Date.now(),
      startsAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });
  });
}

async function events(event?: string): Promise<Doc<"analyticsEvents">[]> {
  return await t.run(async (ctx) => {
    const all = await ctx.db.query("analyticsEvents").collect();
    return event ? all.filter((r) => r.event === event) : all;
  });
}

async function totalFor(event: string) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("analyticsTotals")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .withIndex("by_event", (q) => q.eq("event", event as any))
      .first(),
  );
}

async function dailyRows() {
  return await t.run(async (ctx) => ctx.db.query("analyticsDaily").collect());
}

const me = () => t.withIdentity({ subject: `${userId}|session` });

beforeEach(async () => {
  t = convexTest(schema, modules);
  userId = await t.run(async (ctx) => ctx.db.insert("users", { name: "owner" }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

/* ------------------------------- the writer ------------------------------ */

describe("recordAnalyticsEvent", () => {
  test("writes once and folds into both aggregates", async () => {
    const businessId = await seedBusiness();
    const result = await t.run(async (ctx) =>
      recordAnalyticsEvent(ctx, {
        event: "business_connected",
        dedupeKey: dedupe.businessConnected(businessId),
        source: "owner",
        userId,
        businessId,
      }),
    );
    expect(result.recorded).toBe(true);

    const rows = await events("business_connected");
    expect(rows).toHaveLength(1);
    expect(rows[0].day).toBe(istDay(rows[0].occurredAt));

    expect((await totalFor("business_connected"))?.count).toBe(1);
    const daily = await dailyRows();
    expect(daily).toHaveLength(1);
    expect(daily[0].count).toBe(1);
  });

  test("the same dedupeKey never doubles a count or an aggregate", async () => {
    const businessId = await seedBusiness();
    const write = () =>
      t.run(async (ctx) =>
        recordAnalyticsEvent(ctx, {
          event: "payment_succeeded",
          dedupeKey: dedupe.paymentSucceeded("order_x"),
          source: "system",
          userId,
          businessId,
          amountPaise: 199_900,
          currency: "INR",
        }),
      );

    const first = await write();
    const second = await write();
    const third = await write();

    expect(first.recorded).toBe(true);
    expect(second.recorded).toBe(false);
    expect(third.recorded).toBe(false);
    // A duplicate points at the row that already exists, not at nothing.
    expect(second.eventId).toBe(first.eventId);

    expect(await events("payment_succeeded")).toHaveLength(1);
    const totals = await totalFor("payment_succeeded");
    expect(totals?.count).toBe(1);
    // The money must not double either — this is the whole point.
    expect(totals?.amountPaise).toBe(199_900);
    const daily = await dailyRows();
    expect(daily[0].count).toBe(1);
    expect(daily[0].amountPaise).toBe(199_900);
  });

  test("aggregates stay equal to the events they summarise", async () => {
    const businessId = await seedBusiness();
    const day = new Date("2026-03-04T08:00:00Z").getTime();
    const other = new Date("2026-03-05T08:00:00Z").getTime();

    await t.run(async (ctx) => {
      for (const [i, at] of [day, day, other].entries()) {
        await recordAnalyticsEvent(ctx, {
          event: "payment_succeeded",
          dedupeKey: dedupe.paymentSucceeded(`order_${i}`),
          source: "system",
          occurredAt: at,
          userId,
          businessId,
          amountPaise: 100_000,
          currency: "INR",
        });
      }
    });

    const rows = await events("payment_succeeded");
    const daily = await dailyRows();
    expect(rows).toHaveLength(3);
    expect(daily).toHaveLength(2);
    expect(daily.reduce((s, r) => s + r.count, 0)).toBe(rows.length);
    expect(daily.reduce((s, r) => s + r.amountPaise, 0)).toBe(300_000);

    const totals = await totalFor("payment_succeeded");
    expect(totals?.count).toBe(3);
    expect(totals?.amountPaise).toBe(300_000);
    expect(totals?.firstOccurredAt).toBe(day);
    expect(totals?.lastOccurredAt).toBe(other);
  });

  test("an out-of-order backfill widens the first/last window", async () => {
    const businessId = await seedBusiness();
    const late = new Date("2026-06-01T08:00:00Z").getTime();
    const early = new Date("2025-01-01T08:00:00Z").getTime();

    await t.run(async (ctx) => {
      await recordAnalyticsEvent(ctx, {
        event: "account_created",
        dedupeKey: "a",
        source: "owner",
        occurredAt: late,
        userId,
        businessId,
      });
      await recordAnalyticsEvent(ctx, {
        event: "account_created",
        dedupeKey: "b",
        source: "backfill",
        occurredAt: early,
        userId,
        businessId,
      });
    });

    const totals = await totalFor("account_created");
    expect(totals?.firstOccurredAt).toBe(early);
    expect(totals?.lastOccurredAt).toBe(late);
  });

  test("an empty dedupeKey is refused rather than counted", async () => {
    const result = await t.run(async (ctx) =>
      recordAnalyticsEvent(ctx, {
        event: "account_created",
        dedupeKey: "   ",
        source: "owner",
        userId,
      }),
    );
    expect(result).toEqual({ recorded: false, eventId: null });
    expect(await events()).toHaveLength(0);
  });

  test("a negative or fractional amount is normalised, never stored raw", async () => {
    await t.run(async (ctx) => {
      await recordAnalyticsEvent(ctx, {
        event: "payment_succeeded",
        dedupeKey: "neg",
        source: "system",
        userId,
        amountPaise: -500,
        currency: "INR",
      });
      await recordAnalyticsEvent(ctx, {
        event: "payment_refunded",
        dedupeKey: "frac",
        source: "system",
        userId,
        amountPaise: 1234.6,
        currency: "INR",
      });
    });

    const rows = await events();
    const byEvent = Object.fromEntries(rows.map((r) => [r.event, r]));
    expect(byEvent.payment_succeeded.amountPaise).toBe(0);
    expect(byEvent.payment_refunded.amountPaise).toBe(1235);
  });
});

/* -------------------------------- privacy -------------------------------- */

describe("no PII reaches the ledger", () => {
  test("sanitizeMetadata keeps only allowlisted scalar keys", () => {
    const cleaned = sanitizeMetadata({
      kind: "post",
      step: 3,
      full: true,
      // Every one of these must be dropped: they are the exact fields
      // docs/product-analytics.md forbids.
      email: "owner@example.com",
      phone: "+919319102143",
      orgName: "The Mocha Club",
      address: "12 Abu Lane, Meerut",
      reviewText: "The coffee was cold and the staff were rude.",
      accessToken: "ya29.a0Af...",
      razorpaySignature: "deadbeef",
      providerResponse: "{...}",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(cleaned).toEqual({ kind: "post", step: 3, full: true });
  });

  test("forbidden keys cannot survive a real write", async () => {
    await t.run(async (ctx) =>
      recordAnalyticsEvent(ctx, {
        event: "account_created",
        dedupeKey: "pii",
        source: "owner",
        userId,
        metadata: {
          plan: "monthly",
          email: "owner@example.com",
          reviewText: "cold coffee",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      }),
    );

    const [row] = await events();
    expect(row.metadata).toEqual({ plan: "monthly" });
    const serialised = JSON.stringify(row);
    expect(serialised).not.toContain("owner@example.com");
    expect(serialised).not.toContain("cold coffee");
  });

  test("a long free-form value is truncated even on an allowed key", () => {
    const cleaned = sanitizeMetadata({ errorClass: "x".repeat(500) });
    expect((cleaned?.errorClass as string).length).toBe(64);
  });

  test("metadata is dropped entirely when nothing survives", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(sanitizeMetadata({ email: "a@b.com" } as any)).toBeUndefined();
    expect(sanitizeMetadata(undefined)).toBeUndefined();
  });

  test("masking shows enough to recognise and not enough to contact", () => {
    expect(maskEmail("owner@example.com")).toBe("o•••r@example.com");
    expect(maskEmail(undefined)).toBeNull();
    expect(maskPhone("+919319102143")).toBe("+91•••••2143");
    expect(maskPhone(undefined)).toBeNull();
    // The full local part and the middle digits never appear.
    expect(maskEmail("owner@example.com")).not.toContain("owner");
    expect(maskPhone("+919319102143")).not.toContain("93191");
  });
});

/* ----------------------------- admin auth -------------------------------- */

describe("dashboard authorization", () => {
  test("matches only exact, normalized emails", () => {
    const list = " Admin@Example.com, ops@example.com ";
    expect(isAnalyticsAdminEmail("admin@example.com", list)).toBe(true);
    expect(isAnalyticsAdminEmail(" OPS@EXAMPLE.COM ", list)).toBe(true);
    expect(isAnalyticsAdminEmail("admin@example.com.evil.test", list)).toBe(false);
    expect(isAnalyticsAdminEmail("mallory@example.com", list)).toBe(false);
    expect(isAnalyticsAdminEmail("admin@example.com", "")).toBe(false);
    expect(isAnalyticsAdminEmail(null, list)).toBe(false);
  });

  test("a signed-out caller is refused with Not found", async () => {
    vi.stubEnv("ANALYTICS_ADMIN_EMAILS", "admin@example.com");
    await expect(
      t.query(api.adminDash.overview, { days: 30, now: Date.now() }),
    ).rejects.toThrow("Not found.");
    await expect(
      t.query(api.adminDash.recentEvents, {}),
    ).rejects.toThrow("Not found.");
  });

  test("an ordinary signed-in owner is refused with Not found", async () => {
    vi.stubEnv("ANALYTICS_ADMIN_EMAILS", "admin@example.com");
    await t.run(async (ctx) => {
      await ctx.db.patch(userId, {
        email: "shopowner@example.com",
        emailVerificationTime: Date.now(),
      });
    });

    await expect(
      me().query(api.adminDash.overview, { days: 7, now: Date.now() }),
    ).rejects.toThrow("Not found.");
    await expect(
      me().query(api.adminDash.businesses, {
        paginationOpts: { numItems: 10, cursor: null },
        now: Date.now(),
      }),
    ).rejects.toThrow("Not found.");
  });

  test("an UNVERIFIED allowlisted email is refused", async () => {
    // The sign-up flow lets an account carry an email it has not proved,
    // so verification is what makes the allowlist an authorisation.
    vi.stubEnv("ANALYTICS_ADMIN_EMAILS", "admin@example.com");
    await t.run(async (ctx) => {
      await ctx.db.patch(userId, { email: "admin@example.com" });
    });

    expect(await me().query(api.adminDash.me, {})).toEqual({
      signedIn: true,
      isAdmin: false,
    });
    await expect(
      me().query(api.adminDash.overview, { days: 7, now: Date.now() }),
    ).rejects.toThrow("Not found.");
  });

  test("a verified allowlisted email gets in", async () => {
    vi.stubEnv("ANALYTICS_ADMIN_EMAILS", "admin@example.com");
    await t.run(async (ctx) => {
      await ctx.db.patch(userId, {
        email: "Admin@Example.com",
        emailVerificationTime: Date.now(),
      });
    });

    expect(await me().query(api.adminDash.me, {})).toEqual({
      signedIn: true,
      isAdmin: true,
    });
    const overview = await me().query(api.adminDash.overview, {
      days: 30,
      now: Date.now(),
    });
    expect(overview.days).toBe(30);
  });

  test("emptying the allowlist locks everyone out, including a verified email", async () => {
    vi.stubEnv("ANALYTICS_ADMIN_EMAILS", "");
    await t.run(async (ctx) => {
      await ctx.db.patch(userId, {
        email: "admin@example.com",
        emailVerificationTime: Date.now(),
      });
    });
    await expect(
      me().query(api.adminDash.overview, { days: 7, now: Date.now() }),
    ).rejects.toThrow("Not found.");
  });

  test("me answers a signed-out browser without throwing", async () => {
    expect(await t.query(api.adminDash.me, {})).toEqual({
      signedIn: false,
      isAdmin: false,
    });
  });
});

/* ------------------------- payment idempotency --------------------------- */

describe("payment_succeeded is emitted only where a period was granted", () => {
  async function openOrder(orderId: string, businessId: Id<"businesses">) {
    await t.mutation(internal.billing.recordPending, {
      userId,
      plan: "monthly",
      amountPaise: 199_900,
      oneRupeeTest: false,
      razorpayOrderId: orderId,
      businessId,
    });
  }

  test("the browser and the webhook racing produce one event", async () => {
    const businessId = await seedBusiness();
    await openOrder("order_race", businessId);

    const first = await t.mutation(internal.billing.markPaid, {
      razorpayOrderId: "order_race",
      razorpayPaymentId: "pay_race",
      amountPaise: 199_900,
      currency: "INR",
      confirmedBy: "browser",
    });
    const second = await t.mutation(internal.billing.markPaid, {
      razorpayOrderId: "order_race",
      razorpayPaymentId: "pay_race",
      amountPaise: 199_900,
      currency: "INR",
      confirmedBy: "webhook",
    });

    expect(first).toEqual({ ok: true, already: false });
    expect(second).toEqual({ ok: true, already: true });

    const paid = await events("payment_succeeded");
    expect(paid).toHaveLength(1);
    expect(paid[0].amountPaise).toBe(199_900);
    expect(paid[0].currency).toBe("INR");
    // The winner's path is recorded, not the loser's.
    expect(paid[0].metadata).toMatchObject({
      plan: "monthly",
      confirmedBy: "browser",
    });
    expect((await totalFor("payment_succeeded"))?.amountPaise).toBe(199_900);
  });

  test("an amount mismatch grants nothing and records no revenue", async () => {
    const businessId = await seedBusiness();
    await openOrder("order_bad", businessId);

    const r = await t.mutation(internal.billing.markPaid, {
      razorpayOrderId: "order_bad",
      razorpayPaymentId: "pay_bad",
      amountPaise: 100,
      currency: "INR",
      confirmedBy: "webhook",
    });

    expect(r.ok).toBe(false);
    expect(await events("payment_succeeded")).toHaveLength(0);
    expect(await totalFor("payment_succeeded")).toBeNull();
  });

  test("a currency mismatch records no revenue", async () => {
    const businessId = await seedBusiness();
    await openOrder("order_usd", businessId);
    await t.mutation(internal.billing.markPaid, {
      razorpayOrderId: "order_usd",
      razorpayPaymentId: "pay_usd",
      amountPaise: 199_900,
      currency: "USD",
      confirmedBy: "webhook",
    });
    expect(await events("payment_succeeded")).toHaveLength(0);
  });

  test("a payment for an unknown order records nothing", async () => {
    await t.mutation(internal.billing.markPaid, {
      razorpayOrderId: "order_ghost",
      razorpayPaymentId: "pay_ghost",
      amountPaise: 199_900,
      currency: "INR",
      confirmedBy: "webhook",
    });
    expect(await events("payment_succeeded")).toHaveLength(0);
  });

  test("opening an order records checkout_started once, with no money", async () => {
    const businessId = await seedBusiness();
    await openOrder("order_ck", businessId);

    const started = await events("checkout_started");
    expect(started).toHaveLength(1);
    // Intent is not revenue. An opened order must not appear as money.
    expect(started[0].amountPaise).toBeUndefined();
    expect(started[0].metadata).toEqual({ plan: "monthly" });
  });

  test("dismissing checkout repeatedly counts one abandonment", async () => {
    const businessId = await seedBusiness();
    await selectBusiness(businessId);
    await openOrder("order_dismiss", businessId);

    await me().mutation(api.billing.noteDismissed, { orderId: "order_dismiss" });
    await me().mutation(api.billing.noteDismissed, { orderId: "order_dismiss" });
    await me().mutation(api.billing.noteDismissed, { orderId: "order_dismiss" });

    expect(await events("checkout_dismissed")).toHaveLength(1);
  });

  test("a stranger cannot dismiss someone else's order", async () => {
    const businessId = await seedBusiness();
    await openOrder("order_theirs", businessId);

    const strangerId = await t.run(async (ctx) =>
      ctx.db.insert("users", { name: "stranger" }),
    );
    await t
      .withIdentity({ subject: `${strangerId}|session` })
      .mutation(api.billing.noteDismissed, { orderId: "order_theirs" });

    expect(await events("checkout_dismissed")).toHaveLength(0);
  });

  test("a declined attempt records an error class, never the reason text", async () => {
    const businessId = await seedBusiness();
    await openOrder("order_fail", businessId);

    await t.mutation(internal.billing.markAttemptFailed, {
      razorpayOrderId: "order_fail",
      razorpayPaymentId: "pay_fail",
      code: "BAD_REQUEST_ERROR",
      reason: "Card of Mr R Sharma ending 4242 was declined by HDFC Bank",
      source: "webhook",
    });

    const failed = await events("checkout_failed");
    expect(failed).toHaveLength(1);
    expect(failed[0].metadata).toMatchObject({ errorClass: "BAD_REQUEST_ERROR" });
    expect(JSON.stringify(failed[0])).not.toContain("Sharma");
    expect(JSON.stringify(failed[0])).not.toContain("HDFC");
  });

  test("a refund is recorded once per refund id and only when processed", async () => {
    const businessId = await seedBusiness();
    await openOrder("order_ref", businessId);
    await t.mutation(internal.billing.markPaid, {
      razorpayOrderId: "order_ref",
      razorpayPaymentId: "pay_ref",
      amountPaise: 199_900,
      currency: "INR",
      confirmedBy: "webhook",
    });

    // Created: money has not moved yet.
    await t.mutation(internal.billing.applyRefund, {
      razorpayRefundId: "rfnd_1",
      razorpayPaymentId: "pay_ref",
      amountPaise: 199_900,
      status: "created",
    });
    expect(await events("payment_refunded")).toHaveLength(0);

    // Processed, then a redelivery of the same event.
    await t.mutation(internal.billing.applyRefund, {
      razorpayRefundId: "rfnd_1",
      razorpayPaymentId: "pay_ref",
      amountPaise: 199_900,
      status: "processed",
    });
    await t.mutation(internal.billing.applyRefund, {
      razorpayRefundId: "rfnd_1",
      razorpayPaymentId: "pay_ref",
      amountPaise: 199_900,
      status: "processed",
    });

    const refunds = await events("payment_refunded");
    expect(refunds).toHaveLength(1);
    expect(refunds[0].amountPaise).toBe(199_900);
    expect(refunds[0].metadata).toMatchObject({ full: true });
    expect((await totalFor("payment_refunded"))?.amountPaise).toBe(199_900);
  });
});

/* ---------------------------- funnel milestones -------------------------- */

describe("key milestones are instrumented at the fact", () => {
  test("starting a Google connect keys analytics by a non-secret attempt id", async () => {
    const token: string = await me().mutation(api.google.startLink, {
      returnTo: "/app/connect",
      codeVerifier: "verifier",
    });
    const attempt = await t.run(async (ctx) =>
      ctx.db
        .query("googleLinkTokens")
        .withIndex("by_token", (q) => q.eq("token", token))
        .first(),
    );
    expect(attempt).not.toBeNull();

    const started = await events("gbp_connect_started");
    expect(started).toHaveLength(1);
    expect(started[0].dedupeKey).toBe(
      dedupe.gbpConnectStarted(attempt!._id),
    );
    expect(started[0].dedupeKey).not.toContain(token);
    expect(started[0].userId).toBe(userId);
    // Neither the OAuth state credential nor PKCE verifier is analytics data.
    expect(JSON.stringify(started[0])).not.toContain("verifier");
    expect(JSON.stringify(started[0])).not.toContain(token);
  });

  test("a failed connect records only an error class, once per attempt", async () => {
    const attemptId = await t.run(async (ctx) =>
      ctx.db.insert("googleLinkTokens", {
        userId,
        token: "tok_1",
        codeVerifier: "verifier",
        returnTo: "/app/connect",
        expiresAt: Date.now() + 60_000,
      }),
    );
    await t.mutation(internal.google.noteConnectFailed, {
      attemptId,
      errorClass: "token_exchange_failed",
      userId,
    });
    await t.mutation(internal.google.noteConnectFailed, {
      attemptId,
      errorClass: "token_exchange_failed",
      userId,
    });

    const failed = await events("gbp_connect_failed");
    expect(failed).toHaveLength(1);
    expect(failed[0].metadata).toEqual({ errorClass: "token_exchange_failed" });
    expect(failed[0].dedupeKey).not.toContain("tok_1");
    expect(JSON.stringify(failed[0])).not.toContain("verifier");
  });

  test("connecting a listing records one connection, however often it is linked", async () => {
    const location = (name: string) => ({
      name,
      title: "The Mocha Club",
      accountName: "accounts/1",
      city: "Meerut",
    });

    const businessId: Id<"businesses"> = await t.mutation(
      internal.google.createBusinessFromLocation,
      { userId, location: location("locations/1") },
    );
    // Linking the same live listing again is a refresh, not a connection.
    await t.mutation(internal.google.createBusinessFromLocation, {
      userId,
      location: location("locations/1"),
    });

    const connected = await events("business_connected");
    expect(connected).toHaveLength(1);
    expect(connected[0].businessId).toBe(businessId);
    // The shop's name and city stay out of the ledger.
    expect(JSON.stringify(connected[0])).not.toContain("Mocha");
    expect(await events("business_reconnected")).toHaveLength(0);
  });

  test("reconnecting after a disconnect is its own event", async () => {
    const location = (name: string) => ({
      name,
      title: "The Mocha Club",
      accountName: "accounts/1",
    });

    const businessId: Id<"businesses"> = await t.mutation(
      internal.google.createBusinessFromLocation,
      { userId, location: location("locations/1") },
    );
    await t.mutation(internal.google.forgetAccount, { userId });
    await t.mutation(internal.google.createBusinessFromLocation, {
      userId,
      location: location("locations/1"),
    });

    const reconnected = await events("business_reconnected");
    expect(reconnected).toHaveLength(1);
    expect(reconnected[0].businessId).toBe(businessId);
    // Still exactly one connection — a reconnect is not a new customer.
    expect(await events("business_connected")).toHaveLength(1);
  });

  test("onboarding steps record once each, and re-editing changes nothing", async () => {
    const businessId = await seedBusiness();
    await selectBusiness(businessId);
    await grantPlan(businessId);

    await me().mutation(api.businesses.updateLocation, { orgName: "Mocha" });
    await me().mutation(api.about.complete, {});
    await me().mutation(api.gbp.complete, {});
    await me().mutation(api.branding.finishOnboarding, {});

    // The owner goes back and edits step 2 and step 5 again.
    await me().mutation(api.businesses.updateLocation, { orgName: "Mocha Club" });
    await me().mutation(api.branding.finishOnboarding, {});

    const steps = await events("onboarding_step_completed");
    expect(steps.map((r) => r.metadata?.step).sort()).toEqual([2, 3, 4, 5]);
    expect(await events("onboarding_completed")).toHaveLength(1);
    // The trading name the owner typed is not analytics data.
    expect(JSON.stringify(steps)).not.toContain("Mocha");
  });

  test("a published post is first value; a Google-imported one is not", async () => {
    const businessId = await seedBusiness();

    const ours = await t.run(async (ctx) =>
      ctx.db.insert("posts", {
        businessId,
        body: "Fresh filter coffee from 7am, every day.",
        status: "approved",
        generatedBy: "ai",
      }),
    );
    await t.mutation(internal.posts.markPublished, {
      id: ours,
      gbpPostName: "localPosts/1",
    });
    // A retried mark must not publish twice.
    await t.mutation(internal.posts.markPublished, {
      id: ours,
      gbpPostName: "localPosts/1",
    });

    const published = await events("content_published");
    expect(published).toHaveLength(1);
    expect(published[0].metadata).toMatchObject({
      kind: "post",
      generatedBy: "ai",
    });
    // The post body never leaves the posts table.
    expect(JSON.stringify(published[0])).not.toContain("filter coffee");

    // The Google mirror inserts published rows directly and must stay out.
    await t.mutation(internal.posts.saveGooglePosts, {
      businessId,
      posts: [
        {
          gbpPostName: "localPosts/theirs",
          body: "Their own old post",
          publishedAt: Date.now() - 86_400_000,
        },
      ],
    });
    expect(await events("content_published")).toHaveLength(1);
  });

  test("a failed publish records nothing", async () => {
    const businessId = await seedBusiness();
    const postId = await t.run(async (ctx) =>
      ctx.db.insert("posts", {
        businessId,
        body: "body",
        status: "approved",
        generatedBy: "ai",
      }),
    );
    await t.mutation(internal.posts.markPublished, {
      id: postId,
      error: "Google refused (400): something",
    });
    expect(await events("content_published")).toHaveLength(0);
  });

  test("a published photo and a published reply are both first value", async () => {
    const businessId = await seedBusiness();

    const photoId = await t.run(async (ctx) =>
      ctx.db.insert("photos", {
        businessId,
        url: "https://example.test/a.jpg",
        caption: "Our counter",
        status: "scheduled",
      }),
    );
    await t.mutation(internal.photos.markPhotoPublished, { id: photoId });

    const reviewId = await t.run(async (ctx) =>
      ctx.db.insert("reviews", {
        businessId,
        authorName: "Rahul Sharma",
        rating: 5,
        comment: "Best coffee in Meerut",
        createdAt: Date.now(),
        replyStatus: "drafted",
      }),
    );
    await t.mutation(internal.reviews.markReplied, {
      id: reviewId,
      replyText: "Thank you Rahul, see you soon!",
    });

    const published = await events("content_published");
    expect(published.map((r) => r.metadata?.kind).sort()).toEqual([
      "photo",
      "review_reply",
    ]);
    // Neither the reviewer's name, their review, nor our reply is stored.
    const serialised = JSON.stringify(published);
    expect(serialised).not.toContain("Rahul");
    expect(serialised).not.toContain("Best coffee");
    expect(serialised).not.toContain("see you soon");
  });

  test("a generation run records one content_generated with its count", async () => {
    const businessId = await seedBusiness();
    const runId = await t.mutation(internal.posts.openRun, {
      businessId,
      userId,
      mode: "plan",
      requested: 3,
      source: "cron",
    });

    // Heartbeats while running record nothing.
    await t.mutation(internal.posts.touchRun, { id: runId, produced: 1 });
    await t.mutation(internal.posts.touchRun, { id: runId, produced: 2 });
    expect(await events("content_generated")).toHaveLength(0);

    await t.mutation(internal.posts.touchRun, {
      id: runId,
      produced: 3,
      status: "done",
    });
    // A retried finish must not double it.
    await t.mutation(internal.posts.touchRun, {
      id: runId,
      produced: 3,
      status: "done",
    });

    const generated = await events("content_generated");
    expect(generated).toHaveLength(1);
    expect(generated[0].source).toBe("agent");
    expect(generated[0].metadata).toMatchObject({ kind: "post", count: 3 });
  });

  test("a run that produced nothing is not a generation", async () => {
    const businessId = await seedBusiness();
    const runId = await t.mutation(internal.posts.openRun, {
      businessId,
      userId,
      mode: "plan",
      requested: 3,
      source: "owner",
    });
    await t.mutation(internal.posts.touchRun, {
      id: runId,
      produced: 0,
      status: "failed",
      error: "Couldn't write a post just now.",
    });
    expect(await events("content_generated")).toHaveLength(0);
  });

  test("publishing a site counts once however often it is toggled", async () => {
    const businessId = await seedBusiness();
    await selectBusiness(businessId);

    await t.mutation(internal.site.saveSite, {
      businessId,
      slug: "the-mocha-club",
      headline: "Filter coffee in Meerut",
      about: "About us",
      services: [],
      faqs: [],
      metaTitle: "The Mocha Club",
      metaDescription: "Coffee",
    });
    expect(await events("site_published")).toHaveLength(1);

    await me().mutation(api.site.setPublished, { published: false });
    await me().mutation(api.site.setPublished, { published: true });
    await me().mutation(api.site.setPublished, { published: true });

    expect(await events("site_published")).toHaveLength(1);
  });

  test("a completed listing read records one audit per business per day", async () => {
    const businessId = await seedBusiness();
    await selectBusiness(businessId);

    await t.mutation(internal.audit.stampSynced, { userId });
    await t.mutation(internal.audit.stampSynced, { userId });

    const audits = await events("audit_completed");
    expect(audits).toHaveLength(1);
    expect(audits[0].businessId).toBe(businessId);
  });
});

/* -------------------------------- backfill ------------------------------- */

describe("backfill", () => {
  test("derives only trustworthy facts and is idempotent", async () => {
    const now = Date.now();
    const businessId = await t.run(async (ctx) =>
      ctx.db.insert("businesses", {
        userId,
        orgName: "The Mocha Club",
        gbpLocationName: "locations/1",
        onboardingStep: 6,
        onboardingComplete: true,
        agentActive: true,
        agentStartedAt: now - 10 * 86_400_000,
      }),
    );

    await t.run(async (ctx) => {
      await ctx.db.insert("subscriptions", {
        userId,
        businessId,
        plan: "monthly",
        amountPaise: 199_900,
        currency: "INR",
        razorpayOrderId: "order_old",
        razorpayPaymentId: "pay_old",
        status: "paid",
        paidAt: now - 9 * 86_400_000,
        expiresAt: now + 20 * 86_400_000,
      });
      // Ours, and theirs.
      await ctx.db.insert("posts", {
        businessId,
        body: "ours",
        status: "published",
        publishedAt: now - 5 * 86_400_000,
        generatedBy: "ai",
      });
      await ctx.db.insert("posts", {
        businessId,
        body: "theirs",
        status: "published",
        publishedAt: now - 300 * 86_400_000,
        generatedBy: "google",
      });
      // An upload of ours, and a mirror of Google's gallery.
      const storageId = await ctx.storage.store(new Blob(["x"]));
      await ctx.db.insert("photos", {
        businessId,
        storageId,
        url: "https://example.test/ours.jpg",
        status: "published",
        publishedAt: now - 4 * 86_400_000,
      });
      await ctx.db.insert("photos", {
        businessId,
        url: "https://example.test/mirror.jpg",
        status: "published",
        publishedAt: now - 4 * 86_400_000,
      });
    });

    const run = async () => {
      let next: { phase: string; done: boolean } | null = {
        phase: "users",
        done: false,
      };
      const phases = [
        "users",
        "businesses",
        "subscriptions",
        "refunds",
        "posts",
        "photos",
        "reviews",
      ] as const;
      for (const phase of phases) {
        // Driven directly rather than through the scheduler so the test
        // observes each phase; the production path schedules itself.
        next = await t.mutation(internal.analyticsBackfill.step, {
          phase,
          cursor: null,
        });
      }
      expect(next?.done).toBe(true);
    };

    await run();

    expect(await events("account_created")).toHaveLength(1);
    expect(await events("business_connected")).toHaveLength(1);
    expect(await events("onboarding_completed")).toHaveLength(1);
    expect(await events("checkout_started")).toHaveLength(1);
    expect(await events("payment_succeeded")).toHaveLength(1);
    // The Google-imported post and the mirrored photo are excluded.
    expect(await events("content_published")).toHaveLength(2);

    // Facts that were never stored are never invented.
    expect(await events("gbp_connect_started")).toHaveLength(0);
    expect(await events("gbp_connect_failed")).toHaveLength(0);
    expect(await events("onboarding_step_completed")).toHaveLength(0);
    expect(await events("checkout_failed")).toHaveLength(0);
    expect(await events("checkout_dismissed")).toHaveLength(0);

    const before = (await events()).length;
    const totalsBefore = (await totalFor("payment_succeeded"))?.amountPaise;

    // Running it a second time changes nothing at all.
    await run();
    expect((await events()).length).toBe(before);
    expect((await totalFor("payment_succeeded"))?.amountPaise).toBe(
      totalsBefore,
    );
  });

  test("a business flagged complete without agentStartedAt gets no guessed date", async () => {
    await t.run(async (ctx) =>
      ctx.db.insert("businesses", {
        userId,
        orgName: "No Date Shop",
        onboardingStep: 6,
        onboardingComplete: true,
        agentActive: false,
      }),
    );
    await t.mutation(internal.analyticsBackfill.step, {
      phase: "businesses",
      cursor: null,
    });

    expect(await events("business_connected")).toHaveLength(1);
    expect(await events("onboarding_completed")).toHaveLength(0);
  });

  test("the backfill agrees with the live writer's keys", async () => {
    // The live path runs first; the backfill then re-derives the same
    // fact and must recognise it rather than double it.
    const location = {
      name: "locations/1",
      title: "The Mocha Club",
      accountName: "accounts/1",
    };
    await t.mutation(internal.google.createBusinessFromLocation, {
      userId,
      location,
    });
    expect(await events("business_connected")).toHaveLength(1);

    await t.mutation(internal.analyticsBackfill.step, {
      phase: "businesses",
      cursor: null,
    });
    expect(await events("business_connected")).toHaveLength(1);
  });

  test("only a processed refund is derived", async () => {
    const businessId = await seedBusiness();
    const subId = await t.run(async (ctx) =>
      ctx.db.insert("subscriptions", {
        userId,
        businessId,
        plan: "monthly",
        amountPaise: 199_900,
        currency: "INR",
        razorpayOrderId: "order_r",
        razorpayPaymentId: "pay_r",
        status: "refunded",
        paidAt: Date.now() - 86_400_000,
      }),
    );
    await t.run(async (ctx) => {
      await ctx.db.insert("refunds", {
        subscriptionId: subId,
        userId,
        razorpayRefundId: "rfnd_done",
        razorpayPaymentId: "pay_r",
        amountPaise: 199_900,
        status: "processed",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert("refunds", {
        subscriptionId: subId,
        userId,
        razorpayRefundId: "rfnd_failed",
        razorpayPaymentId: "pay_r",
        amountPaise: 199_900,
        status: "failed",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    await t.mutation(internal.analyticsBackfill.step, {
      phase: "refunds",
      cursor: null,
    });

    const refunds = await events("payment_refunded");
    expect(refunds).toHaveLength(1);
    expect(refunds[0].amountPaise).toBe(199_900);
  });
});

/* ------------------------------- dashboard ------------------------------- */

describe("dashboard reads", () => {
  async function asAdmin() {
    vi.stubEnv("ANALYTICS_ADMIN_EMAILS", "admin@example.com");
    await t.run(async (ctx) => {
      await ctx.db.patch(userId, {
        email: "admin@example.com",
        emailVerificationTime: Date.now(),
        phone: "+919319102143",
      });
    });
    return me();
  }

  test("the funnel reports payment before onboarding, with conversions", async () => {
    const admin = await asAdmin();
    const businessId = await seedBusiness();
    const now = Date.now();

    await t.run(async (ctx) => {
      const write = (event: string, key: string) =>
        recordAnalyticsEvent(ctx, {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          event: event as any,
          dedupeKey: key,
          source: "owner",
          occurredAt: now,
          userId,
          businessId,
        });
      await write("account_created", "a1");
      await write("account_created", "a2");
      await write("account_created", "a3");
      await write("account_created", "a4");
      await write("gbp_connect_started", "g1");
      await write("gbp_connect_started", "g2");
      await write("business_connected", "b1");
      await write("business_connected", "b2");
      await write("checkout_started", "c1");
      await write("payment_succeeded", "p1");
      await write("onboarding_completed", "o1");
    });

    const out = await admin.query(api.adminDash.overview, { days: 30, now });
    const labels = out.funnel.map((s) => s.event);
    expect(labels).toEqual([
      "account_created",
      "gbp_connect_started",
      "business_connected",
      "checkout_started",
      "payment_succeeded",
      "onboarding_completed",
      "content_published",
    ]);
    // Payment sits above onboarding: the paid mutations protect setup.
    expect(labels.indexOf("payment_succeeded")).toBeLessThan(
      labels.indexOf("onboarding_completed"),
    );

    expect(out.funnel[0].count).toBe(4);
    expect(out.funnel[0].conversionFromPrevious).toBeNull();
    expect(out.funnel[1].count).toBe(2);
    expect(out.funnel[1].conversionFromPrevious).toBe(0.5);
    expect(out.funnel[1].droppedFromPrevious).toBe(2);
    expect(out.funnel[2].conversionFromStart).toBe(0.5);
  });

  test("revenue is captured minus refunded, in paise", async () => {
    const admin = await asAdmin();
    const businessId = await seedBusiness();
    const now = Date.now();

    await t.run(async (ctx) => {
      await recordAnalyticsEvent(ctx, {
        event: "payment_succeeded",
        dedupeKey: "p1",
        source: "system",
        occurredAt: now,
        userId,
        businessId,
        amountPaise: 199_900,
        currency: "INR",
      });
      await recordAnalyticsEvent(ctx, {
        event: "payment_succeeded",
        dedupeKey: "p2",
        source: "system",
        occurredAt: now,
        userId,
        businessId,
        amountPaise: 999_900,
        currency: "INR",
      });
      await recordAnalyticsEvent(ctx, {
        event: "payment_refunded",
        dedupeKey: "r1",
        source: "system",
        occurredAt: now,
        userId,
        businessId,
        amountPaise: 199_900,
        currency: "INR",
      });
    });

    const out = await admin.query(api.adminDash.overview, { days: 7, now });
    expect(out.revenue.capturedWindowPaise).toBe(1_199_800);
    expect(out.revenue.refundedWindowPaise).toBe(199_900);
    expect(out.revenue.netWindowPaise).toBe(999_900);
    expect(out.revenue.capturedLifetimePaise).toBe(1_199_800);
    expect(out.revenue.currency).toBe("INR");
  });

  test("active plans count businesses, not stacked periods, and test plans add no run rate", async () => {
    const admin = await asAdmin();
    const monthlyBusiness = await seedBusiness("Monthly");
    const yearlyBusiness = await seedBusiness("Yearly");
    const compBusiness = await seedBusiness("Comped");
    const testBusiness = await seedBusiness("Production test");
    const now = Date.now();

    await t.run(async (ctx) => {
      const insert = async (args: {
        businessId: Id<"businesses">;
        plan: string;
        amountPaise: number;
        order: string;
        expiresAt: number;
        oneRupeeTest?: boolean;
      }) =>
        await ctx.db.insert("subscriptions", {
          userId,
          businessId: args.businessId,
          currency: "INR",
          status: "paid",
          paidAt: now,
          plan: args.plan,
          amountPaise: args.amountPaise,
          razorpayOrderId: args.order,
          expiresAt: args.expiresAt,
          oneRupeeTest: args.oneRupeeTest,
        });

      await insert({
        businessId: monthlyBusiness,
        plan: "monthly",
        amountPaise: 199_900,
        order: "monthly_now",
        expiresAt: now + 10 * 86_400_000,
      });
      // An early renewal is another granting row for the same business. It
      // extends access; it is not another active customer or another run rate.
      await insert({
        businessId: monthlyBusiness,
        plan: "monthly",
        amountPaise: 199_900,
        order: "monthly_renewal",
        expiresAt: now + 40 * 86_400_000,
      });
      await insert({
        businessId: yearlyBusiness,
        plan: "yearly",
        amountPaise: 999_900,
        order: "yearly",
        expiresAt: now + 200 * 86_400_000,
      });
      await insert({
        businessId: compBusiness,
        plan: "comp",
        amountPaise: 0,
        order: "comp_1",
        expiresAt: now + 30 * 86_400_000,
      });
      await insert({
        businessId: testBusiness,
        plan: "monthly",
        amountPaise: 100,
        order: "one_rupee",
        expiresAt: now + 30 * 86_400_000,
        oneRupeeTest: true,
      });
      // Expired: bought, but not running now.
      await insert({
        businessId: yearlyBusiness,
        plan: "monthly",
        amountPaise: 199_900,
        order: "expired",
        expiresAt: now - 86_400_000,
      });
    });

    const out = await admin.query(api.adminDash.overview, { days: 30, now });
    expect(out.plans.activePlans).toBe(4);
    expect(out.plans.activeMonthly).toBe(2); // customer + ₹1 test access
    expect(out.plans.activeYearly).toBe(1);
    expect(out.plans.activeComp).toBe(1);
    // Test and comp access are visible, but neither is customer run rate.
    expect(out.plans.monthlyRunRatePaise).toBe(199_900 + Math.round(999_900 / 12));
    expect(out.plans.truncated).toBe(false);
  });

  test("first value counts distinct businesses, not publishes", async () => {
    const admin = await asAdmin();
    const a = await seedBusiness("A");
    const b = await seedBusiness("B");
    const now = Date.now();

    await t.run(async (ctx) => {
      for (const [i, businessId] of [a, a, a, b].entries()) {
        await recordAnalyticsEvent(ctx, {
          event: "content_published",
          dedupeKey: `pub_${i}`,
          source: "agent",
          occurredAt: now,
          userId,
          businessId,
          metadata: { kind: "post" },
        });
      }
    });

    const out = await admin.query(api.adminDash.overview, { days: 7, now });
    expect(out.firstValue.businessesInWindow).toBe(2);
    expect(out.firstValue.truncated).toBe(false);
  });

  test("the window bounds what is counted", async () => {
    const admin = await asAdmin();
    const businessId = await seedBusiness();
    const now = Date.now();

    await t.run(async (ctx) => {
      await recordAnalyticsEvent(ctx, {
        event: "account_created",
        dedupeKey: "recent",
        source: "owner",
        occurredAt: now - 2 * 86_400_000,
        userId,
        businessId,
      });
      await recordAnalyticsEvent(ctx, {
        event: "account_created",
        dedupeKey: "old",
        source: "owner",
        occurredAt: now - 45 * 86_400_000,
        userId,
        businessId,
      });
    });

    const week = await admin.query(api.adminDash.overview, { days: 7, now });
    expect(week.funnel[0].count).toBe(1);
    const quarter = await admin.query(api.adminDash.overview, { days: 90, now });
    expect(quarter.funnel[0].count).toBe(2);
    // Lifetime totals are not bounded by the window.
    const accounts = quarter.events.find((e) => e.event === "account_created");
    expect(accounts?.lifetimeCount).toBe(2);
  });

  test("the trend has one point per day in the window", async () => {
    const admin = await asAdmin();
    const now = Date.now();
    const out = await admin.query(api.adminDash.overview, { days: 7, now });
    expect(out.trend).toHaveLength(7);
    expect(out.trend[6].day).toBe(istDay(now));
    expect(out.fromDay).toBe(out.trend[0].day);
    expect(out.toDay).toBe(out.trend[6].day);
  });

  test("the business table is masked, paginated and free of secrets", async () => {
    const admin = await asAdmin();
    const businessId = await seedBusiness();
    const now = Date.now();

    await t.run(async (ctx) => {
      await ctx.db.insert("subscriptions", {
        userId,
        businessId,
        plan: "monthly",
        amountPaise: 199_900,
        currency: "INR",
        razorpayOrderId: "o1",
        razorpayPaymentId: "pay_secret",
        status: "paid",
        paidAt: now,
        expiresAt: now + 10 * 86_400_000,
      });
      // Things this query must never surface.
      await ctx.db.insert("googleAccounts", {
        userId,
        businessId,
        accessToken: "ya29.SECRET_ACCESS_TOKEN",
        refreshToken: "1//SECRET_REFRESH",
        expiresAt: now + 3600_000,
        scope: "business.manage",
      });
      await ctx.db.insert("customers", {
        businessId,
        phone: "+919812345678",
        name: "Rahul Sharma",
        source: "manual",
      });
      await ctx.db.insert("messages", {
        businessId,
        channel: "sms",
        to: "+919812345678",
        body: "Please leave us a review",
        purpose: "review_invite",
        status: "sent",
        attempts: 1,
        createdAt: now,
        updatedAt: now,
      });
      await recordAnalyticsEvent(ctx, {
        event: "content_published",
        dedupeKey: "pub",
        source: "agent",
        occurredAt: now - 86_400_000,
        userId,
        businessId,
        metadata: { kind: "post" },
      });
    });

    const out = await admin.query(api.adminDash.businesses, {
      paginationOpts: { numItems: 10, cursor: null },
      now,
    });

    expect(out.page).toHaveLength(1);
    const row = out.page[0];
    expect(row.businessId).toBe(businessId);
    expect(row.ownerEmailMasked).toBe("a•••n@example.com");
    expect(row.ownerPhoneMasked).toBe("+91•••••2143");
    expect(row.planActive).toBe(true);
    expect(row.plan).toBe("monthly");
    expect(row.firstValueAt).toBeGreaterThan(0);
    expect(row.lastActivityAt).toBeGreaterThan(0);

    const serialised = JSON.stringify(out);
    expect(serialised).not.toContain("SECRET_ACCESS_TOKEN");
    expect(serialised).not.toContain("SECRET_REFRESH");
    expect(serialised).not.toContain("pay_secret");
    expect(serialised).not.toContain("+919812345678");
    expect(serialised).not.toContain("Rahul Sharma");
    expect(serialised).not.toContain("leave us a review");
    expect(serialised).not.toContain("admin@example.com");
  });

  test("a page larger than the cap is clamped, not honoured", async () => {
    const admin = await asAdmin();
    for (let i = 0; i < 3; i++) await seedBusiness(`Shop ${i}`);
    const out = await admin.query(api.adminDash.businesses, {
      paginationOpts: { numItems: 10_000, cursor: null },
      now: Date.now(),
    });
    expect(out.page.length).toBeLessThanOrEqual(50);
  });

  test("the event feed is capped and hides the dedupe key", async () => {
    const admin = await asAdmin();
    const businessId = await seedBusiness();

    await t.run(async (ctx) => {
      for (let i = 0; i < 5; i++) {
        await recordAnalyticsEvent(ctx, {
          event: "content_published",
          dedupeKey: `feed_secret_key_${i}`,
          source: "agent",
          occurredAt: Date.now() - i * 1000,
          userId,
          businessId,
          metadata: { kind: "post" },
        });
      }
    });

    const feed = await admin.query(api.adminDash.recentEvents, { limit: 3 });
    expect(feed.rows).toHaveLength(3);
    expect(feed.truncated).toBe(true);
    // Newest first.
    expect(feed.rows[0].occurredAt).toBeGreaterThan(feed.rows[1].occurredAt);
    expect(JSON.stringify(feed)).not.toContain("feed_secret_key");

    const filtered = await admin.query(api.adminDash.recentEvents, {
      event: "account_created",
    });
    expect(filtered.rows).toHaveLength(0);

    const trail = await admin.query(api.adminDash.businessEvents, {
      businessId,
      limit: 100,
    });
    expect(trail.rows).toHaveLength(5);
    expect(trail.truncated).toBe(false);
  });

  test("a limit above the cap cannot widen the feed", async () => {
    const admin = await asAdmin();
    const feed = await admin.query(api.adminDash.recentEvents, {
      limit: 100_000,
    });
    expect(feed.rows.length).toBeLessThanOrEqual(100);
  });
});
