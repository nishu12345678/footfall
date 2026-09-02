import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { paidMutation, paidQuery } from "./access";

/**
 * Everything the home screen shows, in one query.
 *
 * Counts are real. A fresh account reads zero, and the screen says so
 * plainly rather than dressing an empty account up as a busy one.
 */
export const home = paidQuery({
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

    const [
      posts,
      photos,
      reviews,
      customers,
      actions,
      keywords,
      metrics,
      offerings,
    ] = await Promise.all([
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
      ctx.db
        .query("offerings")
        .withIndex("by_business", (q) => q.eq("businessId", id))
        .collect(),
    ]);

    /*
     * Which service to ask the next customer to mention.
     *
     * A review that says "root canal" is worth more than one that says
     * "good service": Google reads review text, and a service named in a
     * review is a service the shop is visibly known for. So we count how
     * often each thing the shop sells already appears in its reviews, and
     * point the owner at the one nobody has written about.
     */
    const services = offerings.filter((o) => o.selected).map((o) => o.label);
    const reviewText = reviews
      .map((r) => (r.comment ?? "").toLowerCase())
      .join(" ");

    const mentions = services.map((label) => {
      const words = label
        .toLowerCase()
        .split(/[^a-z]+/)
        .filter((w) => w.length > 3);
      const count = words.length
        ? reviews.filter((r) => {
            const text = (r.comment ?? "").toLowerCase();
            return words.every((w) => text.includes(w));
          }).length
        : 0;
      return { label, count };
    });

    const leastMentioned = [...mentions].sort((a, b) => a.count - b.count)[0];

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const newestReview = reviews.reduce<number | null>(
      (latest, r) =>
        latest === null || r.createdAt > latest ? r.createdAt : latest,
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
        awaitingReply: reviews.filter((r) => r.replyStatus !== "published")
          .length,
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
      reviewAsk: {
        services,
        suggested: leastMentioned?.label ?? null,
        mentioned: mentions.filter((m) => m.count > 0).length,
        reviewsRead: reviewText.length > 0 ? reviews.length : 0,
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
export const addCustomer = paidMutation({
  args: {
    phone: v.string(),
    name: v.optional(v.string()),
    service: v.optional(v.string()),
  },
  handler: async (ctx, { phone, name, service }) => {
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
      detail: service
        ? `To ${normalised.slice(-10)}, asking about ${service}`
        : `To ${normalised.slice(-10)}`,
      createdAt: Date.now(),
    });

    return { id, repeat: false };
  },
});
