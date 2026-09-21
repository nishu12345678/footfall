import { v } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { query, type QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  adminQuery,
  isAnalyticsAdmin,
  legacyPlanBusinessId,
  subscriptionBusinessId,
} from "./access";
import { istDay } from "./analytics";
import { analyticsEventValidator, analyticsSourceValidator } from "./schema";

/* ---------------------------------------------------------------------------
   The internal analytics dashboard, read side.

   Every function here is a READ. There is no mutation and no action in this
   file, and there is no admin mutation wrapper in access.ts, so an admin
   session cannot change a customer's data through this surface — it can
   only look at it.

   Authorisation is `adminQuery` (verified email in ANALYTICS_ADMIN_EMAILS),
   which refuses with "Not found." so the route does not advertise itself.
   `me` is the single exception: it is a plain query, because the browser
   has to be able to ask "am I an admin?" without being thrown at.

   Three rules this file keeps, from docs/product-analytics.md:

   - Nothing scans. Summaries read analyticsDaily and analyticsTotals by
     index; anything that must look at canonical rows takes a bounded page
     and says so.
   - A report at its cap reports `truncated: true`. A partial number
     presented as exact is worse than no number.
   - No OAuth token, Razorpay signature, customer row, review text, post
     body, SMS or email content is readable from here. Contact identity is
     masked: enough to recognise an account, not a contact export.
--------------------------------------------------------------------------- */

/** How many canonical rows any one bounded read will look at. */
const ROW_CAP = 2000;
/** How many events the debugging feed will return. */
const FEED_CAP = 100;
/** How many businesses one page of the customer table may hold. */
const PAGE_CAP = 50;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The windows the dashboard offers. A closed set, not a free number. */
const windowValidator = v.union(v.literal(7), v.literal(30), v.literal(90));

/** Which plan statuses grant access. Mirrors billing.ts GRANTING. */
const GRANTING = new Set(["paid", "partially_refunded"]);

/**
 * The funnel, in the order this product actually happens.
 *
 * Payment sits BEFORE the remaining onboarding steps because the paid
 * mutations protect onboarding — an owner cannot finish setup without
 * paying. A report that puts onboarding first is wrong for this app.
 */
const FUNNEL = [
  { event: "account_created", label: "Accounts created" },
  { event: "gbp_connect_started", label: "Google connect started" },
  { event: "business_connected", label: "Businesses connected" },
  { event: "checkout_started", label: "Checkout started" },
  { event: "payment_succeeded", label: "Payments captured" },
  { event: "onboarding_completed", label: "Onboarding completed" },
  { event: "content_published", label: "Content published" },
] as const;

/** Every event the trend and totals blocks report on. */
const TRACKED = [
  "account_created",
  "gbp_connect_started",
  "gbp_connect_failed",
  "business_connected",
  "business_reconnected",
  "onboarding_step_completed",
  "onboarding_completed",
  "audit_completed",
  "content_generated",
  "content_published",
  "site_published",
  "checkout_started",
  "checkout_failed",
  "checkout_dismissed",
  "payment_succeeded",
  "payment_refunded",
] as const;

type TrackedEvent = (typeof TRACKED)[number];

/* -------------------------------- masking --------------------------------
   An admin screen needs to tell two accounts apart and to recognise the
   one a support email is about. It does not need a contact export, and a
   read-only dashboard is a poor place to keep one. So identity is shown
   in a form that is recognisable next to a known address and useless in
   bulk.                                                                  */

/** "owner@example.com" -> "o•••r@example.com"; never the full local part. */
export function maskEmail(email: string | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at <= 0) return "•••";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local[0] ?? "";
  const tail = local.length > 2 ? local[local.length - 1] : "";
  return `${head}•••${tail}@${domain}`;
}

/** "+919319102143" -> "+91•••••2143". Enough to match a call, not to dial. */
export function maskPhone(phone: string | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "•••";
  return `+${digits.slice(0, 2)}•••••${digits.slice(-4)}`;
}

/* ------------------------------ day helpers ----------------------------- */

