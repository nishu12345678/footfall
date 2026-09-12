import { ConvexError, v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
} from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  activeBusinessFor,
  hasActivePlan,
  legacyPlanBusinessId,
  subscriptionBusinessId,
} from "./access";
import { sendNow as sendMessage, type SendResult } from "./messaging";
import { describePaymentFailure } from "./paymentText";

/* ---------------------------------------------------------------------------
   Razorpay, one-time orders.

   The owner pays for a period and gets that period. There is no mandate and
   no auto-debit, which means nothing here can take money without somebody
   tapping a button.

   Prices live on the server and nowhere else. The browser sends a plan name,
   never an amount. A verified email in RAZORPAY_ONE_RUPEE_TEST_EMAILS gets the
   deliberate ₹1 production-test price; every other user gets the normal
   server price. Devtools cannot opt an account into that allowlist.

   Nothing the browser says is believed on its own. Checkout's hand-back is
   signature-checked AND the payment is fetched from Razorpay's API before
   anything is granted; the webhook does the same from the other side. The
   two race, markPaid is idempotent, and every webhook is keyed by its
   event id so a redelivery is a no-op.

   States, and who moves them (see schema.ts for the list):

     created ──► attempted ──► (retry: still created/attempted)
        │            │
        ├──► authorized ──► paid ──► partially_refunded / refunded
        │                    ▲
        └────────────────────┘
        └──► expired (24h sweep)      mismatch (held for a person)
--------------------------------------------------------------------------- */

const DAY = 24 * 60 * 60 * 1000;

/** An order Checkout hasn't finished with after this long is dead. */
const ORDER_TTL_MS = DAY;
/** Reuse an open order for the same plan this long, so a refresh mid-payment
    doesn't litter Razorpay with orders. */
const ORDER_REUSE_MS = 30 * 60 * 1000;

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

const ONE_RUPEE_PAISE = 100;

/** Exact, case-insensitive email matching. No domains, wildcards or client input. */
export function isOneRupeeTester(
  email: string | null | undefined,
  rawAllowlist = process.env.RAZORPAY_ONE_RUPEE_TEST_EMAILS ?? "",
): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  return rawAllowlist
    .split(/[\s,;]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .includes(normalized);
}

const CURRENCY = "INR";

const planValidator = v.union(v.literal("monthly"), v.literal("yearly"));

const GRANTING = new Set(["paid", "partially_refunded"]);

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

/** A row the screen can show, without the internals. */
function publicRow(r: Doc<"subscriptions">) {
  return {
    id: r._id,
    plan: r.plan,
    amountPaise: r.amountPaise,
    oneRupeeTest: r.oneRupeeTest === true,
    currency: r.currency,
    status: r.status,
    orderId: r.razorpayOrderId,
    paymentId: r.razorpayPaymentId ?? null,
    paidAt: r.paidAt ?? null,
    startsAt: r.startsAt ?? null,
    expiresAt: r.expiresAt ?? null,
    failureReason: r.failureReason ?? null,
    failureCode: r.failureCode ?? null,
    /** What to show the owner; the two above are for support. */
    failureText:
      r.failureCode || r.failureReason
        ? describePaymentFailure(r.failureCode, r.failureReason)
        : null,
    refundedPaise: r.refundedPaise ?? 0,
    createdAt: r._creationTime,
    updatedAt: r.updatedAt ?? r._creationTime,
  };
}

/**
 * What the billing screen renders. Never behind the paywall, for the
 * obvious reason.
 *
 * `pending` is the row the owner should be looking at right now: an order
 * they opened in the last day that isn't settled. It is what makes a
 * refreshed or reopened page show "we're confirming your payment" or
 * "that one failed — try again" instead of a blank plan picker.
 */
export const status = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        signedIn: false as const,
        active: false,
        plan: null,
        expiresAt: null,
        oneRupeeTest: false,
        receipts: [],
        pending: null,
      };
    }

    // Only the verified auth-account email is eligible. A business email from
    // a Google listing is owner-editable and is deliberately not considered.
    const user = await ctx.db.get(userId);
    const oneRupeeTest =
      typeof user?.emailVerificationTime === "number" &&
      isOneRupeeTester(user.email);

    // Plans are per business. The screen shows the ACTIVE business's plan,
    // orders and receipts; another business on the account pays separately.
    // Rows from before per-business plans belong to the oldest business.
    const business = await activeBusinessFor(ctx, userId);
    const legacyId = await legacyPlanBusinessId(ctx, userId);
    const all = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const rows = business
      ? all.filter(
          (r) => subscriptionBusinessId(r, legacyId) === business._id,
        )
      : all;

    const now = Date.now();
    const live = rows
      .filter((r) => GRANTING.has(r.status) && (r.expiresAt ?? 0) > now)
      .sort((a, b) => (b.expiresAt ?? 0) - (a.expiresAt ?? 0))[0];

    const pending = rows
      .filter(
        (r) =>
          ["created", "attempted", "authorized", "mismatch"].includes(r.status) &&
          r._creationTime > now - ORDER_TTL_MS,
      )
      .sort((a, b) => b._creationTime - a._creationTime)[0];

    return {
      signedIn: true as const,
      active: Boolean(live),
      plan: live?.plan ?? null,
      expiresAt: live?.expiresAt ?? null,
      oneRupeeTest,
      /** The business this plan pays for, and where its setup stands, so
          the screen can send a paid owner to the step they left. */
      business: business
        ? {
            orgName: business.orgName,
            connected: Boolean(business.gbpLocationName),
            onboardingStep: business.onboardingStep,
            onboardingComplete: business.onboardingComplete,
          }
        : null,
      /** Every paid receipt, newest first — the owner's own record. */
      receipts: rows
        .filter((r) => r.paidAt)
        .sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0))
        .map(publicRow),
      pending: pending ? publicRow(pending) : null,
    };
  },
});

/** One order, for the screen to watch after Checkout closes. */
export const order = query({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await ctx.db
      .query("subscriptions")
      .withIndex("by_order", (q) => q.eq("razorpayOrderId", orderId))
      .first();
    if (!row || row.userId !== userId) return null;
    return publicRow(row);
  },
});

