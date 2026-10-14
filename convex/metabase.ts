import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  analyticsEventValidator,
  analyticsSourceValidator,
} from "./schema";
import { analyticsMetadataValidator } from "./analytics";
import { legacyPlanBusinessId, subscriptionBusinessId } from "./access";

/* ---------------------------------------------------------------------------
   Read-only reporting export for Metabase.

   Convex remains the source of truth. These internal queries expose only the
   small, privacy-safe reporting projection that the authenticated HTTP export
   route needs to mirror into Supabase Postgres. They are not client-callable.

   The export deliberately excludes auth rows, OAuth credentials, messages,
   emails, review text, payment provider ids and unmasked contact details.
--------------------------------------------------------------------------- */

const nullableString = v.union(v.string(), v.null());
const nullableNumber = v.union(v.number(), v.null());

const analyticsEventExport = v.object({
  id: v.string(),
  event: analyticsEventValidator,
  occurredAt: v.number(),
  day: v.string(),
  source: analyticsSourceValidator,
  dedupeKey: v.string(),
  userId: nullableString,
  businessId: nullableString,
  amountPaise: nullableNumber,
  currency: nullableString,
  metadata: v.union(analyticsMetadataValidator, v.null()),
});

const analyticsDailyExport = v.object({
  id: v.string(),
  day: v.string(),
  event: analyticsEventValidator,
  count: v.number(),
  amountPaise: v.number(),
});

const analyticsTotalsExport = v.object({
  id: v.string(),
  event: analyticsEventValidator,
  count: v.number(),
  amountPaise: v.number(),
  firstOccurredAt: v.number(),
  lastOccurredAt: v.number(),
});

const businessExport = v.object({
  id: v.string(),
  createdAt: v.number(),
  orgName: v.string(),
  city: nullableString,
  ownerEmailMasked: nullableString,
  ownerPhoneMasked: nullableString,
  emailVerified: v.boolean(),
  connected: v.boolean(),
  onboardingStep: v.number(),
  onboardingComplete: v.boolean(),
  agentActive: v.boolean(),
  agentStartedAt: nullableNumber,
  plan: nullableString,
  planExpiresAt: nullableNumber,
  planActive: v.boolean(),
  firstValueAt: nullableNumber,
  lastActivityAt: nullableNumber,
});

export const analyticsEvents = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(analyticsEventExport),
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db
      .query("analyticsEvents")
      .order("asc")
      .paginate(paginationOpts);

    return {
      ...result,
      page: result.page.map((row) => ({
        id: String(row._id),
        event: row.event,
        occurredAt: row.occurredAt,
        day: row.day,
        source: row.source,
        dedupeKey: row.dedupeKey,
        userId: row.userId ? String(row.userId) : null,
        businessId: row.businessId ? String(row.businessId) : null,
        amountPaise: row.amountPaise ?? null,
        currency: row.currency ?? null,
        metadata: row.metadata ?? null,
      })),
    };
  },
});

export const analyticsDaily = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(analyticsDailyExport),
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db
      .query("analyticsDaily")
      .order("asc")
      .paginate(paginationOpts);

    return {
      ...result,
      page: result.page.map((row) => ({
        id: String(row._id),
        day: row.day,
        event: row.event,
        count: row.count,
        amountPaise: row.amountPaise,
      })),
    };
  },
});

export const analyticsTotals = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(analyticsTotalsExport),
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db
      .query("analyticsTotals")
      .order("asc")
      .paginate(paginationOpts);

    return {
      ...result,
      page: result.page.map((row) => ({
        id: String(row._id),
        event: row.event,
        count: row.count,
        amountPaise: row.amountPaise,
        firstOccurredAt: row.firstOccurredAt,
        lastOccurredAt: row.lastOccurredAt,
      })),
    };
  },
});

const GRANTING = new Set(["paid", "partially_refunded"]);

function maskEmail(email: string | undefined): string | null {
  if (!email) return null;
  const at = email.lastIndexOf("@");
  if (at <= 0) return "•••";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const head = local[0] ?? "";
  const tail = local.length > 2 ? local[local.length - 1] : "";
  return `${head}•••${tail}@${domain}`;
}

function maskPhone(phone: string | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "•••";
  return `+${digits.slice(0, 2)}•••••${digits.slice(-4)}`;
}

function currentPlan(
  rows: Doc<"subscriptions">[],
  businessId: Doc<"businesses">["_id"],
  legacyId: Doc<"businesses">["_id"] | null,
  now: number,
) {
  return rows
    .filter((row) => {
      const paidFor = subscriptionBusinessId(row, legacyId);
      return (
        paidFor === businessId &&
        GRANTING.has(row.status) &&
        (row.expiresAt ?? 0) > now
      );
    })
    .sort((a, b) => (b.expiresAt ?? 0) - (a.expiresAt ?? 0))[0];
}

export const businesses = internalQuery({
  args: { paginationOpts: paginationOptsValidator, now: v.number() },
  returns: paginationResultValidator(businessExport),
  handler: async (ctx, { paginationOpts, now }) => {
    const result = await ctx.db
      .query("businesses")
      .order("desc")
      .paginate(paginationOpts);

    const page = [];
    for (const business of result.page) {
      const owner = await ctx.db.get(business.userId);
      const legacyId = await legacyPlanBusinessId(ctx, business.userId);
      const subscriptions = await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q) => q.eq("userId", business.userId))
        .take(200);
      const plan = currentPlan(subscriptions, business._id, legacyId, now);

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
      const firstPublish = await ctx.db
        .query("analyticsEvents")
        .withIndex("by_business_event_occurredAt", (q) =>
          q.eq("businessId", business._id).eq("event", "content_published"),
        )
        .order("asc")
        .first();

      page.push({
        id: String(business._id),
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
        plan: plan?.plan ?? null,
        planExpiresAt: plan?.expiresAt ?? null,
        planActive: Boolean(plan),
        firstValueAt: firstPublish?.occurredAt ?? null,
        lastActivityAt: lastEvent?.occurredAt ?? firstEvent?.occurredAt ?? null,
      });
    }

    return { ...result, page };
  },
});