/** The IST day strings for a window ending today, oldest first. */
function daysIn(now: number, days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) out.push(istDay(now - i * DAY_MS));
  return out;
}

/**
 * Daily rows for one event, from the window's first day onwards.
 *
 * Bounded by construction: the index range starts at the window's first
 * day, and a window is at most 90 days, so this reads at most 90 rows per
 * event however long the product has been live.
 */
async function dailyFor(
  ctx: QueryCtx,
  event: TrackedEvent,
  fromDay: string,
): Promise<Doc<"analyticsDaily">[]> {
  return await ctx.db
    .query("analyticsDaily")
    .withIndex("by_event_day", (q) => q.eq("event", event).gte("day", fromDay))
    .take(120);
}

/* --------------------------------- me ----------------------------------- */

/**
 * "Am I allowed to see the dashboard?"
 *
 * A plain query, and the only one here that answers a non-admin. It
 * returns false rather than throwing so the app shell can decide what to
 * render without handling an error — but note that this is not the
 * authorisation. Every function that returns data is an `adminQuery` and
 * checks again server-side, so a client that lies to itself about this
 * boolean still gets "Not found." from everything that matters.
 */
export const me = query({
  args: {},
  returns: v.object({
    signedIn: v.boolean(),
    isAdmin: v.boolean(),
  }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { signedIn: false, isAdmin: false };
    return { signedIn: true, isAdmin: await isAnalyticsAdmin(ctx) };
  },
});

/* ------------------------------- overview -------------------------------- */

const funnelStepValidator = v.object({
  event: analyticsEventValidator,
  label: v.string(),
  count: v.number(),
  /** Share of the step above, 0..1. Null for the first step. */
  conversionFromPrevious: v.union(v.number(), v.null()),
  /** How many were lost at this step. Null for the first step. */
  droppedFromPrevious: v.union(v.number(), v.null()),
  /** Share of the very first step, 0..1. */
  conversionFromStart: v.union(v.number(), v.null()),
});

const trendPointValidator = v.object({
  day: v.string(),
  accountsCreated: v.number(),
  businessesConnected: v.number(),
  paymentsCaptured: v.number(),
  revenuePaise: v.number(),
  refundsPaise: v.number(),
  contentPublished: v.number(),
});

const eventTotalValidator = v.object({
  event: analyticsEventValidator,
  windowCount: v.number(),
  windowAmountPaise: v.number(),
  lifetimeCount: v.number(),
  lifetimeAmountPaise: v.number(),
});

/**
 * Everything the summary cards, the funnel and the trend chart need, for a
 * 7, 30 or 90 day window.
 *
 * `now` is an argument rather than a `Date.now()` read, because a query
 * that reads the wall clock is not re-run when time passes and its result
 * silently goes stale in the cache. The client passes the current time and
 * refreshes it.
 */
