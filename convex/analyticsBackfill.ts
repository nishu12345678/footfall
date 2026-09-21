import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import { dedupe, istDay, recordAnalyticsEvent } from "./analytics";

/* ---------------------------------------------------------------------------
   Backfilling the event ledger from the rows that predate it.

   Forward events are exact, because they are written in the transaction
   that commits the fact. Everything that happened before the ledger
   existed has to be DERIVED, and only some of it can be derived honestly.

   What is derived here, and from what:

     account_created        users._creationTime
     business_connected     businesses._creationTime
     onboarding_completed   businesses.agentStartedAt — the only stored
                            timestamp for finishing setup
     checkout_started       subscriptions._creationTime (the order row)
     payment_succeeded      subscriptions.paidAt, granting rows only
     payment_refunded       refunds.status === "processed"
     content_published      posts / photos / reviews that actually went out

   What is deliberately NOT derived, because the facts were never stored:

     gbp_connect_started / gbp_connect_failed — a failed consent attempt
       left no row at all. Inventing one would fabricate a funnel step.
     onboarding_step_completed — businesses store only the step REACHED,
       never when each step was passed. A guessed timestamp would put
       real-looking points on the trend chart that never happened.
     business_reconnected — a reconnection overwrote the listing fields
       in place and left no dated trace.
     checkout_failed / checkout_dismissed — the subscription row keeps the
       LAST failure, not each one, and never records a dismissal.
     audit_completed / content_generated / site_published — listingSyncedAt
       and sites.updatedAt are last-touched stamps, not events.

   Two exclusions inside content_published, from the same principle:

     posts with generatedBy === "google" were already on the listing when
       the shop connected. They are the shop's own history, not value this
       product delivered.
     photos without a storageId are mirrors of Google's gallery pulled
       down by the sync, not uploads we pushed up.

   Shape: bounded and resumable. Each call handles one page of one table
   and schedules itself for the next, so a table of any size is walked in
   transaction-sized pieces. Idempotent throughout — every write goes
   through recordAnalyticsEvent with the SAME dedupe key the live code
   uses, so running the backfill twice, or running it over rows the live
   code already recorded, changes nothing.

   Run it with:
     npx convex run analyticsBackfill:start '{}'
--------------------------------------------------------------------------- */

/** Rows per transaction. Small enough to stay well inside the limits. */
const BATCH = 100;

/**
 * The tables, in the order they are walked. Order is cosmetic — every
 * phase is independent and idempotent — but it follows the funnel so a
 * half-finished run is still readable.
 */
const PHASES = [
  "users",
  "businesses",
  "subscriptions",
  "refunds",
  "posts",
  "photos",
  "reviews",
] as const;

type Phase = (typeof PHASES)[number];

const phaseValidator = v.union(
  v.literal("users"),
  v.literal("businesses"),
  v.literal("subscriptions"),
  v.literal("refunds"),
  v.literal("posts"),
  v.literal("photos"),
  v.literal("reviews"),
);

const progressValidator = v.object({
  phase: phaseValidator,
  /** Rows examined in this call. */
  scanned: v.number(),
  /** Events actually written in this call — dedupes are not counted. */
  recorded: v.number(),
  /** True when this was the last page of the last table. */
  done: v.boolean(),
});

/** Which plan statuses mean money was captured and a period granted. */
const GRANTING = new Set(["paid", "partially_refunded", "refunded"]);

/**
 * Starts the walk. Safe to run more than once: a second run re-derives the
 * same facts under the same keys and writes nothing.
 */
export const start = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.analyticsBackfill.step, {
      phase: "users",
      cursor: null,
    });
    return null;
  },
});

/**
 * One page of one table, then a scheduled continuation.
 *
 * Each continuation is a fresh transaction, which is what keeps a table of
 * any size within the mutation limits. The cursor is Convex's own, so
 * pages stay adjacent and non-overlapping.
 */
