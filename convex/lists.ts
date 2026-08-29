import { query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx } from "./_generated/server";

/** Rows behind the Posts, Photos and Reviews tabs. */

async function myBusiness(ctx: QueryCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return null;
  return await ctx.db
    .query("businesses")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
}

export const posts = query({
  args: {},
  handler: async (ctx) => {
    const business = await myBusiness(ctx);
    if (!business) return null;
    const rows = await ctx.db
      .query("posts")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .order("desc")
      .take(50);
    return { business, rows };
  },
});

export const photos = query({
  args: {},
  handler: async (ctx) => {
    const business = await myBusiness(ctx);
    if (!business) return null;
    const rows = await ctx.db
      .query("photos")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .order("desc")
      .take(60);
    return { business, rows };
  },
});

export const reviews = query({
  args: {},
  handler: async (ctx) => {
    const business = await myBusiness(ctx);
    if (!business) return null;
    const rows = await ctx.db
      .query("reviews")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .order("desc")
      .take(50);
    return { business, rows };
  },
});

export const performance = query({
  args: {},
  handler: async (ctx) => {
    const business = await myBusiness(ctx);
    if (!business) return null;

    const [metrics, keywords, competitors] = await Promise.all([
      ctx.db
        .query("metrics")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
      ctx.db
        .query("keywords")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
      ctx.db
        .query("competitors")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
    ]);

    return { business, metrics, keywords, competitors };
  },
});