export const overview = adminQuery({
  args: { days: windowValidator, now: v.number() },
  returns: v.object({
    days: v.number(),
    fromDay: v.string(),
    toDay: v.string(),
    funnel: v.array(funnelStepValidator),
    trend: v.array(trendPointValidator),
    events: v.array(eventTotalValidator),
    plans: v.object({
      /** Subscription rows currently granting access. Canonical. */
      activePlans: v.number(),
      activeMonthly: v.number(),
      activeYearly: v.number(),
      activeComp: v.number(),
      /** Monthly RUN RATE, not GAAP MRR: nothing here auto-debits, so
          this is the monthly amount plus the yearly amount over 12. */
      monthlyRunRatePaise: v.number(),
      /** True when the cap was hit and these numbers are a lower bound. */
      truncated: v.boolean(),
      rowsRead: v.number(),
    }),
    revenue: v.object({
      /** From analyticsTotals: every captured payment, ever. */
      capturedLifetimePaise: v.number(),
      refundedLifetimePaise: v.number(),
      netLifetimePaise: v.number(),
      capturedWindowPaise: v.number(),
      refundedWindowPaise: v.number(),
      netWindowPaise: v.number(),
      currency: v.string(),
    }),
    firstValue: v.object({
      /** Distinct businesses with a successful publish in the window. */
      businessesInWindow: v.number(),
      truncated: v.boolean(),
    }),
  }),
  handler: async (ctx, { days, now }) => {
    const window = daysIn(now, days);
    const fromDay = window[0];
    const toDay = window[window.length - 1];
    const inWindow = new Set(window);

    // One indexed read per event, each bounded to the window's length.
    const dailyByEvent = new Map<TrackedEvent, Doc<"analyticsDaily">[]>();
    for (const event of TRACKED) {
      const rows = (await dailyFor(ctx, event, fromDay)).filter((r) =>
        inWindow.has(r.day),
      );
      dailyByEvent.set(event, rows);
    }

    const windowCount = (event: TrackedEvent) =>
      (dailyByEvent.get(event) ?? []).reduce((sum, r) => sum + r.count, 0);
    const windowAmount = (event: TrackedEvent) =>
      (dailyByEvent.get(event) ?? []).reduce((sum, r) => sum + r.amountPaise, 0);

    /* ------------------------------ funnel ------------------------------ */

    const funnel = FUNNEL.map((step, index) => {
      const count = windowCount(step.event);
      const first = windowCount(FUNNEL[0].event);
      const previous = index === 0 ? null : windowCount(FUNNEL[index - 1].event);
      return {
        event: step.event,
        label: step.label,
        count,
        conversionFromPrevious:
          previous === null ? null : previous === 0 ? 0 : count / previous,
        droppedFromPrevious: previous === null ? null : Math.max(0, previous - count),
        conversionFromStart:
          index === 0 ? null : first === 0 ? 0 : count / first,
      };
    });

    /* ------------------------------- trend ------------------------------ */

    const byDay = (event: TrackedEvent) => {
      const map = new Map<string, Doc<"analyticsDaily">>();
      for (const row of dailyByEvent.get(event) ?? []) map.set(row.day, row);
      return map;
    };
    const accounts = byDay("account_created");
    const connected = byDay("business_connected");
    const paid = byDay("payment_succeeded");
    const refunded = byDay("payment_refunded");
    const published = byDay("content_published");

    const trend = window.map((day) => ({
      day,
      accountsCreated: accounts.get(day)?.count ?? 0,
      businessesConnected: connected.get(day)?.count ?? 0,
      paymentsCaptured: paid.get(day)?.count ?? 0,
      revenuePaise: paid.get(day)?.amountPaise ?? 0,
      refundsPaise: refunded.get(day)?.amountPaise ?? 0,
      contentPublished: published.get(day)?.count ?? 0,
    }));

    /* ------------------------------ totals ------------------------------ */

    const events = [];
    for (const event of TRACKED) {
      const totals = await ctx.db
        .query("analyticsTotals")
        .withIndex("by_event", (q) => q.eq("event", event))
        .first();
      events.push({
        event,
        windowCount: windowCount(event),
        windowAmountPaise: windowAmount(event),
        lifetimeCount: totals?.count ?? 0,
        lifetimeAmountPaise: totals?.amountPaise ?? 0,
      });
    }

    /* ---------------------- canonical current plans ---------------------
       The ledger, not the event stream. A plan that is running right now
       is a property of the subscription rows, and no count of historical
       payment events can answer it — periods stack and refunds end them
       early. Read by status index and capped; if the cap is hit the
       numbers are reported as a lower bound rather than as fact.        */

    let rowsRead = 0;
    let truncatedPlans = false;
    const grantingRows: Doc<"subscriptions">[] = [];
    for (const status of ["paid", "partially_refunded"]) {
      const rows = await ctx.db
        .query("subscriptions")
        .withIndex("by_status", (q) => q.eq("status", status))
        .take(ROW_CAP);
      rowsRead += rows.length;
      if (rows.length === ROW_CAP) truncatedPlans = true;
      for (const row of rows) {
        if ((row.expiresAt ?? 0) > now) grantingRows.push(row);
      }
    }

    // Periods stack: renewing early creates another paid row whose expiry is
    // also in the future. Counting rows would therefore call one business two
    // active plans and double its run rate. Collapse to the same unit the
    // paywall sells — one business — and use the furthest-expiring row, which
    // is also what billing.status shows the owner. Legacy rows all belong to
    // the one oldest business on that account, so a stable per-user bucket is
    // enough for this aggregate without an N+1 lookup.
    const byBusiness = new Map<string, Doc<"subscriptions">>();
    for (const row of grantingRows) {
      const key = row.businessId ?? `legacy:${row.userId}`;
      const current = byBusiness.get(key);
      if (!current || (row.expiresAt ?? 0) > (current.expiresAt ?? 0)) {
        byBusiness.set(key, row);
      }
    }
    const live = [...byBusiness.values()];

    const activeMonthly = live.filter((r) => r.plan === "monthly").length;
    const activeYearly = live.filter((r) => r.plan === "yearly").length;
    const activeComp = live.filter(
      (r) => r.plan !== "monthly" && r.plan !== "yearly",
    ).length;

    // Monthly run rate: a yearly plan contributes a twelfth of what was
    // paid for it. Comped and explicit ₹1 production-test plans contribute
    // nothing: both grant product access, neither represents customer run
    // rate. Rounded to whole paise, which is the unit money is in.
    const monthlyRunRatePaise = Math.round(
      live.reduce((sum, r) => {
        if (r.oneRupeeTest) return sum;
        if (r.plan === "monthly") return sum + r.amountPaise;
        if (r.plan === "yearly") return sum + r.amountPaise / 12;
        return sum;
      }, 0),
    );

    /* ------------------------------ revenue ----------------------------- */

    const capturedTotals = await ctx.db
      .query("analyticsTotals")
      .withIndex("by_event", (q) => q.eq("event", "payment_succeeded"))
      .first();
    const refundedTotals = await ctx.db
      .query("analyticsTotals")
      .withIndex("by_event", (q) => q.eq("event", "payment_refunded"))
      .first();

    const capturedLifetimePaise = capturedTotals?.amountPaise ?? 0;
    const refundedLifetimePaise = refundedTotals?.amountPaise ?? 0;
    const capturedWindowPaise = windowAmount("payment_succeeded");
    const refundedWindowPaise = windowAmount("payment_refunded");

    /* ----------------------------- first value ---------------------------
       "How many businesses received value in this window" is a DISTINCT
       count, which no aggregate row can answer. So it reads the window's
       publish events directly, capped, and says when it hit the cap.   */

    const publishEvents = await ctx.db
      .query("analyticsEvents")
      .withIndex("by_event_occurredAt", (q) =>
        q
          .eq("event", "content_published")
          .gte("occurredAt", now - days * DAY_MS),
      )
      .take(ROW_CAP);
    const distinct = new Set<string>();
    for (const row of publishEvents) {
      if (row.businessId) distinct.add(row.businessId);
    }

    return {
      days,
      fromDay,
      toDay,
      funnel,
      trend,
      events,
      plans: {
        activePlans: live.length,
        activeMonthly,
        activeYearly,
        activeComp,
        monthlyRunRatePaise,
        truncated: truncatedPlans,
        rowsRead,
      },
      revenue: {
        capturedLifetimePaise,
        refundedLifetimePaise,
        netLifetimePaise: capturedLifetimePaise - refundedLifetimePaise,
        capturedWindowPaise,
        refundedWindowPaise,
        netWindowPaise: capturedWindowPaise - refundedWindowPaise,
        currency: "INR",
      },
      firstValue: {
        businessesInWindow: distinct.size,
        truncated: publishEvents.length === ROW_CAP,
      },
    };
  },
});

