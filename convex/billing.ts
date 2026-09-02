import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { hasActivePlan } from "./access";

/* ---------------------------------------------------------------------------
   Razorpay, one-time orders.

   The owner pays for a period and gets that period. There is no mandate and
   no auto-debit, which means nothing here can take money without somebody
   tapping a button.

   Prices live on the server and nowhere else. The browser sends a plan name,
   never an amount — otherwise anyone could open devtools and buy a year for
   one rupee.
--------------------------------------------------------------------------- */

const DAY = 24 * 60 * 60 * 1000;

export const PLANS = {
  monthly: {
    id: "monthly",
    name: "Monthly",
    amountPaise: 199_900, // ₹1,999
    listPaise: 249_900, // ₹2,499 before the launch discount
    days: 30,
    period: "month",
  },
  yearly: {
    id: "yearly",
    name: "Yearly",
    amountPaise: 999_900, // ₹9,999
    listPaise: 1_999_900, // ₹19,999 before the launch discount
    days: 365,
    period: "year",
  },
} as const;

type PlanId = keyof typeof PLANS;

const planValidator = v.union(v.literal("monthly"), v.literal("yearly"));

/* --------------------------------- reads -------------------------------- */

/** Used by access.ts from inside actions, where there is no ctx.db. */
export const isActive = internalQuery({
  args: {},
  handler: async (ctx): Promise<boolean> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;
    return await hasActivePlan(ctx, userId);
  },
});

/**
 * What the billing screen renders. Never behind the paywall, for the
 * obvious reason.
 */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { signedIn: false, active: false, plan: null, expiresAt: null };
    }

    const rows = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const now = Date.now();
    const live = rows
      .filter((r) => r.status === "paid" && (r.expiresAt ?? 0) > now)
      .sort((a, b) => (b.expiresAt ?? 0) - (a.expiresAt ?? 0))[0];

    return {
      signedIn: true,
      active: Boolean(live),
      plan: live?.plan ?? null,
      expiresAt: live?.expiresAt ?? null,
      /** Every paid receipt, newest first — the owner's own record. */
      receipts: rows
        .filter((r) => r.status === "paid")
        .sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0))
        .map((r) => ({
          plan: r.plan,
          amountPaise: r.amountPaise,
          paidAt: r.paidAt ?? null,
          expiresAt: r.expiresAt ?? null,
          paymentId: r.razorpayPaymentId ?? null,
        })),
    };
  },
});

/* -------------------------------- writes -------------------------------- */

export const recordPending = internalMutation({
  args: {
    userId: v.id("users"),
    plan: planValidator,
    amountPaise: v.number(),
    razorpayOrderId: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("subscriptions", {
      userId: args.userId,
      plan: args.plan,
      amountPaise: args.amountPaise,
      currency: "INR",
      razorpayOrderId: args.razorpayOrderId,
      status: "created",
    });
  },
});

/**
 * Turns a created order into a paid one, exactly once.
 *
 * Both the browser and the webhook call this for the same payment, and they
 * race. Whoever arrives first does the work; the second one sees status
 * "paid" and returns quietly. Charging a period twice for one payment is
 * the failure mode this exists to prevent.
 */
export const markPaid = internalMutation({
  args: {
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.string(),
    confirmedBy: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("subscriptions")
      .withIndex("by_order", (q) =>
        q.eq("razorpayOrderId", args.razorpayOrderId),
      )
      .first();

    if (!row) {
      console.error("[billing] payment for an unknown order", args);
      return { ok: false, reason: "unknown order" };
    }
    if (row.status === "paid") return { ok: true, already: true };

    const plan = PLANS[row.plan as PlanId] ?? PLANS.monthly;
    const now = Date.now();

    // If they still have time left, the new period starts when the old one
    // ends. Paying early should never cost somebody the days they bought.
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", row.userId))
      .collect();
    const furthest = existing
      .filter((r) => r.status === "paid")
      .reduce((max, r) => Math.max(max, r.expiresAt ?? 0), 0);

    const startsAt = Math.max(now, furthest);

    await ctx.db.patch(row._id, {
      status: "paid",
      razorpayPaymentId: args.razorpayPaymentId,
      paidAt: now,
      startsAt,
      expiresAt: startsAt + plan.days * DAY,
      confirmedBy: args.confirmedBy,
    });

    return { ok: true, already: false };
  },
});

/* -------------------------------- Razorpay ------------------------------- */

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new Error(
      "Payments are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET on the Convex deployment.",
    );
  }
  return { keyId, keySecret };
}

/** HMAC-SHA256, hex. Web Crypto, so this file stays in the fast runtime. */
export async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Length-independent compare, so a bad signature can't be guessed by timing. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Opens an order with Razorpay and hands the browser what Checkout needs.
 * Requires a signed-in user but NOT an active plan — this is how someone
 * without one gets one.
 */
