import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Everything the home screen shows, in one query.
 *
 * Counts are real. A fresh account reads zero, and the screen says so
 * plainly rather than dressing an empty account up as a busy one.
 */
export const home = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business) return null;

    const id = business._id;

    const [posts, photos, reviews, customers, actions, keywords, metrics] =
      await Promise.all([
        ctx.db
          .query("posts")
          .withIndex("by_business", (q) => q.eq("businessId", id))
          .collect(),
        ctx.db
          .query("photos")
          .withIndex("by_business", (q) => q.eq("businessId", id))
          .collect(),
        ctx.db
          .query("reviews")
          .withIndex("by_business", (q) => q.eq("businessId", id))
          .collect(),
        ctx.db
          .query("customers")
          .withIndex("by_business", (q) => q.eq("businessId", id))
          .collect(),
        ctx.db
          .query("agentActions")
          .withIndex("by_business", (q) => q.eq("businessId", id))
          .order("desc")
          .take(8),
        ctx.db
          .query("keywords")
          .withIndex("by_business", (q) => q.eq("businessId", id))
          .collect(),
        ctx.db
          .query("metrics")
          .withIndex("by_business", (q) => q.eq("businessId", id))
          .collect(),
      ]);

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const newestReview = reviews.reduce<number | null>(
      (latest, r) => (latest === null || r.createdAt > latest ? r.createdAt : latest),
      null,
    );

    const replied = reviews.filter((r) => r.replyStatus === "published").length;

    const last30 = metrics.slice(-30);
    const sum = (key: "views" | "calls" | "directions") =>
      last30.reduce((total, row) => total + (row[key] ?? 0), 0);

    return {
      business,
      reviews: {
        total: reviews.length,
        thisWeek: reviews.filter((r) => r.createdAt >= weekAgo).length,
        target: 3,
        lastReviewAt: newestReview,
        daysSinceLastReview: newestReview
          ? Math.floor((Date.now() - newestReview) / 86_400_000)
          : null,
        awaitingReply: reviews.filter((r) => r.replyStatus !== "published").length,
        repliedPercent: reviews.length
          ? Math.round((replied / reviews.length) * 100)
          : null,
      },
      posts: {
        published: posts.filter((p) => p.status === "published").length,
        scheduled: posts.filter((p) => p.status === "scheduled").length,
      },
      photos: {
        published: photos.filter((p) => p.status === "published").length,
        scheduled: photos.filter((p) => p.status === "scheduled").length,
        inBucket: photos.filter((p) => p.status === "bucket").length,
      },
      customers: {
        total: customers.length,
        linksSent: customers.filter((c) => c.reviewLinkSentAt).length,
      },
      keywordCount: keywords.length,
      metrics: last30.length
        ? {
            days: last30.length,
            views: sum("views"),
            calls: sum("calls"),
            directions: sum("directions"),
          }
        : null,
      actions,
    };
  },
});

/**
 * Adds a customer and marks that we handed them the review link.
 * Their number is the start of the customer list the shop never had.
 */
export const addCustomer = mutation({
  args: { phone: v.string(), name: v.optional(v.string()) },
  handler: async (ctx, { phone, name }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business) throw new Error("Connect your Google profile first.");

    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) throw new Error("Enter a 10-digit mobile number.");
    const normalised = digits.length === 10 ? `91${digits}` : digits;

    const existing = await ctx.db
      .query("customers")
      .withIndex("by_business_phone", (q) =>
        q.eq("businessId", business._id).eq("phone", normalised),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { reviewLinkSentAt: Date.now() });
      return { id: existing._id, repeat: true };
    }

    const id = await ctx.db.insert("customers", {
      businessId: business._id,
      phone: normalised,
      name,
      reviewLinkSentAt: Date.now(),
      source: "manual",
    });

    await ctx.db.insert("agentActions", {
      businessId: business._id,
      type: "review_reply",
      title: "Review link sent",
      detail: `To ${normalised.slice(-10)}`,
      createdAt: Date.now(),
    });

    return { id, repeat: false };
  },
});