/* ------------------------------ businesses ------------------------------- */

const businessRowValidator = v.object({
  businessId: v.id("businesses"),
  createdAt: v.number(),
  /** The shop's own trading name, as it appears on its public listing. */
  orgName: v.string(),
  city: v.union(v.string(), v.null()),
  /** Masked. Enough to recognise the account, not a contact export. */
  ownerEmailMasked: v.union(v.string(), v.null()),
  ownerPhoneMasked: v.union(v.string(), v.null()),
  emailVerified: v.boolean(),
  connected: v.boolean(),
  onboardingStep: v.number(),
  onboardingComplete: v.boolean(),
  agentActive: v.boolean(),
  agentStartedAt: v.union(v.number(), v.null()),
  /** Current plan for THIS business, or null. */
  plan: v.union(v.string(), v.null()),
  planExpiresAt: v.union(v.number(), v.null()),
  planActive: v.boolean(),
  /** First successful publish of any kind, from the event ledger. */
  firstValueAt: v.union(v.number(), v.null()),
  /** Most recent analytics event for this business. */
  lastActivityAt: v.union(v.number(), v.null()),
});

/**
 * The customer table.
 *
 * Paginated over `businesses`, one bounded lookup set per row. Everything
 * shown is product state: identity is masked, and nothing from
 * googleAccounts, googleLinkTokens, customers, messages, emails, reviews
 * or posts is read at all — so no OAuth token, no customer phone number
 * and no message body can leave through this query.
 */
