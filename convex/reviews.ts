import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Reviews from the Google Business Profile.
 *
 * They matter twice over: they're the strongest thing a small shop can move
 * for ranking, and they're the only trust signal a stranger reads before
 * deciding to visit. Both the app and the generated website need them.
 *
 * Reviews live on the legacy v4 endpoint, like posts and media.
 */

const V4_BASE = "https://mybusiness.googleapis.com/v4";

const STAR_VALUES: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

export const saveReviews = internalMutation({
  args: {
    businessId: v.id("businesses"),
    items: v.array(
      v.object({
        gbpReviewName: v.string(),
        authorName: v.optional(v.string()),
        authorPhoto: v.optional(v.string()),
        rating: v.number(),
        comment: v.optional(v.string()),
        createdAt: v.number(),
        replyText: v.optional(v.string()),
        repliedAt: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { businessId, items }) => {
    const existing = await ctx.db
      .query("reviews")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
    const byName = new Map(
      existing.filter((r) => r.gbpReviewName).map((r) => [r.gbpReviewName, r]),
    );

    let added = 0;
    for (const item of items) {
      const match = byName.get(item.gbpReviewName);
      const replyStatus = item.replyText ? "published" : "none";

      if (match) {
        await ctx.db.patch(match._id, { ...item, replyStatus });
        continue;
      }
      await ctx.db.insert("reviews", { businessId, ...item, replyStatus });
      added += 1;
    }
    return added;
  },
});

export const syncFromGoogle = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ added: number; total: number; average: number | null }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const business = await ctx.runQuery(internal.google.businessForUser, {
      userId,
    });
    if (!business?.gbpAccountName || !business.gbpLocationName) {
      throw new Error("No Google listing linked.");
    }

    const token: string = await ctx.runAction(internal.google.accessTokenFor, {
      userId,
    });

    const locationId = business.gbpLocationName.replace(/^locations\//, "");
    const parent = `${business.gbpAccountName}/locations/${locationId}`;

    const res = await fetch(`${V4_BASE}/${parent}/reviews?pageSize=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[gbp/reviews] ${res.status} ${text.slice(0, 400)}`);
      throw new Error(`Google refused (${res.status}): ${text.slice(0, 200)}`);
    }

    const data = JSON.parse(text || "{}");
    const items = (data.reviews ?? [])
      .filter((r: any) => r?.name)
      .map((r: any) => ({
        gbpReviewName: String(r.name),
        authorName: r.reviewer?.displayName
          ? String(r.reviewer.displayName)
          : undefined,
        authorPhoto: r.reviewer?.profilePhotoUrl
          ? String(r.reviewer.profilePhotoUrl)
          : undefined,
        rating: STAR_VALUES[String(r.starRating)] ?? 0,
        comment: r.comment ? String(r.comment) : undefined,
        createdAt: r.createTime ? Date.parse(r.createTime) : Date.now(),
        replyText: r.reviewReply?.comment
          ? String(r.reviewReply.comment)
          : undefined,
        repliedAt: r.reviewReply?.updateTime
          ? Date.parse(r.reviewReply.updateTime)
          : undefined,
      }))
      .filter((r: any) => r.rating > 0);

    const added: number = await ctx.runMutation(internal.reviews.saveReviews, {
      businessId: business._id,
      items,
    });

    const average =
      items.length > 0
        ? Math.round(
            (items.reduce((t: number, r: any) => t + r.rating, 0) /
              items.length) *
              10,
          ) / 10
        : null;

    return { added, total: items.length, average };
  },
});

/* ------------------------------ ai replies ------------------------------ */

export const unrepliedFor = internalQuery({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, { businessId }) =>
    await ctx.db
      .query("reviews")
      .withIndex("by_business_reply", (q) =>
        q.eq("businessId", businessId).eq("replyStatus", "none"),
      )
      .collect(),
});