export const createOrder = action({
  args: { plan: planValidator },
  handler: async (
    ctx,
    { plan },
  ): Promise<{
    orderId: string;
    amountPaise: number;
    currency: string;
    keyId: string;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const { keyId, keySecret } = credentials();
    const chosen = PLANS[plan];

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: chosen.amountPaise,
        currency: "INR",
        // Razorpay caps the receipt at 40 characters.
        receipt: `ff_${plan}_${Date.now()}`.slice(0, 40),
        notes: { userId, plan },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("[billing] razorpay order failed", response.status, detail);
      throw new Error("Could not start the payment. Please try again.");
    }

    const order = (await response.json()) as { id?: string };
    if (!order.id) throw new Error("Razorpay did not return an order.");

    await ctx.runMutation(internal.billing.recordPending, {
      userId,
      plan,
      amountPaise: chosen.amountPaise,
      razorpayOrderId: order.id,
    });

    return {
      orderId: order.id,
      amountPaise: chosen.amountPaise,
      currency: "INR",
      keyId,
    };
  },
});

/**
 * The browser's hand-back after Checkout closes.
 *
 * The signature is what makes this trustworthy: it is HMAC-SHA256 of
 * "<order_id>|<payment_id>" keyed with the secret, which only Razorpay and
 * this deployment know. A browser cannot forge it. The webhook confirms the
 * same payment independently, so access still lands if the customer closes
 * the tab before this runs.
 */
export const verifyPayment = action({
  args: {
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.string(),
    razorpaySignature: v.string(),
  },
  handler: async (ctx, args): Promise<{ ok: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const { keySecret } = credentials();
    const expected = await hmacHex(
      keySecret,
      `${args.razorpayOrderId}|${args.razorpayPaymentId}`,
    );

    if (!safeEqual(expected, args.razorpaySignature)) {
      console.error("[billing] signature mismatch", args.razorpayOrderId);
      throw new Error("That payment could not be verified.");
    }

    await ctx.runMutation(internal.billing.markPaid, {
      razorpayOrderId: args.razorpayOrderId,
      razorpayPaymentId: args.razorpayPaymentId,
      confirmedBy: "browser",
    });

    return { ok: true };
  },
});

/* ------------------------------ by hand --------------------------------- */

/**
 * Gives a shop a period without a payment.
 *
 * This exists for the five shops being set up by hand, and for anyone whose
 * payment went wrong in a way support has to fix. It is internal, so it can
 * only be run by someone holding the deployment credentials:
 *
 *   npx convex run billing:grantComp --prod  *     '{"email":"owner@example.com","days":365,"reason":"first five"}'
 */
export const grantComp = internalMutation({
  args: {
    email: v.string(),
    days: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, { email, days, reason }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first();
    if (!user) throw new Error(`No user with the email ${email}.`);

    const now = Date.now();
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const furthest = existing
      .filter((r) => r.status === "paid")
      .reduce((max, r) => Math.max(max, r.expiresAt ?? 0), 0);
    const startsAt = Math.max(now, furthest);

    await ctx.db.insert("subscriptions", {
      userId: user._id,
      plan: "comp",
      amountPaise: 0,
      currency: "INR",
      razorpayOrderId: `comp_${now}`,
      status: "paid",
      paidAt: now,
      startsAt,
      expiresAt: startsAt + days * DAY,
      confirmedBy: `comp: ${reason}`,
    });

    return { email, until: startsAt + days * DAY };
  },
});

/**
 * Puts a note in the owner's own activity feed a week before their plan
 * runs out. There is no auto-debit, so the only thing standing between a
 * working listing and a dead one is them remembering to pay again.
 *
 * This writes in-app only. WhatsApp and email reminders are not wired yet.
 */
export const remindExpiring = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const soon = now + 7 * DAY;

    const rows = await ctx.db.query("subscriptions").collect();
    const active = rows.filter(
      (r) => r.status === "paid" && (r.expiresAt ?? 0) > now,
    );

    let warned = 0;
    for (const row of active) {
      if ((row.expiresAt ?? 0) > soon) continue;

      const business = await ctx.db
        .query("businesses")
        .withIndex("by_user", (q) => q.eq("userId", row.userId))
        .first();
      if (!business) continue;

      // One note per plan, not one a day for the last week.
      const already = await ctx.db
        .query("agentActions")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect();
      if (
        already.some(
          (a) => a.type === "billing" && a.createdAt > now - 7 * DAY,
        )
      ) {
        continue;
      }

      const days = Math.max(
        0,
        Math.ceil(((row.expiresAt ?? now) - now) / DAY),
      );
      await ctx.db.insert("agentActions", {
        businessId: business._id,
        type: "billing",
        title: `Your plan ends in ${days} day${days === 1 ? "" : "s"}`,
        detail:
          "Renew to keep posts going up, reviews answered and enquiries picked up.",
        createdAt: now,
      });
      warned += 1;
    }

    return { checked: active.length, warned };
  },
});