export const businesses = adminQuery({
  args: { paginationOpts: paginationOptsValidator, now: v.number() },
  returns: paginationResultValidator(businessRowValidator),
  handler: async (ctx, { paginationOpts, now }) => {
    // A page bigger than the cap would turn each row's bounded lookups
    // into an unbounded read overall.
    const opts = {
      ...paginationOpts,
      numItems: Math.min(paginationOpts.numItems, PAGE_CAP),
    };

    const result = await ctx.db
      .query("businesses")
      .order("desc")
      .paginate(opts);

    const page = [];
    for (const business of result.page) {
      const owner = await ctx.db.get(business.userId);

      // The plans for this owner, capped. Legacy rows without a
      // businessId belong to the owner's oldest business, exactly as
      // access.ts resolves them for the paywall.
      const legacyId = await legacyPlanBusinessId(ctx, business.userId);
      const subs = await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q) => q.eq("userId", business.userId))
        .take(200);
      const mine = subs.filter(
        (r) => subscriptionBusinessId(r, legacyId) === business._id,
      );
      const current = mine
        .filter((r) => GRANTING.has(r.status) && (r.expiresAt ?? 0) > now)
        .sort((a, b) => (b.expiresAt ?? 0) - (a.expiresAt ?? 0))[0];

      // Oldest and newest event for this business: two single-row index
      // reads, no scan.
      const firstEvent = await ctx.db
        .query("analyticsEvents")
        .withIndex("by_business_occurredAt", (q) =>
          q.eq("businessId", business._id),
        )
        .order("asc")
        .first();
      const lastEvent = await ctx.db
        .query("analyticsEvents")
        .withIndex("by_business_occurredAt", (q) =>
          q.eq("businessId", business._id),
        )
        .order("desc")
        .first();

      // First value is the first successful publish, which is not
      // necessarily the first event. Both the business and the event are
      // in the index range, so this is one row read — a `.filter()` on
      // businessId would have scanned every other shop's publishes.
      const firstPublish = await ctx.db
        .query("analyticsEvents")
        .withIndex("by_business_event_occurredAt", (q) =>
          q.eq("businessId", business._id).eq("event", "content_published"),
        )
        .order("asc")
        .first();

      page.push({
        businessId: business._id,
        createdAt: business._creationTime,
        orgName: business.orgName,
        city: business.city ?? null,
        ownerEmailMasked: maskEmail(owner?.email),
        ownerPhoneMasked: maskPhone(owner?.phone),
        emailVerified: typeof owner?.emailVerificationTime === "number",
        connected: Boolean(business.gbpLocationName),
        onboardingStep: business.onboardingStep,
        onboardingComplete: business.onboardingComplete,
        agentActive: business.agentActive,
        agentStartedAt: business.agentStartedAt ?? null,
        plan: current?.plan ?? null,
        planExpiresAt: current?.expiresAt ?? null,
        planActive: Boolean(current),
        firstValueAt: firstPublish?.occurredAt ?? null,
        lastActivityAt: lastEvent?.occurredAt ?? firstEvent?.occurredAt ?? null,
      });
    }

    return { ...result, page };
  },
});

