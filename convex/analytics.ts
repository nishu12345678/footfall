import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  analyticsEventValidator,
  analyticsSourceValidator,
  type AnalyticsEvent,
  type AnalyticsSource,
} from "./schema";

/* ---------------------------------------------------------------------------
   The product event ledger.

   One function writes it: recordAnalyticsEvent, called inline from the
   mutation that commits the business fact. That matters for two reasons.

   Transactional. A Convex mutation is a transaction, so the event and the
   fact land together or not at all. A scheduled "also log this" would
   record signups that rolled back and lose the ones that didn't.

   Idempotent. Every terminal fact has a deterministic dedupeKey — the
   subscription order id, the post id, the business id and step number.
   Razorpay redelivers webhooks, actions retry, owners refresh. The second
   write finds the key, returns { recorded: false } and changes nothing,
   including the aggregates.

   The aggregates (analyticsDaily, analyticsTotals) are maintained here, in
   that same transaction, so the dashboard never has to count rows.

   PRIVACY. metadata is scrubbed on the way in: only short strings, finite
   numbers and booleans on an allowlist of keys survive. There is no key
   for an email, phone, name, address, review text, OAuth token, Razorpay
   signature or provider body, so there is no way to put one here by
   accident. See docs/product-analytics.md.
--------------------------------------------------------------------------- */

/** The calendar day a fact belongs to, in the market we sell in. */
const IST_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "2026-08-29" for an epoch-millis instant, in IST. */
export function istDay(ms: number): string {
  return IST_DAY.format(new Date(ms));
}

/** The IST day `n` days before `ms`, inclusive of today when n = 0. */
export function istDayBefore(ms: number, days: number): string {
  return istDay(ms - days * 24 * 60 * 60 * 1000);
}

/**
 * The only metadata keys that may be stored, and what each means.
 *
 * An allowlist rather than a denylist: a new call site cannot invent
 * `email` or `reviewText` and have it silently persisted. Anything not
 * named here is dropped, not rejected, so adding a debugging field to a
 * call site can never take down a payment.
 */
export const ALLOWED_METADATA_KEYS = [
  /** "post" | "photo" | "review_reply" — what was generated or published. */
  "kind",
  /** Onboarding step number, 2..6. */
  "step",
  /** "monthly" | "yearly" | "comp". Never an amount; that has its own field. */
  "plan",
  /** Which side confirmed a payment: "browser" | "webhook" | "reconcile". */
  "confirmedBy",
  /** A short error CLASS, never a provider message. e.g. "access_denied". */
  "errorClass",
  /** "google" | "ai" | "user" — who wrote the content. */
  "generatedBy",
  /** True when a refund returned the whole amount. */
  "full",
  /** How many items a run produced. */
  "count",
  /** True when this is the account's first publish of any kind. */
  "firstValue",
  /** Who set the work going: "owner" | "cron" | "agent". */
  "trigger",
  /** True for a reconnect of a listing we had seen before. */
  "reconnect",
] as const;

export type AllowedMetadataKey = (typeof ALLOWED_METADATA_KEYS)[number];

const ALLOWED = new Set<string>(ALLOWED_METADATA_KEYS);

/** Metadata values are small scalars. Nothing free-form, nothing nested. */
export type MetadataValue = string | number | boolean;
export type AnalyticsMetadata = Partial<Record<AllowedMetadataKey, MetadataValue>>;

const metadataValueValidator = v.union(v.string(), v.number(), v.boolean());

export const analyticsMetadataValidator = v.record(
  v.string(),
  metadataValueValidator,
);

/** Longest metadata string kept. Enough for a class, too short for prose. */
const MAX_METADATA_STRING = 64;
/** A defensive cap: no call site needs more than this many keys. */
const MAX_METADATA_KEYS = 8;

/**
 * Drops anything that is not an allowlisted key holding a small scalar.
 * Strings are trimmed and truncated; non-finite numbers are dropped.
 * Returns undefined when nothing survives, so the column stays absent
 * instead of storing an empty object.
 */
export function sanitizeMetadata(
  raw: Record<string, MetadataValue> | undefined,
): Record<string, MetadataValue> | undefined {
  if (!raw) return undefined;
  const out: Record<string, MetadataValue> = {};
  let kept = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (kept >= MAX_METADATA_KEYS) break;
    if (!ALLOWED.has(key)) continue;
    if (typeof value === "string") {
      const text = value.trim().slice(0, MAX_METADATA_STRING);
      if (!text) continue;
      out[key] = text;
    } else if (typeof value === "number") {
      if (!Number.isFinite(value)) continue;
      out[key] = value;
    } else if (typeof value === "boolean") {
      out[key] = value;
    } else {
      continue;
    }
    kept += 1;
  }
  return kept > 0 ? out : undefined;
}