export const byOrder = internalQuery({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) =>
    await ctx.db
      .query("subscriptions")
      .withIndex("by_order", (q) => q.eq("razorpayOrderId", orderId))
      .first(),
});

/** Server-owned identity used for special pricing; never accepts an email arg. */
export const verifiedEmailForUser = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    if (!user?.email || typeof user.emailVerificationTime !== "number") return null;
    return user.email.trim().toLowerCase();
  },
});

/* -------------------------------- writes -------------------------------- */

/**
 * Opens (or reuses) a row for an order. If the owner already has an open
 * order for this plan from the last half hour, that one is handed back,
 * so a refresh or a second tap does not create a second order.
 */
export const openOrder = internalQuery({
  args: {
    userId: v.id("users"),
    plan: planValidator,
    amountPaise: v.number(),
    businessId: v.id("businesses"),
  },
  handler: async (ctx, { userId, plan, amountPaise, businessId }) => {
    const rows = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const cutoff = Date.now() - ORDER_REUSE_MS;
    return (
      rows
        .filter(
          (r) =>
            r.plan === plan &&
            r.amountPaise === amountPaise &&
            r.businessId === businessId &&
            (r.status === "created" || r.status === "attempted") &&
            r._creationTime > cutoff,
        )
        .sort((a, b) => b._creationTime - a._creationTime)[0] ?? null
    );
  },
});

export const recordPending = internalMutation({
  args: {
    userId: v.id("users"),
    plan: planValidator,
    amountPaise: v.number(),
    oneRupeeTest: v.boolean(),
    razorpayOrderId: v.string(),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("subscriptions", {
      userId: args.userId,
      businessId: args.businessId,
      plan: args.plan,
      amountPaise: args.amountPaise,
      oneRupeeTest: args.oneRupeeTest,
      currency: CURRENCY,
      razorpayOrderId: args.razorpayOrderId,
      status: "created",
      attempts: 0,
      updatedAt: Date.now(),
    });
  },
});

/**
 * Turns an open order into a paid one, exactly once.
 *
 * Both the browser and the webhook call this for the same payment, and they
 * race. Whoever arrives first does the work; the second one sees status
 * "paid" and returns quietly. Charging a period twice for one payment is
 * the failure mode this exists to prevent.
 *
 * The amount and currency are what Razorpay says it captured, and they
 * must match what we asked for. If they don't, nothing is granted and the
 * row is held as "mismatch" for a person to look at.
 */
export const markPaid = internalMutation({
  args: {
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.string(),
    amountPaise: v.number(),
    currency: v.string(),
    confirmedBy: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    already: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("subscriptions")
      .withIndex("by_order", (q) =>
        q.eq("razorpayOrderId", args.razorpayOrderId),
      )
      .first();

    if (!row) {
      console.error("[billing] payment for an unknown order", args);
      return { ok: false, already: false, reason: "unknown order" };
    }
    if (GRANTING.has(row.status) || row.status === "refunded") {
      if (row.razorpayPaymentId && row.razorpayPaymentId !== args.razorpayPaymentId) {
        // Two captured payments on one order should be impossible; if it
        // happens, the second one must be refunded by hand, not granted.
        console.error(
          `[billing] second payment ${args.razorpayPaymentId} on paid order ${row.razorpayOrderId}`,
        );
        return { ok: false, already: true, reason: "order already paid by another payment" };
      }
      return { ok: true, already: true };
    }

    if (args.amountPaise !== row.amountPaise || args.currency !== row.currency) {
      console.error(
        `[billing] MISMATCH on ${row.razorpayOrderId}: asked ${row.amountPaise} ${row.currency}, captured ${args.amountPaise} ${args.currency}`,
      );
      await ctx.db.patch(row._id, {
        status: "mismatch",
        razorpayPaymentId: args.razorpayPaymentId,
        paymentStatus: "captured",
        failureCode: "AMOUNT_MISMATCH",
        failureReason: `Captured ${args.amountPaise} ${args.currency}, expected ${row.amountPaise} ${row.currency}`,
        updatedAt: Date.now(),
      });
      return { ok: false, already: false, reason: "amount mismatch" };
    }

    const plan = PLANS[row.plan as PlanId] ?? PLANS.monthly;
    const now = Date.now();

    // If they still have time left, the new period starts when the old one
    // ends. Paying early should never cost somebody the days they bought.
    // Periods stack per BUSINESS: paying for a second listing must not be
    // queued behind the first listing's running plan, and a renewal must
    // still stack on a legacy row that predates per-business plans.
    const legacyId = await legacyPlanBusinessId(ctx, row.userId);
    const rowBusiness = subscriptionBusinessId(row, legacyId);
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", row.userId))
      .collect();
    const furthest = existing
      .filter(
        (r) =>
          GRANTING.has(r.status) &&
          subscriptionBusinessId(r, legacyId) === rowBusiness,
      )
      .reduce((max, r) => Math.max(max, r.expiresAt ?? 0), 0);

    const startsAt = Math.max(now, furthest);
    const expiresAt = startsAt + plan.days * DAY;

    await ctx.db.patch(row._id, {
      status: "paid",
      paymentStatus: "captured",
      razorpayPaymentId: args.razorpayPaymentId,
      paidAt: now,
      startsAt,
      expiresAt,
      confirmedBy: args.confirmedBy,
      failureCode: undefined,
      failureReason: undefined,
      updatedAt: now,
    });

    console.log(
      `[billing] PAID ${row.razorpayOrderId} ${args.razorpayPaymentId} ${row.plan} via ${args.confirmedBy}`,
    );

    // The receipt goes once, from whichever side won. The dedupe key is
    // the order id, so even a second markPaid can't send another.
    await ctx.db.patch(row._id, { receiptEmailedAt: now });
    await ctx.scheduler.runAfter(0, internal.email.sendToUser, {
      userId: row.userId,
      template: "receipt",
      dedupeKey: `receipt:${row.razorpayOrderId}`,
      params: {
        plan: plan.name,
        amountPaise: row.amountPaise,
        startsAt,
        expiresAt,
        paymentId: args.razorpayPaymentId,
        orderId: row.razorpayOrderId,
      },
    });

    return { ok: true, already: false };
  },
});