/* ----------------------------- recent events ----------------------------- */

const feedRowValidator = v.object({
  id: v.id("analyticsEvents"),
  event: analyticsEventValidator,
  occurredAt: v.number(),
  day: v.string(),
  source: analyticsSourceValidator,
  businessId: v.union(v.id("businesses"), v.null()),
  userId: v.union(v.id("users"), v.null()),
  amountPaise: v.union(v.number(), v.null()),
  currency: v.union(v.string(), v.null()),
  metadata: v.union(
    v.record(v.string(), v.union(v.string(), v.number(), v.boolean())),
    v.null(),
  ),
});

/**
 * The newest events, for debugging the funnel.
 *
 * Hard-capped at FEED_CAP and read newest-first off the occurredAt index,
 * so it costs the same whether the ledger holds a thousand rows or ten
 * million. The dedupeKey is deliberately NOT returned: it is an internal
 * idempotency key, not a fact about the customer.
 */
export const recentEvents = adminQuery({
  args: {
    limit: v.optional(v.number()),
    event: v.optional(analyticsEventValidator),
  },
  returns: v.object({
    rows: v.array(feedRowValidator),
    truncated: v.boolean(),
  }),
  handler: async (ctx, { limit, event }) => {
    const take = Math.max(1, Math.min(limit ?? FEED_CAP, FEED_CAP));

    const rows = event
      ? await ctx.db
          .query("analyticsEvents")
          .withIndex("by_event_occurredAt", (q) => q.eq("event", event))
          .order("desc")
          .take(take)
      : await ctx.db
          .query("analyticsEvents")
          .withIndex("by_occurredAt")
          .order("desc")
          .take(take);

    return {
      rows: rows.map((r) => ({
        id: r._id,
        event: r.event,
        occurredAt: r.occurredAt,
        day: r.day,
        source: r.source,
        businessId: r.businessId ?? null,
        userId: r.userId ?? null,
        amountPaise: r.amountPaise ?? null,
        currency: r.currency ?? null,
        metadata: r.metadata ?? null,
      })),
      truncated: rows.length === take,
    };
  },
});

/* --------------------------- one business's trail ------------------------ */

/**
 * The event trail for a single business, for answering "what happened to
 * this shop". Bounded, indexed and read-only, like everything else here.
 */
export const businessEvents = adminQuery({
  args: { businessId: v.id("businesses"), limit: v.optional(v.number()) },
  returns: v.object({
    rows: v.array(feedRowValidator),
    truncated: v.boolean(),
  }),
  handler: async (ctx, { businessId, limit }) => {
    const take = Math.max(1, Math.min(limit ?? FEED_CAP, FEED_CAP));
    const rows = await ctx.db
      .query("analyticsEvents")
      .withIndex("by_business_occurredAt", (q) => q.eq("businessId", businessId))
      .order("desc")
      .take(take);

    return {
      rows: rows.map((r) => ({
        id: r._id,
        event: r.event,
        occurredAt: r.occurredAt,
        day: r.day,
        source: r.source,
        businessId: r.businessId ?? null,
        userId: r.userId ?? null,
        amountPaise: r.amountPaise ?? null,
        currency: r.currency ?? null,
        metadata: r.metadata ?? null,
      })),
      truncated: rows.length === take,
    };
  },
});

/* ---------------------------- compile-time check --------------------------
   Every funnel step must name an event the trend block actually reads, or
   the funnel would silently report zero for it forever.                  */

const _FUNNEL_EVENTS_ARE_TRACKED: readonly TrackedEvent[] = FUNNEL.map(
  (s) => s.event,
);
void _FUNNEL_EVENTS_ARE_TRACKED;