export type RecordEventArgs = {
  event: AnalyticsEvent;
  /** Deterministic identity of the fact. Same key twice writes once. */
  dedupeKey: string;
  source: AnalyticsSource;
  /** Defaults to now. Pass the fact's own timestamp when backfilling. */
  occurredAt?: number;
  userId?: Id<"users">;
  businessId?: Id<"businesses">;
  /** Integer paise. Rounded, never negative. */
  amountPaise?: number;
  currency?: string;
  metadata?: AnalyticsMetadata;
};

export type RecordEventResult = {
  /** False when the dedupeKey was already present: nothing changed. */
  recorded: boolean;
  eventId: Id<"analyticsEvents"> | null;
};

/**
 * Writes one event and folds it into both aggregates, exactly once.
 *
 * Call this from the mutation that commits the fact. It is a plain helper,
 * not a registered function, so it joins the caller's transaction rather
 * than opening a subtransaction of its own.
 *
 * It never throws for a business reason. An analytics write must not be
 * able to fail a payment, a publish or a signup, so a bad amount is
 * normalised and a duplicate is a quiet no-op.
 */
export async function recordAnalyticsEvent(
  ctx: MutationCtx,
  args: RecordEventArgs,
): Promise<RecordEventResult> {
  const dedupeKey = args.dedupeKey.trim().slice(0, 256);
  if (!dedupeKey) {
    // A key-less event cannot be deduped, so it would inflate counts on
    // every retry. Refusing it is safer than recording it.
    console.error(`[analytics] ${args.event} with an empty dedupeKey; dropped`);
    return { recorded: false, eventId: null };
  }

  // The one read that makes this idempotent. Indexed, so it stays cheap
  // however long the ledger gets.
  const existing = await ctx.db
    .query("analyticsEvents")
    .withIndex("by_dedupe", (q) => q.eq("dedupeKey", dedupeKey))
    .first();
  if (existing) return { recorded: false, eventId: existing._id };

  const occurredAt = args.occurredAt ?? Date.now();
  const day = istDay(occurredAt);

  // Paise are integers. A float or a negative is a bug upstream; clamp it
  // rather than storing money that cannot be reconciled.
  const amountPaise =
    typeof args.amountPaise === "number" && Number.isFinite(args.amountPaise)
      ? Math.max(0, Math.round(args.amountPaise))
      : undefined;

  const eventId = await ctx.db.insert("analyticsEvents", {
    event: args.event,
    occurredAt,
    day,
    source: args.source,
    dedupeKey,
    userId: args.userId,
    businessId: args.businessId,
    amountPaise,
    currency: amountPaise === undefined ? undefined : (args.currency ?? "INR"),
    metadata: sanitizeMetadata(args.metadata),
  });

  const money = amountPaise ?? 0;

  const daily = await ctx.db
    .query("analyticsDaily")
    .withIndex("by_day_event", (q) => q.eq("day", day).eq("event", args.event))
    .first();
  if (daily) {
    await ctx.db.patch(daily._id, {
      count: daily.count + 1,
      amountPaise: daily.amountPaise + money,
    });
  } else {
    await ctx.db.insert("analyticsDaily", {
      day,
      event: args.event,
      count: 1,
      amountPaise: money,
    });
  }

  const totals = await ctx.db
    .query("analyticsTotals")
    .withIndex("by_event", (q) => q.eq("event", args.event))
    .first();
  if (totals) {
    await ctx.db.patch(totals._id, {
      count: totals.count + 1,
      amountPaise: totals.amountPaise + money,
      // Backfilled rows arrive out of order, so both ends move.
      firstOccurredAt: Math.min(totals.firstOccurredAt, occurredAt),
      lastOccurredAt: Math.max(totals.lastOccurredAt, occurredAt),
    });
  } else {
    await ctx.db.insert("analyticsTotals", {
      event: args.event,
      count: 1,
      amountPaise: money,
      firstOccurredAt: occurredAt,
      lastOccurredAt: occurredAt,
    });
  }

  return { recorded: true, eventId };
}