/**
 * Money blocked at the bank, not yet captured. Recorded so the screen can
 * say so; the capture attempt itself happens in the action layer.
 */
export const markAuthorized = internalMutation({
  args: { razorpayOrderId: v.string(), razorpayPaymentId: v.string() },
  handler: async (ctx, { razorpayOrderId, razorpayPaymentId }) => {
    const row = await ctx.db
      .query("subscriptions")
      .withIndex("by_order", (q) => q.eq("razorpayOrderId", razorpayOrderId))
      .first();
    if (!row) return;
    // Never move a settled order backwards.
    if (!["created", "attempted"].includes(row.status)) return;
    await ctx.db.patch(row._id, {
      status: "authorized",
      paymentStatus: "authorized",
      razorpayPaymentId,
      updatedAt: Date.now(),
    });
  },
});

/**
 * A declined, cancelled or errored attempt. The order stays open — the
 * owner can try again with another card — but the reason is kept so the
 * screen can show it and support can see it.
 */
export const markAttemptFailed = internalMutation({
  args: {
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.optional(v.string()),
    code: v.optional(v.string()),
    reason: v.optional(v.string()),
    source: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("subscriptions")
      .withIndex("by_order", (q) => q.eq("razorpayOrderId", args.razorpayOrderId))
      .first();
    if (!row) return;
    // A failure reported after the money was captured is stale news.
    if (!["created", "attempted", "authorized"].includes(row.status)) return;

    const now = Date.now();
    const attempts = (row.attempts ?? 0) + 1;
    await ctx.db.patch(row._id, {
      status: "attempted",
      paymentStatus: "failed",
      razorpayPaymentId: args.razorpayPaymentId ?? row.razorpayPaymentId,
      failureCode: args.code,
      failureReason: args.reason,
      attempts,
      updatedAt: now,
    });
    console.log(
      `[billing] attempt ${attempts} failed on ${row.razorpayOrderId} (${args.source}): ${args.code ?? ""} ${args.reason ?? ""}`,
    );

    // One "didn't go through" email per order, not one per tap.
    if (!row.failureEmailedAt) {
      await ctx.db.patch(row._id, { failureEmailedAt: now });
      await ctx.scheduler.runAfter(0, internal.email.sendToUser, {
        userId: row.userId,
        template: "payment_failed",
        dedupeKey: `payment_failed:${row.razorpayOrderId}`,
        params: {
          plan: (PLANS[row.plan as PlanId] ?? PLANS.monthly).name,
          reason: describePaymentFailure(args.code, args.reason),
        },
      });
    }
  },
});

/** The daily sweep: orders nobody finished are closed. */
export const expireStaleOrders = internalMutation({
  args: {},
  returns: v.object({ expired: v.number() }),
  handler: async (ctx) => {
    const cutoff = Date.now() - ORDER_TTL_MS;
    let expired = 0;
    for (const s of ["created", "attempted"]) {
      const rows = await ctx.db
        .query("subscriptions")
        .withIndex("by_status", (q) => q.eq("status", s))
        .take(500);
      for (const row of rows) {
        if (row._creationTime > cutoff) continue;
        await ctx.db.patch(row._id, {
          status: "expired",
          endedAt: Date.now(),
          endedReason: "never paid",
          updatedAt: Date.now(),
        });
        expired += 1;
      }
    }
    return { expired };
  },
});

/* -------------------------------- refunds ------------------------------- */

/**
 * A refund from Razorpay's side, created / processed / failed. Full
 * refunds end access; partial ones don't. A refund that fails leaves
 * the plan exactly as it was.
 */
