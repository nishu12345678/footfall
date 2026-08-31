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
        // Answering three quarters of reviews, inside a day, is the shape
        // the research points at. Show both so it can be aimed at.
        replyRate: all.length ? Math.round((replied / all.length) * 100) : null,
        medianReplyHours: (() => {
          const gaps = all
            .filter((r) => r.replyText && r.repliedAt)
            .map((r) => ((r.repliedAt as number) - r.createdAt) / 3_600_000)
            .filter((h) => h >= 0)
            .sort((a, b) => a - b);
          if (gaps.length === 0) return null;
          return Math.round(gaps[Math.floor(gaps.length / 2)]);
        })(),
        held: all.filter((r) => r.replyNeedsApproval).length,
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

/**
 * The shop before us, and the shop with us.
 *
 * Local SEO work has no visible moment. The owner sees posts going out and
 * has no idea whether any of it mattered. This is the one screen that
 * answers that, so it compares like with like: however many days we have
 * been running, against exactly that many days immediately before we
 * started. A 30-day month against a 9-day fortnight would flatter us.
 */
export const impact = query({
  args: {},
  handler: async (ctx) => {
    const business = await myBusiness(ctx);
    if (!business) return null;

    const startedAt = business.agentStartedAt ?? business._creationTime;
    const metrics = await ctx.db
      .query("metrics")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();

    if (metrics.length === 0) return { startedAt, ready: false, days: 0 };

    const dayOf = (row: { date: string }) =>
      Date.parse(`${row.date}T00:00:00Z`);

    // Google's data lags a couple of days; don't count days it hasn't filled.
    const latest = Math.max(...metrics.map(dayOf));
    const elapsed = Math.floor((latest - startedAt) / 86_400_000) + 1;
    const window = Math.min(Math.max(elapsed, 0), 90);

    if (window < 7) {
      return { startedAt, ready: false, days: Math.max(window, 0) };
    }

    const afterFrom = startedAt;
    const beforeFrom = startedAt - window * 86_400_000;

    const sum = (rows: typeof metrics) => ({
      views: rows.reduce((t, r) => t + (r.views ?? 0), 0),
      calls: rows.reduce((t, r) => t + (r.calls ?? 0), 0),
      directions: rows.reduce((t, r) => t + (r.directions ?? 0), 0),
    });

    const before = sum(
      metrics.filter((r) => dayOf(r) >= beforeFrom && dayOf(r) < afterFrom),
    );
    const after = sum(metrics.filter((r) => dayOf(r) >= afterFrom));

    const change = (b: number, a: number) =>
      b === 0 ? (a > 0 ? null : 0) : Math.round(((a - b) / b) * 100);

    return {
      startedAt,
      ready: true,
      days: window,
      before,
      after,
      change: {
        views: change(before.views, after.views),
        calls: change(before.calls, after.calls),
        directions: change(before.directions, after.directions),
      },
      // Nothing to compare against if Google had no data before we started.
      hasBefore: before.views + before.calls + before.directions > 0,
    };
  },
});
