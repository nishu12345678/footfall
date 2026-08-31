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

    // Ordered by when the customer wrote it, not when we happened to pull
    // it in — a sync inserts a hundred at once and their insert order says
    // nothing about which review is newest.
    const all = await ctx.db
      .query("reviews")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();

    const sorted = [...all].sort((a, b) => b.createdAt - a.createdAt);
    const replied = all.filter((r) => r.replyText).length;

    return {
      business,
      rows: sorted.slice(0, 50),
      summary: {
        total: all.length,
        average: all.length
          ? Math.round(
              (all.reduce((t, r) => t + r.rating, 0) / all.length) * 10,
            ) / 10
          : null,
        replied,
        awaiting: all.length - replied,
        fiveStar: all.filter((r) => r.rating === 5).length,
        lowRated: all.filter((r) => r.rating <= 3).length,
        newest: sorted[0]?.createdAt ?? null,
      },
    };
  },
});

export const performance = query({
  args: {},
  handler: async (ctx) => {
    const business = await myBusiness(ctx);
    if (!business) return null;

    const [metrics, keywords, competitors, grid] = await Promise.all([
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
      ctx.db
        .query("rankGrid")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
    ]);

    return {
      business,
      metrics: metrics.sort((a, b) => a.date.localeCompare(b.date)),
      keywords,
      competitors,
      grid,
    };
  },
});

/**
 * What Google uses to judge relevance, and where this listing falls short.
 *
 * The primary category is the strongest relevance signal there is, and
 * shops that outrank you are visibly using categories you don't have. This
 * turns that into something the owner can act on.
 */
export const relevance = query({
  args: {},
  handler: async (ctx) => {
    const business = await myBusiness(ctx);
    if (!business) return null;

    const [competitors, offerings] = await Promise.all([
      ctx.db
        .query("competitors")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
      ctx.db
        .query("offerings")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
    ]);

    const mine = new Set(
      [
        business.primaryCategory,
        ...(business.additionalCategories ?? []).map((c) => c.name),
      ]
        .filter(Boolean)
        .map((c) => (c as string).toLowerCase()),
    );

    // Count how many of the shops ranking above us use each category.
    const counts = new Map<string, { name: string; used: number }>();
    for (const rival of competitors) {
      if (!rival.category) continue;
      const key = rival.category.toLowerCase();
      if (mine.has(key)) continue;
      const entry = counts.get(key) ?? { name: rival.category, used: 0 };
      entry.used += 1;
      counts.set(key, entry);
    }

    const missing = [...counts.values()]
      .sort((a, b) => b.used - a.used)
      .slice(0, 5);

    return {
      business,
      primaryCategory: business.primaryCategory ?? null,
      extraCategories: business.additionalCategories ?? [],
      competitorsChecked: competitors.length,
      missingCategories: missing,
      offeringCount: offerings.filter((o) => o.selected).length,
      servicesPushedAt: business.servicesPushedAt ?? null,
    };
  },
});