export const applyRefund = internalMutation({
  args: {
    razorpayRefundId: v.string(),
    razorpayPaymentId: v.string(),
    amountPaise: v.number(),
    status: v.string(),
    speed: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  returns: v.object({ ok: v.boolean(), note: v.string() }),
  handler: async (ctx, args) => {
    const sub = await ctx.db
      .query("subscriptions")
      .withIndex("by_payment", (q) => q.eq("razorpayPaymentId", args.razorpayPaymentId))
      .first();
    if (!sub) return { ok: false, note: "refund for an unknown payment" };

    const now = Date.now();
    let refund = await ctx.db
      .query("refunds")
      .withIndex("by_refund_id", (q) => q.eq("razorpayRefundId", args.razorpayRefundId))
      .first();

    if (!refund) {
      const id = await ctx.db.insert("refunds", {
        subscriptionId: sub._id,
        userId: sub.userId,
        razorpayRefundId: args.razorpayRefundId,
        razorpayPaymentId: args.razorpayPaymentId,
        amountPaise: args.amountPaise,
        status: args.status,
        speed: args.speed,
        reason: args.reason,
        createdAt: now,
        updatedAt: now,
      });
      refund = (await ctx.db.get(id))!;
    } else {
      // Only forward: processed after failed would be a Razorpay bug, but
      // a "created" arriving after "processed" is just late.
      const rank: Record<string, number> = { created: 0, processed: 2, failed: 2 };
      if ((rank[args.status] ?? 0) < (rank[refund.status] ?? 0)) {
        return { ok: true, note: "stale refund event" };
      }
      await ctx.db.patch(refund._id, {
        status: args.status,
        speed: args.speed ?? refund.speed,
        updatedAt: now,
      });
    }

    if (args.status !== "processed") {
      if (args.status === "failed") {
        console.error(`[billing] refund ${args.razorpayRefundId} FAILED for ${sub.razorpayOrderId}`);
      }
      return { ok: true, note: `refund ${args.status}` };
    }

    // Processed: add it up across every refund on this payment.
    const all = await ctx.db
      .query("refunds")
      .withIndex("by_payment", (q) => q.eq("razorpayPaymentId", args.razorpayPaymentId))
      .collect();
    const refundedPaise = all
      .filter((r) => r.status === "processed")
      .reduce((sum, r) => sum + r.amountPaise, 0);
    const full = refundedPaise >= sub.amountPaise;

    await ctx.db.patch(sub._id, {
      refundedPaise,
      status: full ? "refunded" : "partially_refunded",
      // A full refund ends the period now. Any later paid period keeps
      // its own dates, so nothing else on the account is touched.
      expiresAt: full ? Math.min(sub.expiresAt ?? now, now) : sub.expiresAt,
      endedAt: full ? now : sub.endedAt,
      endedReason: full ? "refunded" : sub.endedReason,
      updatedAt: now,
    });
    console.log(
      `[billing] refund ${args.razorpayRefundId} processed: ${args.amountPaise} of ${sub.amountPaise} on ${sub.razorpayOrderId} (${full ? "full" : "partial"})`,
    );

    if (!refund.emailedAt) {
      await ctx.db.patch(refund._id, { emailedAt: now });
      await ctx.scheduler.runAfter(0, internal.email.sendToUser, {
        userId: sub.userId,
        template: "refund_processed",
        dedupeKey: `refund:${args.razorpayRefundId}`,
        params: {
          amountPaise: args.amountPaise,
          full,
          refundId: args.razorpayRefundId,
          paymentId: args.razorpayPaymentId,
        },
      });
    }
    return { ok: true, note: full ? "full refund" : "partial refund" };
  },
});

/* -------------------------------- Razorpay ------------------------------- */

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new ConvexError(
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

type RazorpayPayment = {
  id: string;
  order_id?: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  error_code?: string | null;
  error_description?: string | null;
  error_reason?: string | null;
  amount_refunded?: number;
};

/** One call to Razorpay's REST API with our key, throwing on transport. */
async function razorpay<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ ok: boolean; status: number; data: T | null; text: string }> {
  const { keyId, keySecret } = credentials();
  let res: Response;
  try {
    res = await fetch(`https://api.razorpay.com/v1${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        "Content-Type": "application/json",
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch (error) {
    console.error(`[billing] razorpay ${path} unreachable`, error);
    throw new ConvexError("Could not reach Razorpay. Check your connection and try again.");
  }
  const text = await res.text();
  let data: T | null = null;
  try {
    data = JSON.parse(text) as T;
  } catch {
    /* not JSON */
  }
  if (!res.ok) console.error(`[billing] razorpay ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return { ok: res.ok, status: res.status, data, text };
}

/**
 * Opens an order with Razorpay and hands the browser what Checkout needs.
 * Requires a signed-in user but NOT an active plan — this is how someone
 * without one gets one.
 */
export const createOrder = action({
  args: { plan: planValidator },
  returns: v.object({
    orderId: v.string(),
    amountPaise: v.number(),
    currency: v.string(),
    keyId: v.string(),
    oneRupeeTest: v.boolean(),
    reused: v.boolean(),
  }),
  handler: async (
    ctx,
    { plan },
  ): Promise<{
    orderId: string;
    amountPaise: number;
    currency: string;
    keyId: string;
    oneRupeeTest: boolean;
    reused: boolean;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in first.");

    const { keyId } = credentials();
    const chosen = PLANS[plan];

    // Every plan pays for exactly one business — the one on screen. An
    // order opened before any business exists could later be claimed by
    // whichever business came first, so it is refused instead.
    const business = await ctx.runQuery(internal.google.businessForUser, {
      userId,
    });
    if (!business) throw new ConvexError("Connect your Google profile first.");

    const verifiedEmail: string | null = await ctx.runQuery(
      internal.billing.verifiedEmailForUser,
      { userId },
    );
    const oneRupeeTest = isOneRupeeTester(verifiedEmail);
    const amountPaise = oneRupeeTest ? ONE_RUPEE_PAISE : chosen.amountPaise;

    // Reuse only an order with today's authoritative price, for this exact
    // business. Adding or removing an email from the allowlist cannot
    // resurrect an older price; switching business cannot reuse an order.
    const open = await ctx.runQuery(internal.billing.openOrder, {
      userId,
      plan,
      amountPaise,
      businessId: business._id,
    });
    if (open) {
      console.log(`[billing] reusing open order ${open.razorpayOrderId} for ${userId}`);
      return {
        orderId: open.razorpayOrderId,
        amountPaise: open.amountPaise,
        currency: open.currency,
        keyId,
        oneRupeeTest: open.oneRupeeTest === true,
        reused: true,
      };
    }

    const res = await razorpay<{ id?: string; amount?: number; currency?: string }>(
      "/orders",
      {
        method: "POST",
        body: {
          amount: amountPaise,
          currency: CURRENCY,
          // Razorpay caps the receipt at 40 characters.
          receipt: `ff_${plan}_${Date.now()}`.slice(0, 40),
          notes: {
            userId,
            plan,
            businessId: business._id,
            oneRupeeTest: oneRupeeTest ? "true" : "false",
          },
        },
      },
    );

    if (!res.ok || !res.data?.id) {
      throw new ConvexError("Could not start the payment. Please try again in a moment.");
    }
    if (res.data.amount !== amountPaise || res.data.currency !== CURRENCY) {
      console.error("[billing] Razorpay echoed a different order", res.data);
      throw new ConvexError("Razorpay returned an unexpected order. Please try again.");
    }

    await ctx.runMutation(internal.billing.recordPending, {
      userId,
      plan,
      amountPaise,
      oneRupeeTest,
      razorpayOrderId: res.data.id,
      businessId: business._id,
    });
    console.log(
      `[billing] order ${res.data.id} opened for ${userId} (${plan}${oneRupeeTest ? ", one-rupee production test" : ""})`,
    );

    return {
      orderId: res.data.id,
      amountPaise,
      currency: CURRENCY,
      keyId,
      oneRupeeTest,
      reused: false,
    };
  },
});

/**
 * Takes what Razorpay says about one payment and settles our row.
 *
 *   captured    -> paid (or mismatch, if the amount is wrong)
 *   authorized  -> try to capture it ourselves; if that works, paid
 *   failed      -> attempted, with the reason
 *   created     -> nothing yet (Checkout still open)
 *   refunded    -> paid first if we missed it, then leave it to the refund
 *                  webhook / reconcile to record the refund
 */
async function settle(
  ctx: ActionCtx,
  orderId: string,
  payment: RazorpayPayment,
  confirmedBy: string,
): Promise<{ state: string; already?: boolean; reason?: string }> {
  if (payment.order_id && payment.order_id !== orderId) {
    console.error(`[billing] payment ${payment.id} belongs to ${payment.order_id}, not ${orderId}`);
    return { state: "mismatch", reason: "payment belongs to a different order" };
  }

  if (payment.status === "captured" || payment.status === "refunded") {
    const r = await ctx.runMutation(internal.billing.markPaid, {
      razorpayOrderId: orderId,
      razorpayPaymentId: payment.id,
      amountPaise: payment.amount,
      currency: payment.currency,
      confirmedBy,
    });
    return r.ok ? { state: "paid", already: r.already } : { state: "mismatch", reason: r.reason };
  }

  if (payment.status === "authorized") {
    await ctx.runMutation(internal.billing.markAuthorized, {
      razorpayOrderId: orderId,
      razorpayPaymentId: payment.id,
    });
    // Auto-capture is on by default in Razorpay, but the dashboard setting
    // can be changed and some methods land as "authorized" first. Capture
    // it for exactly the amount we asked for — Razorpay refuses any other.
    const cap = await razorpay<RazorpayPayment>(`/payments/${payment.id}/capture`, {
      method: "POST",
      body: { amount: payment.amount, currency: payment.currency },
    });
    if (cap.ok && cap.data?.status === "captured") {
      const r = await ctx.runMutation(internal.billing.markPaid, {
        razorpayOrderId: orderId,
        razorpayPaymentId: payment.id,
        amountPaise: cap.data.amount,
        currency: cap.data.currency,
        confirmedBy: `${confirmedBy}+capture`,
      });
      return r.ok ? { state: "paid", already: r.already } : { state: "mismatch", reason: r.reason };
    }
    // Already captured by Razorpay in the meantime is fine; anything else
    // stays "authorized" and the reconcile cron tries again.
    if (cap.status === 400 && /already been captured/i.test(cap.text)) {
      const again = await razorpay<RazorpayPayment>(`/payments/${payment.id}`);
      if (again.ok && again.data?.status === "captured") {
        const r = await ctx.runMutation(internal.billing.markPaid, {
          razorpayOrderId: orderId,
          razorpayPaymentId: payment.id,
          amountPaise: again.data.amount,
          currency: again.data.currency,
          confirmedBy,
        });
        return r.ok ? { state: "paid", already: r.already } : { state: "mismatch", reason: r.reason };
      }
    }
    return { state: "authorized" };
  }

  if (payment.status === "failed") {
    await ctx.runMutation(internal.billing.markAttemptFailed, {
      razorpayOrderId: orderId,
      razorpayPaymentId: payment.id,
      code: payment.error_code ?? undefined,
      reason: payment.error_description ?? payment.error_reason ?? undefined,
      source: confirmedBy,
    });
    return { state: "failed", reason: payment.error_description ?? undefined };
  }

  return { state: "pending" };
}

/**
 * The browser's hand-back after Checkout closes.
 *
 * The signature is what makes this trustworthy: it is HMAC-SHA256 of
 * "<order_id>|<payment_id>" keyed with the secret, which only Razorpay and
 * this deployment know. A browser cannot forge it. Even so, the payment is
 * then fetched from Razorpay and only a *captured* payment for the right
 * amount grants anything. The webhook confirms the same payment
 * independently, so access still lands if the customer closes the tab
 * before this runs.
 */
export const verifyPayment = action({
  args: {
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.string(),
    razorpaySignature: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{
    ok: boolean;
    /** "paid" | "authorized" | "pending" | "failed" | "mismatch" | "deferred" */
    state: string;
    already?: boolean;
    reason?: string;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in first.");

    const row = await ctx.runQuery(internal.billing.byOrder, {
      orderId: args.razorpayOrderId,
    });
    if (!row || row.userId !== userId) {
      console.error(`[billing] verify for foreign/unknown order ${args.razorpayOrderId} by ${userId}`);
      throw new ConvexError("That order isn't yours.");
    }
    if (GRANTING.has(row.status)) return { ok: true, state: "paid", already: true };

    const { keySecret } = credentials();
    const expected = await hmacHex(
      keySecret,
      `${args.razorpayOrderId}|${args.razorpayPaymentId}`,
    );
    if (!safeEqual(expected, args.razorpaySignature)) {
      console.error("[billing] signature mismatch", args.razorpayOrderId);
      throw new ConvexError("That payment could not be verified. If money left your account it will be returned; please contact support with your payment id.");
    }

    // Local testing switch. With this set the browser verifies the payment
    // but leaves the grant to the webhook, so the path Razorpay's servers
    // take in production can be watched end to end on a laptop. Never set
    // it on production: a paying customer would sit waiting for a webhook.
    if (process.env.RAZORPAY_WEBHOOK_ONLY === "1") {
      console.log(
        `[billing] webhook-only mode: ${args.razorpayOrderId} verified, waiting for the webhook`,
      );
      return { ok: true, state: "deferred" };
    }

    // Signature good. Now ask Razorpay what actually happened.
    const res = await razorpay<RazorpayPayment>(`/payments/${args.razorpayPaymentId}`);
    if (!res.ok || !res.data) {
      // Razorpay is down or slow. The webhook and the reconcile cron will
      // finish the job; tell the screen to wait rather than to fail.
      await ctx.scheduler.runAfter(60_000, internal.billing.reconcileOrder, {
        orderId: args.razorpayOrderId,
      });
      return {
        ok: true,
        state: "pending",
        reason: "Razorpay hasn't confirmed the payment yet.",
      };
    }

    const result = await settle(ctx, args.razorpayOrderId, res.data, "browser");
    return { ok: result.state === "paid", ...result };
  },
});

/* ------------------------------ reconcile -------------------------------
   The webhook and the browser can both miss: a phone dies mid-redirect, a
   deploy drops a webhook, Razorpay is slow. So every open order can be
   re-checked against Razorpay's own record of it, by the owner from the
   screen or by the cron every fifteen minutes.                          */

async function reconcileOne(
  ctx: ActionCtx,
  orderId: string,
  who: string,
): Promise<{ state: string; reason?: string }> {
  const row = await ctx.runQuery(internal.billing.byOrder, { orderId });
  if (!row) return { state: "unknown" };
  if (GRANTING.has(row.status) || ["refunded", "mismatch"].includes(row.status)) {
    return { state: row.status };
  }
  // "expired" means our UI stopped waiting, not that Razorpay could never
  // capture it. If money moved late, reconcile it and grant what was paid for
  // rather than leaving a charged customer without access.

  const res = await razorpay<{ items?: RazorpayPayment[] }>(`/orders/${orderId}/payments`);
  if (!res.ok || !res.data) return { state: row.status, reason: "Razorpay unreachable" };

  const payments = res.data.items ?? [];
  if (payments.length === 0) return { state: row.status };

  // Prefer a captured payment, then an authorized one, then the latest.
  const pick =
    payments.find((p) => p.status === "captured" || p.status === "refunded") ??
    payments.find((p) => p.status === "authorized") ??
    payments[payments.length - 1];

  const settled = await settle(ctx, orderId, pick, `reconcile:${who}`);
  return { state: settled.state, reason: settled.reason };
}

export const reconcileOrder = internalAction({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => await reconcileOne(ctx, orderId, "cron"),
});

/** The owner's "check payment status" button. */
export const checkOrder = action({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }): Promise<{ state: string; reason?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in first.");
    const row = await ctx.runQuery(internal.billing.byOrder, { orderId });
    if (!row || row.userId !== userId) throw new ConvexError("That order isn't yours.");
    return await reconcileOne(ctx, orderId, "owner");
  },
});

export const unsettledOrders = internalQuery({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - ORDER_TTL_MS;
    const out: string[] = [];
    for (const s of ["created", "attempted", "authorized"]) {
      const rows = await ctx.db
        .query("subscriptions")
        .withIndex("by_status", (q) => q.eq("status", s))
        .take(200);
      for (const r of rows) if (r._creationTime > cutoff) out.push(r.razorpayOrderId);
    }
    return out;
  },
});

/** Every fifteen minutes: anything still open is checked with Razorpay. */
export const reconcilePending = internalAction({
  args: {},
  handler: async (ctx): Promise<{ checked: number; settled: number }> => {
    if (!process.env.RAZORPAY_KEY_ID) return { checked: 0, settled: 0 };
    const orders = await ctx.runQuery(internal.billing.unsettledOrders, {});
    let settled = 0;
    for (const orderId of orders) {
      try {
        const r = await reconcileOne(ctx, orderId, "cron");
        if (r.state === "paid") settled += 1;
      } catch (error) {
        console.error(`[billing] reconcile ${orderId} failed`, error);
      }
    }
    return { checked: orders.length, settled };
  },
});

/** The owner gave up on Checkout (closed the modal). Just a note. */
export const noteDismissed = mutation({
  args: { orderId: v.string() },
  handler: async (ctx, { orderId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;
    const row = await ctx.db
      .query("subscriptions")
      .withIndex("by_order", (q) => q.eq("razorpayOrderId", orderId))
      .first();
    if (!row || row.userId !== userId) return;
    if (!["created", "attempted"].includes(row.status)) return;
    console.log(`[billing] checkout dismissed on ${orderId}`);
    await ctx.db.patch(row._id, { updatedAt: Date.now() });
  },
});

/** Checkout's own "payment.failed" event, so the reason is kept even if
    the webhook is late. Razorpay's record still wins on reconcile. */
export const noteCheckoutFailure = mutation({
  args: {
    orderId: v.string(),
    paymentId: v.optional(v.string()),
    code: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return;
    const row = await ctx.db
      .query("subscriptions")
      .withIndex("by_order", (q) => q.eq("razorpayOrderId", args.orderId))
      .first();
    if (!row || row.userId !== userId) return;
    await ctx.runMutation(internal.billing.markAttemptFailed, {
      razorpayOrderId: args.orderId,
      razorpayPaymentId: args.paymentId,
      code: args.code,
      reason: args.reason,
      source: "checkout",
    });
  },
});

/* -------------------------------- webhook ------------------------------- */

/**
 * Writes the event row first. If the id is already there, this is a
 * redelivery and the caller must do nothing. Everything the webhook does
 * afterwards is itself idempotent, so this is belt and braces.
 */
export const claimEvent = internalMutation({
  args: {
    eventId: v.string(),
    event: v.string(),
    razorpayOrderId: v.optional(v.string()),
    razorpayPaymentId: v.optional(v.string()),
    razorpayRefundId: v.optional(v.string()),
  },
  returns: v.union(v.id("paymentEvents"), v.null()),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("paymentEvents")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();
    if (existing) {
      console.log(`[razorpay] duplicate event ${args.eventId} (${args.event})`);
      return null;
    }
    return await ctx.db.insert("paymentEvents", {
      ...args,
      outcome: "received",
      receivedAt: Date.now(),
    });
  },
});

export const finishEvent = internalMutation({
  args: { id: v.id("paymentEvents"), outcome: v.string(), note: v.optional(v.string()) },
  handler: async (ctx, { id, outcome, note }) => {
    await ctx.db.patch(id, { outcome, note });
  },
});

type WebhookBody = {
  event?: string;
  payload?: {
    payment?: { entity?: RazorpayPayment };
    order?: { entity?: { id?: string; amount?: number; currency?: string } };
    refund?: {
      entity?: {
        id?: string;
        payment_id?: string;
        amount?: number;
        status?: string;
        speed_processed?: string;
        notes?: Record<string, string>;
      };
    };
  };
};

/**
 * Acts on one already-verified webhook. Runs as an action so it can call
 * Razorpay (to capture an authorized payment) — an http action can't.
 */
export const handleWebhook = internalAction({
  args: { eventId: v.string(), body: v.any() },
  handler: async (ctx, { eventId, body }): Promise<string> => {
    const b = body as WebhookBody;
    const name = typeof b.event === "string" ? b.event : "";
    const payment = b.payload?.payment?.entity;
    const refund = b.payload?.refund?.entity;

    const claim = await ctx.runMutation(internal.billing.claimEvent, {
      eventId,
      event: name,
      razorpayOrderId: payment?.order_id ?? undefined,
      razorpayPaymentId: payment?.id ?? refund?.payment_id ?? undefined,
      razorpayRefundId: refund?.id ?? undefined,
    });
    if (!claim) return "duplicate";

    let outcome = "ignored";
    let note: string | undefined;
    try {
      switch (name) {
        case "payment.captured":
        case "payment.authorized":
        case "payment.failed": {
          if (!payment?.id || !payment.order_id) {
            note = "payment event without id/order";
            break;
          }
          const r = await settle(ctx, payment.order_id, payment, "webhook");
          outcome = "processed";
          note = `${r.state}${r.already ? " (already)" : ""}${r.reason ? `: ${r.reason}` : ""}`;
          break;
        }
        case "order.paid": {
          // Same information as payment.captured, from the order's side.
          // Useful only when the captured event was lost.
          const orderId = b.payload?.order?.entity?.id;
          if (orderId) {
            const r = await reconcileOne(ctx, orderId, "order.paid");
            outcome = "processed";
            note = r.state;
          }
          break;
        }
        case "refund.created":
        case "refund.processed":
        case "refund.failed": {
          if (!refund?.id || !refund.payment_id || typeof refund.amount !== "number") {
            note = "refund event without id/payment/amount";
            break;
          }
          const status = name.split(".")[1];
          const r = await ctx.runMutation(internal.billing.applyRefund, {
            razorpayRefundId: refund.id,
            razorpayPaymentId: refund.payment_id,
            amountPaise: refund.amount,
            status,
            speed: refund.speed_processed,
            reason: refund.notes?.reason,
          });
          outcome = r.ok ? "processed" : "failed";
          note = r.note;
          break;
        }
        default:
          note = `no handler for ${name}`;
      }
    } catch (error) {
      outcome = "failed";
      note = error instanceof Error ? error.message : String(error);
      console.error(`[razorpay] ${name} ${eventId} failed`, error);
    }

    await ctx.runMutation(internal.billing.finishEvent, { id: claim, outcome, note });
    console.log(`[razorpay] ${name} ${eventId} -> ${outcome} ${note ?? ""}`);
    return outcome;
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
 *   npx convex run billing:grantComp --prod \
 *     '{"email":"owner@example.com","days":365,"reason":"first five"}'
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
    if (!user) throw new ConvexError(`No user with the email ${email}.`);

    const now = Date.now();
    // A comp covers the business the account is currently running.
    const business = await activeBusinessFor(ctx, user._id);
    const legacyId = await legacyPlanBusinessId(ctx, user._id);
    const existing = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    const furthest = existing
      .filter(
        (r) =>
          GRANTING.has(r.status) &&
          subscriptionBusinessId(r, legacyId) === (business?._id ?? null),
      )
      .reduce((max, r) => Math.max(max, r.expiresAt ?? 0), 0);
    const startsAt = Math.max(now, furthest);

    await ctx.db.insert("subscriptions", {
      userId: user._id,
      businessId: business?._id,
      plan: "comp",
      amountPaise: 0,
      currency: CURRENCY,
      razorpayOrderId: `comp_${now}`,
      status: "paid",
      paidAt: now,
      startsAt,
      expiresAt: startsAt + days * DAY,
      confirmedBy: `comp: ${reason}`,
      updatedAt: now,
    });

    return { email, until: startsAt + days * DAY };
  },
});

/**
 * Refunds a payment, in full or in part, from the command line:
 *
 *   npx convex run billing:issueRefund --prod \
 *     '{"paymentId":"pay_XXX","amountPaise":199900,"reason":"double charge"}'
 *
 * The refund itself lands through the webhook (refund.processed), which
 * is what ends access; this only asks Razorpay to start it. Razorpay's
 * own idempotency: the receipt is the payment id + amount, so running it
 * twice by mistake refunds once.
 */
export const issueRefund = internalAction({
  args: {
    paymentId: v.string(),
    amountPaise: v.optional(v.number()),
    reason: v.string(),
  },
  handler: async (ctx, { paymentId, amountPaise, reason }) => {
    const res = await razorpay<{ id?: string; status?: string; amount?: number }>(
      `/payments/${paymentId}/refund`,
      {
        method: "POST",
        body: {
          amount: amountPaise,
          speed: "normal",
          receipt: `rf_${paymentId}_${amountPaise ?? "full"}`.slice(0, 40),
          notes: { reason },
        },
      },
    );
    if (!res.ok || !res.data?.id) {
      throw new ConvexError(`Razorpay refused the refund: ${res.text.slice(0, 200)}`);
    }
    await ctx.runMutation(internal.billing.applyRefund, {
      razorpayRefundId: res.data.id,
      razorpayPaymentId: paymentId,
      amountPaise: res.data.amount ?? amountPaise ?? 0,
      status: res.data.status === "processed" ? "processed" : "created",
      reason,
    });
    return { refundId: res.data.id, status: res.data.status };
  },
});

/* ------------------------------ backfill --------------------------------
   One-off, for the move to per-business plans: rows written before
   subscriptions carried a businessId are pinned to the business their
   owner is running. Run once after deploy:

     npx convex run billing:backfillSubscriptionBusinesses               */

export const backfillSubscriptionBusinesses = internalMutation({
  args: {},
  returns: v.object({ pinned: v.number(), orphaned: v.number(), scanned: v.number() }),
  handler: async (ctx) => {
    // Bounded batch; run again if `scanned` hits the cap. Pins to the
    // OLDEST business — the only one that existed when a pre-multi-business
    // row could have been paid — exactly matching the runtime legacy rule,
    // so running this migration changes no one's access.
    const rows = await ctx.db.query("subscriptions").take(500);
    let pinned = 0;
    let orphaned = 0;
    for (const row of rows) {
      if (row.businessId !== undefined) continue;
      const legacyId = await legacyPlanBusinessId(ctx, row.userId);
      if (!legacyId) {
        // No business at all — nothing to pin to yet.
        orphaned += 1;
        continue;
      }
      await ctx.db.patch(row._id, { businessId: legacyId });
      pinned += 1;
    }
    console.log(`[billing] backfill pinned ${pinned}, left ${orphaned} orphaned`);
    return { pinned, orphaned, scanned: rows.length };
  },
});

/* ------------------------------ reminders -------------------------------- */

/**
 * A week before a plan runs out, and again the day it does: in-app note,
 * email, and an SMS. There is no auto-debit, so this is the only thing
 * standing between a working listing and a dead one.
 */
export const remindExpiring = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const soon = now + 7 * DAY;

    const paid = await ctx.db
      .query("subscriptions")
      .withIndex("by_status", (q) => q.eq("status", "paid"))
      .take(1000);
    const partial = await ctx.db
      .query("subscriptions")
      .withIndex("by_status", (q) => q.eq("status", "partially_refunded"))
      .take(1000);
    const rows = [...paid, ...partial];

    let warned = 0;
    let ended = 0;

    for (const row of rows) {
      const expiresAt = row.expiresAt ?? 0;
      const plan = PLANS[row.plan as PlanId]?.name ?? row.plan;

      // Only the row that carries the furthest date speaks for its
      // BUSINESS; otherwise a renewed owner would be warned about the old
      // period, and one listing's renewal would silence another's expiry.
      const legacyId = await legacyPlanBusinessId(ctx, row.userId);
      const rowBusiness = subscriptionBusinessId(row, legacyId);
      const others = await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q) => q.eq("userId", row.userId))
        .collect();
      const furthest = others
        .filter(
          (r) =>
            GRANTING.has(r.status) &&
            subscriptionBusinessId(r, legacyId) === rowBusiness,
        )
        .reduce((max, r) => Math.max(max, r.expiresAt ?? 0), 0);
      if (expiresAt < furthest) continue;

      const business = rowBusiness
        ? await ctx.db.get(rowBusiness)
        : await activeBusinessFor(ctx, row.userId);

      // Expired since the last run, and not yet told.
      if (expiresAt <= now && expiresAt > now - 2 * DAY && !row.expiredEmailedAt) {
        await ctx.db.patch(row._id, { expiredEmailedAt: now });
        if (business) {
          await ctx.db.insert("agentActions", {
            businessId: business._id,
            type: "billing",
            title: "Your plan has ended",
            detail: "Renew to start posts, review replies and rank tracking again.",
            createdAt: now,
          });
        }
        await ctx.scheduler.runAfter(0, internal.email.sendToUser, {
          userId: row.userId,
          template: "plan_expired",
          dedupeKey: `plan_expired:${row._id}`,
          params: { plan, expiresAt },
        });
        await ctx.scheduler.runAfter(0, internal.billing.textOwner, {
          userId: row.userId,
          purpose: "plan_expired",
          dedupeKey: `plan_expired:${row._id}`,
          body: `Your footfall plan has ended, so posts and review replies are paused. Renew any time: ${process.env.SITE_URL ?? "https://footfall.zone"}/app/billing`,
        });
        ended += 1;
        continue;
      }

      if (expiresAt <= now || expiresAt > soon || row.expiringEmailedAt) continue;

      const days = Math.max(0, Math.ceil((expiresAt - now) / DAY));
      await ctx.db.patch(row._id, { expiringEmailedAt: now });
      if (business) {
        await ctx.db.insert("agentActions", {
          businessId: business._id,
          type: "billing",
          title: `Your plan ends in ${days} day${days === 1 ? "" : "s"}`,
          detail:
            "Renew to keep posts going up, reviews answered and enquiries picked up.",
          createdAt: now,
        });
      }
      await ctx.scheduler.runAfter(0, internal.email.sendToUser, {
        userId: row.userId,
        template: "plan_expiring",
        dedupeKey: `plan_expiring:${row._id}`,
        params: { plan, days, expiresAt },
      });
      await ctx.scheduler.runAfter(0, internal.billing.textOwner, {
        userId: row.userId,
        purpose: "plan_expiring",
        dedupeKey: `plan_expiring:${row._id}`,
        body: `Your footfall plan ends in ${days} day${days === 1 ? "" : "s"}. There's no auto-debit — renew here to keep it running: ${process.env.SITE_URL ?? "https://footfall.zone"}/app/billing`,
      });
      warned += 1;
    }

    return { checked: rows.length, warned, ended };
  },
});

export const ownerPhone = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({ phone: v.string(), businessId: v.optional(v.id("businesses")) }),
    v.null(),
  ),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    const business = await activeBusinessFor(ctx, userId);
    const phone = user?.phone ?? business?.phone ?? null;
    if (!phone) return null;
    return { phone, businessId: business?._id };
  },
});

/** An SMS to the owner's own number, if we have one. */
export const textOwner = internalAction({
  args: {
    userId: v.id("users"),
    purpose: v.string(),
    dedupeKey: v.string(),
    body: v.string(),
  },
  handler: async (ctx, { userId, purpose, dedupeKey, body }): Promise<SendResult> => {
    const who: { phone: string; businessId?: Id<"businesses"> } | null =
      await ctx.runQuery(internal.billing.ownerPhone, { userId });
    if (!who) return { ok: false, status: "skipped", id: null };
    return await sendMessage(ctx, {
      to: who.phone,
      body,
      channel: "sms",
      purpose,
      dedupeKey: `sms:${dedupeKey}`,
      userId,
      businessId: who.businessId,
    });
  },
});