export const step = internalMutation({
  args: {
    phase: phaseValidator,
    cursor: v.union(v.string(), v.null()),
    batchSize: v.optional(v.number()),
  },
  returns: progressValidator,
  handler: async (ctx, { phase, cursor, batchSize }) => {
    const numItems = Math.max(1, Math.min(batchSize ?? BATCH, 500));
    let scanned = 0;
    let recorded = 0;

    const bump = (result: { recorded: boolean }) => {
      if (result.recorded) recorded += 1;
    };

    let isDone = true;
    let continueCursor: string | null = null;

    if (phase === "users") {
      const page = await ctx.db.query("users").paginate({ cursor, numItems });
      isDone = page.isDone;
      continueCursor = page.continueCursor;
      scanned = page.page.length;
      for (const user of page.page) {
        // The account exists, so it was created. _creationTime is exact.
        bump(
          await recordAnalyticsEvent(ctx, {
            event: "account_created",
            dedupeKey: dedupe.accountCreated(user._id),
            source: "backfill",
            occurredAt: user._creationTime,
            userId: user._id,
          }),
        );
      }
    } else if (phase === "businesses") {
      const page = await ctx.db
        .query("businesses")
        .paginate({ cursor, numItems });
      isDone = page.isDone;
      continueCursor = page.continueCursor;
      scanned = page.page.length;
      for (const business of page.page) {
        bump(
          await recordAnalyticsEvent(ctx, {
            event: "business_connected",
            dedupeKey: dedupe.businessConnected(business._id),
            source: "backfill",
            occurredAt: business._creationTime,
            userId: business.userId,
            businessId: business._id,
          }),
        );

        // agentStartedAt is the one stored moment setup was finished. A
        // business flagged complete WITHOUT it is left alone: we know it
        // finished, but not when, and a made-up date would land on the
        // trend chart as if it were measured.
        if (business.onboardingComplete && business.agentStartedAt) {
          bump(
            await recordAnalyticsEvent(ctx, {
              event: "onboarding_completed",
              dedupeKey: dedupe.onboardingCompleted(business._id),
              source: "backfill",
              occurredAt: business.agentStartedAt,
              userId: business.userId,
              businessId: business._id,
            }),
          );
        }
      }
    } else if (phase === "subscriptions") {
      const page = await ctx.db
        .query("subscriptions")
        .paginate({ cursor, numItems });
      isDone = page.isDone;
      continueCursor = page.continueCursor;
      scanned = page.page.length;
      for (const sub of page.page) {
        // A comp row was granted by hand; nobody opened Checkout for it.
        const realOrder = !sub.razorpayOrderId.startsWith("comp_");

        if (realOrder) {
          bump(
            await recordAnalyticsEvent(ctx, {
              event: "checkout_started",
              dedupeKey: dedupe.checkoutStarted(sub.razorpayOrderId),
              source: "backfill",
              occurredAt: sub._creationTime,
              userId: sub.userId,
              businessId: sub.businessId,
              metadata: { plan: sub.plan },
            }),
          );
        }

        // Money, only where money was actually captured. `refunded` is
        // included because a refunded plan WAS paid first — the refund
        // below subtracts it. amountPaise is what we charged, which for
        // a captured row is what Razorpay took.
        if (GRANTING.has(sub.status) && sub.paidAt && sub.amountPaise > 0) {
          bump(
            await recordAnalyticsEvent(ctx, {
              event: "payment_succeeded",
              dedupeKey: dedupe.paymentSucceeded(sub.razorpayOrderId),
              source: "backfill",
              occurredAt: sub.paidAt,
              userId: sub.userId,
              businessId: sub.businessId,
              amountPaise: sub.amountPaise,
              currency: sub.currency,
              metadata: { plan: sub.plan },
            }),
          );
        }
      }
    } else if (phase === "refunds") {
      const page = await ctx.db.query("refunds").paginate({ cursor, numItems });
      isDone = page.isDone;
      continueCursor = page.continueCursor;
      scanned = page.page.length;
      for (const refund of page.page) {
        // Only a processed refund returned money. Created and failed ones
        // did not, and counting them would understate net revenue.
        if (refund.status !== "processed") continue;
        const sub = await ctx.db.get(refund.subscriptionId);
        bump(
          await recordAnalyticsEvent(ctx, {
            event: "payment_refunded",
            dedupeKey: dedupe.paymentRefunded(refund.razorpayRefundId),
            source: "backfill",
            occurredAt: refund.updatedAt || refund.createdAt,
            userId: refund.userId,
            businessId: sub?.businessId,
            amountPaise: refund.amountPaise,
            currency: sub?.currency ?? "INR",
            metadata: {
              full: (sub?.amountPaise ?? 0) > 0
                ? refund.amountPaise >= (sub?.amountPaise ?? 0)
                : false,
            },
          }),
        );
      }
    } else if (phase === "posts") {
      const page = await ctx.db.query("posts").paginate({ cursor, numItems });
      isDone = page.isDone;
      continueCursor = page.continueCursor;
      scanned = page.page.length;
      for (const post of page.page) {
        if (post.status !== "published" || !post.publishedAt) continue;
        // Already on the listing before we arrived. Not our value.
        if (post.generatedBy === "google") continue;
        const business = await ctx.db.get(post.businessId);
        bump(
          await recordAnalyticsEvent(ctx, {
            event: "content_published",
            dedupeKey: dedupe.contentPublished("post", post._id),
            source: "backfill",
            occurredAt: post.publishedAt,
            userId: business?.userId,
            businessId: post.businessId,
            metadata: { kind: "post", generatedBy: post.generatedBy },
          }),
        );
      }
    } else if (phase === "photos") {
      const page = await ctx.db.query("photos").paginate({ cursor, numItems });
      isDone = page.isDone;
      continueCursor = page.continueCursor;
      scanned = page.page.length;
      for (const photo of page.page) {
        if (photo.status !== "published" || !photo.publishedAt) continue;
        // No storageId means this row mirrors Google's gallery rather
        // than recording an upload of ours.
        if (!photo.storageId) continue;
        const business = await ctx.db.get(photo.businessId);
        bump(
          await recordAnalyticsEvent(ctx, {
            event: "content_published",
            dedupeKey: dedupe.contentPublished("photo", photo._id),
            source: "backfill",
            occurredAt: photo.publishedAt,
            userId: business?.userId,
            businessId: photo.businessId,
            metadata: { kind: "photo" },
          }),
        );
      }
    } else {
      const page = await ctx.db.query("reviews").paginate({ cursor, numItems });
      isDone = page.isDone;
      continueCursor = page.continueCursor;
      scanned = page.page.length;
      for (const review of page.page) {
        if (review.replyStatus !== "published" || !review.repliedAt) continue;
        const business = await ctx.db.get(review.businessId);
        bump(
          await recordAnalyticsEvent(ctx, {
            event: "content_published",
            dedupeKey: dedupe.contentPublished("review_reply", review._id),
            source: "backfill",
            occurredAt: review.repliedAt,
            userId: business?.userId,
            businessId: review.businessId,
            metadata: { kind: "review_reply" },
          }),
        );
      }
    }

    if (!isDone) {
      await ctx.scheduler.runAfter(0, internal.analyticsBackfill.step, {
        phase,
        cursor: continueCursor,
        batchSize: numItems,
      });
      return { phase, scanned, recorded, done: false };
    }

    const next = PHASES[PHASES.indexOf(phase) + 1] as Phase | undefined;
    if (next) {
      await ctx.scheduler.runAfter(0, internal.analyticsBackfill.step, {
        phase: next,
        cursor: null,
        batchSize: numItems,
      });
      return { phase, scanned, recorded, done: false };
    }

    console.log(`[analytics] backfill finished at ${istDay(Date.now())}`);
    return { phase, scanned, recorded, done: true };
  },
});