/**
 * The same write, for callers that only hold an ActionCtx.
 *
 * Prefer the helper above: an action calling this runs in its own
 * transaction, so the event can commit while the fact it describes does
 * not. Used only where the fact itself already lives in an action.
 */
export const record = internalMutation({
  args: {
    event: analyticsEventValidator,
    dedupeKey: v.string(),
    source: analyticsSourceValidator,
    occurredAt: v.optional(v.number()),
    userId: v.optional(v.id("users")),
    businessId: v.optional(v.id("businesses")),
    amountPaise: v.optional(v.number()),
    currency: v.optional(v.string()),
    metadata: v.optional(analyticsMetadataValidator),
  },
  returns: v.object({
    recorded: v.boolean(),
    eventId: v.union(v.id("analyticsEvents"), v.null()),
  }),
  handler: async (ctx, args): Promise<RecordEventResult> =>
    await recordAnalyticsEvent(ctx, args as RecordEventArgs),
});

/**
 * "The owner finished onboarding step N."
 *
 * Steps only ever move forward, and the screens are re-enterable: an owner
 * editing step 2 after reaching step 5 calls the same mutation again. The
 * key is (business, step), so the second pass is a no-op and the funnel
 * measures how far each business got rather than how often it was edited.
 */
export async function recordOnboardingStep(
  ctx: MutationCtx,
  args: {
    businessId: Id<"businesses">;
    userId: Id<"users">;
    /** The step being completed, 2..5. */
    step: number;
  },
): Promise<RecordEventResult> {
  return await recordAnalyticsEvent(ctx, {
    event: "onboarding_step_completed",
    dedupeKey: dedupe.onboardingStep(args.businessId, args.step),
    source: "owner",
    userId: args.userId,
    businessId: args.businessId,
    metadata: { step: args.step },
  });
}

/* ------------------------------- dedupe keys -----------------------------
   One place that spells them, so a call site and the backfill that has to
   agree with it cannot drift apart. Each key is the identity of the fact
   itself — never a timestamp — because a retry must produce the same key. */

export const dedupe = {
  accountCreated: (userId: Id<"users">) => `account_created:${userId}`,

  // The attempt id is the non-secret googleLinkTokens document id, never the
  // one-time OAuth state token itself. A dedupe key lives forever; an expired
  // credential must not.
  gbpConnectStarted: (attemptId: string) =>
    `gbp_connect_started:${attemptId}`,
  gbpConnectFailed: (attemptId: string) => `gbp_connect_failed:${attemptId}`,

  businessConnected: (businessId: Id<"businesses">) =>
    `business_connected:${businessId}`,
  /**
   * A listing can genuinely be reconnected more than once, so unlike a
   * first connection this key is not just the business id. It is bounded
   * by the IST day instead of the instant: an instant would change on
   * every retry of the linking action and inflate the count, whereas one
   * owner reconnecting twice in a day is one reconnection worth counting.
   */
  businessReconnected: (businessId: Id<"businesses">, day: string) =>
    `business_reconnected:${businessId}:${day}`,

  onboardingStep: (businessId: Id<"businesses">, step: number) =>
    `onboarding_step:${businessId}:${step}`,
  onboardingCompleted: (businessId: Id<"businesses">) =>
    `onboarding_completed:${businessId}`,

  auditCompleted: (businessId: Id<"businesses">, day: string) =>
    `audit_completed:${businessId}:${day}`,

  contentGenerated: (runId: Id<"postGenerations">) =>
    `content_generated:${runId}`,
  contentPublished: (kind: string, rowId: string) =>
    `content_published:${kind}:${rowId}`,
  sitePublished: (siteId: Id<"sites">) => `site_published:${siteId}`,

  checkoutStarted: (orderId: string) => `checkout_started:${orderId}`,
  /** An order can be retried, so a failure is keyed by the payment. */
  checkoutFailed: (orderId: string, paymentId: string | undefined) =>
    `checkout_failed:${orderId}:${paymentId ?? "none"}`,
  /** At most one dismissal per order: closing the modal five times is one
      owner giving up once, and the browser must not be able to say
      otherwise. */
  checkoutDismissed: (orderId: string) => `checkout_dismissed:${orderId}`,

  paymentSucceeded: (orderId: string) => `payment_succeeded:${orderId}`,
  paymentRefunded: (refundId: string) => `payment_refunded:${refundId}`,
} as const;
