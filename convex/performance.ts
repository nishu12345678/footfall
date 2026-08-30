import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

/**
 * The two jobs behind the Performance screen.
 *
 *   syncMetrics  — views, calls and direction requests, from Google's own
 *                  Business Profile Performance API.
 *   checkRanks   — where the shop actually sits in the map results for each
 *                  targeted keyword, via SerpApi searched from the shop's
 *                  own coordinates.
 *
 * No Google API returns "your rank for this keyword at this pin", which is
 * why ranking needs SerpApi and metrics don't.
 */

const PERF_BASE = "https://businessprofileperformance.googleapis.com/v1";

const IMPRESSION_METRICS = [
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
];
const ACTION_METRICS = [
  "CALL_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
  "WEBSITE_CLICKS",
];

function ymd(d: Date) {
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function dateKey(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/* ----------------------------- gbp metrics ------------------------------ */

export const saveMetrics = internalMutation({
  args: {
    businessId: v.id("businesses"),
    rows: v.array(
      v.object({
        date: v.string(),
        views: v.number(),
        calls: v.number(),
        directions: v.number(),
        websiteClicks: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { businessId, rows }) => {
    for (const row of rows) {
      const existing = await ctx.db
        .query("metrics")
        .withIndex("by_business_date", (q) =>
          q.eq("businessId", businessId).eq("date", row.date),
        )
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, row);
      } else {
        await ctx.db.insert("metrics", { businessId, ...row });
      }
    }
    await ctx.db.patch(businessId, { metricsSyncedAt: Date.now() });
  },
});

export const syncMetricsForUser = internalAction({
  args: { userId: v.id("users"), days: v.optional(v.number()) },
  handler: async (
    ctx,
    { userId, days = 30 },
  ): Promise<{ days: number; views: number; calls: number; directions: number }> => {

    const business = await ctx.runQuery(internal.google.businessForUser, {
      userId,
    });
    if (!business?.gbpLocationName) throw new Error("No Google listing linked.");

    const token: string = await ctx.runAction(internal.google.accessTokenFor, {
      userId,
    });

    const end = new Date();
    const start = new Date(end.getTime() - days * 86_400_000);
    const s = ymd(start);
    const e = ymd(end);

    const params = new URLSearchParams();
    for (const m of [...IMPRESSION_METRICS, ...ACTION_METRICS]) {
      params.append("dailyMetrics", m);
    }
    params.set("dailyRange.start_date.year", String(s.year));
    params.set("dailyRange.start_date.month", String(s.month));
    params.set("dailyRange.start_date.day", String(s.day));
    params.set("dailyRange.end_date.year", String(e.year));
    params.set("dailyRange.end_date.month", String(e.month));
    params.set("dailyRange.end_date.day", String(e.day));

    const url = `${PERF_BASE}/${business.gbpLocationName}:fetchMultiDailyMetricsTimeSeries?${params}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[perf] ${res.status} ${text.slice(0, 400)}`);
      throw new Error(`Google Performance API ${res.status}: ${text.slice(0, 180)}`);
    }

    const data = JSON.parse(text || "{}");
    const byDate = new Map<
      string,
      { views: number; calls: number; directions: number; websiteClicks: number }
    >();

    for (const series of data.multiDailyMetricTimeSeries ?? []) {
      for (const entry of series.dailyMetricTimeSeries ?? []) {
        const metric: string = entry.dailyMetric;
        for (const point of entry.timeSeries?.datedValues ?? []) {
          const d = point.date ?? {};
          const key = dateKey(d.year, d.month, d.day);
          const value = Number(point.value ?? 0);

          const row =
            byDate.get(key) ??
            { views: 0, calls: 0, directions: 0, websiteClicks: 0 };

          if (IMPRESSION_METRICS.includes(metric)) row.views += value;
          else if (metric === "CALL_CLICKS") row.calls += value;
          else if (metric === "BUSINESS_DIRECTION_REQUESTS") row.directions += value;
          else if (metric === "WEBSITE_CLICKS") row.websiteClicks += value;

          byDate.set(key, row);
        }
      }
    }

    const rows = [...byDate.entries()]
      .map(([date, r]) => ({ date, ...r }))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (rows.length) {
      await ctx.runMutation(internal.performance.saveMetrics, {
        businessId: business._id,
        rows,
      });
    }

    const total = rows.reduce(
      (acc, r) => ({
        views: acc.views + r.views,
        calls: acc.calls + r.calls,
        directions: acc.directions + r.directions,
      }),
      { views: 0, calls: 0, directions: 0 },
    );

    return { days: rows.length, ...total };
  },
});

/* ------------------------------ rank check ------------------------------ */

function normalise(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Position of this business in a SerpApi maps result, 1-based. */
function findRank(results: any[], businessName: string): number | undefined {
  const target = normalise(businessName);
  const words = target.split(" ").filter((w) => w.length > 2);

  for (const result of results) {
    const title = normalise(result.title ?? "");
    if (!title) continue;
    if (title === target || title.includes(target) || target.includes(title)) {
      return result.position;
    }
    // Fall back to a strong word overlap, so "Bansal Minerals - Tiles"
    // still matches "Bansal Minerals".
    if (words.length >= 2 && words.every((w) => title.includes(w))) {
      return result.position;
    }
  }
  return undefined;
}

async function mapsSearch(
  keyword: string,
  lat: number,
  lng: number,
  zoom = 14,
): Promise<any[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error("SERPAPI_KEY is not set.");

  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("q", keyword);
  url.searchParams.set("ll", `@${lat},${lng},${zoom}z`);
  url.searchParams.set("type", "search");
  url.searchParams.set("api_key", key);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) {
    console.error(`[serpapi] ${data.error}`);
    throw new Error(`SerpApi: ${data.error}`);
  }
  return data.local_results ?? [];
}

export const saveRanks = internalMutation({
  args: {
    ranks: v.array(
      v.object({ id: v.id("keywords"), rank: v.optional(v.number()) }),
    ),
  },
  handler: async (ctx, { ranks }) => {
    for (const { id, rank } of ranks) {
      const row = await ctx.db.get(id);
      if (!row) continue;
      await ctx.db.patch(id, {
        previousRank: row.rank,
        rank,
        checkedAt: Date.now(),
      });
      await ctx.db.patch(row.businessId, { ranksCheckedAt: Date.now() });
    }
  },
});

export const saveCompetitors = internalMutation({
  args: {
    businessId: v.id("businesses"),
    rows: v.array(
      v.object({
        name: v.string(),
        rating: v.optional(v.number()),
        reviewCount: v.optional(v.number()),
        averageRank: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { businessId, rows }) => {
    const existing = await ctx.db
      .query("competitors")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);

    for (const row of rows) {
      await ctx.db.insert("competitors", {
        businessId,
        ...row,
        checkedAt: Date.now(),
      });
    }
  },
});

export const checkRanksForUser = internalAction({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    { userId },
  ): Promise<{ checked: number; found: number; competitors: number }> => {

    let context = await ctx.runQuery(internal.performance.rankContext, {
      userId,
    });
    if (!context) throw new Error("Connect your Google profile first.");
    if (context.lat === undefined || context.lng === undefined) {
      await ctx.runAction(internal.google.ensureCoordinates, { userId });
      context = await ctx.runQuery(internal.performance.rankContext, { userId });
    }
    if (!context || context.lat === undefined || context.lng === undefined) {
      throw new Error(
        "We couldn't work out where your shop is. Check the address in step 2.",
      );
    }
    if (context.keywords.length === 0) {
      throw new Error("Add some keywords in setup first.");
    }

    const ranks: { id: Id<"keywords">; rank?: number }[] = [];
    const rivals = new Map<
      string,
      { name: string; rating?: number; reviewCount?: number; positions: number[] }
    >();

    for (const kw of context.keywords) {
      const results = await mapsSearch(kw.term, context.lat, context.lng);
      ranks.push({ id: kw._id, rank: findRank(results, context.name) });

      for (const r of results.slice(0, 10)) {
        const title: string = r.title ?? "";
        if (!title) continue;
        if (findRank([r], context.name) !== undefined) continue; // that's us
        const key = normalise(title);
        const entry =
          rivals.get(key) ??
          {
            name: title,
            rating: r.rating,
            reviewCount: r.reviews,
            positions: [] as number[],
          };
        if (typeof r.position === "number") entry.positions.push(r.position);
        rivals.set(key, entry);
      }
    }

    await ctx.runMutation(internal.performance.saveRanks, { ranks });

    const competitors = [...rivals.values()]
      .map((r) => ({
        name: r.name,
        rating: r.rating,
        reviewCount: r.reviewCount,
        averageRank:
          r.positions.length > 0
            ? Math.round(
                (r.positions.reduce((a, b) => a + b, 0) / r.positions.length) * 10,
              ) / 10
            : undefined,
      }))
      .sort((a, b) => (a.averageRank ?? 99) - (b.averageRank ?? 99))
      .slice(0, 8);

    await ctx.runMutation(internal.performance.saveCompetitors, {
      businessId: context.businessId,
      rows: competitors,
    });

    return {
      checked: ranks.length,
      found: ranks.filter((r) => r.rank !== undefined).length,
      competitors: competitors.length,
    };
  },
});

/* ------------------------------- geo grid ------------------------------- */

export const saveGrid = internalMutation({
  args: {
    businessId: v.id("businesses"),
    keyword: v.string(),
    runId: v.string(),
    points: v.array(
      v.object({ lat: v.number(), lng: v.number(), rank: v.optional(v.number()) }),
    ),
  },
  handler: async (ctx, { businessId, keyword, runId, points }) => {
    const old = await ctx.db
      .query("rankGrid")
      .withIndex("by_business_keyword", (q) =>
        q.eq("businessId", businessId).eq("keyword", keyword),
      )
      .collect();
    for (const row of old) await ctx.db.delete(row._id);

    for (const p of points) {
      await ctx.db.insert("rankGrid", {
        businessId,
        keyword,
        runId,
        checkedAt: Date.now(),
        ...p,
      });
    }
  },
});

/**
 * Searches the same keyword from a grid of points around the shop, so the
 * owner can see how far their ranking reaches. 3x3 by default: 9 SerpApi
 * calls per keyword per run.
 */
export const runGeoGrid = action({
  args: { keyword: v.string(), size: v.optional(v.number()), stepKm: v.optional(v.number()) },
  handler: async (
    ctx,
    { keyword, size = 3, stepKm = 1.5 },
  ): Promise<{ points: number; found: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    let context = await ctx.runQuery(internal.performance.rankContext, {
      userId,
    });
    if (!context || context.lat === undefined || context.lng === undefined) {
      await ctx.runAction(internal.google.ensureCoordinates, { userId });
      context = await ctx.runQuery(internal.performance.rankContext, { userId });
    }
    if (!context || context.lat === undefined || context.lng === undefined) {
      throw new Error(
        "We couldn't work out where your shop is. Check the address in step 2.",
      );
    }

    const half = Math.floor(size / 2);
    const dLat = stepKm / 111;
    const dLng =
      stepKm / (111 * Math.cos((context.lat * Math.PI) / 180) || 1);

    const points: { lat: number; lng: number; rank?: number }[] = [];

    for (let row = -half; row <= half; row++) {
      for (let col = -half; col <= half; col++) {
        const lat = context.lat + row * dLat;
        const lng = context.lng + col * dLng;
        const results = await mapsSearch(keyword, lat, lng);
        points.push({ lat, lng, rank: findRank(results, context.name) });
      }
    }

    const runId = crypto.randomUUID();
    await ctx.runMutation(internal.performance.saveGrid, {
      businessId: context.businessId,
      keyword,
      runId,
      points,
    });

    return {
      points: points.length,
      found: points.filter((p) => p.rank !== undefined).length,
    };
  },
});

/* ------------------------------- context -------------------------------- */

export const rankContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business) return null;

    const keywords = await ctx.db
      .query("keywords")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();

    return {
      businessId: business._id,
      name: business.orgName,
      lat: business.lat,
      lng: business.lng,
      keywords: keywords.filter((k) => k.targeted),
    };
  },
});


/* --------------------------- public wrappers ---------------------------- */

export const syncMetrics = action({
  args: { days: v.optional(v.number()) },
  handler: async (
    ctx,
    { days },
  ): Promise<{ days: number; views: number; calls: number; directions: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    return await ctx.runAction(internal.performance.syncMetricsForUser, {
      userId,
      days,
    });
  },
});

export const checkRanks = action({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ checked: number; found: number; competitors: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    return await ctx.runAction(internal.performance.checkRanksForUser, {
      userId,
    });
  },
});

/* ------------------------------ cron fanout ----------------------------- */

export const connectedBusinesses = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("businesses").collect();
    return rows
      .filter((b) => b.gbpLocationName && b.agentActive)
      .map((b) => ({ userId: b.userId, name: b.orgName }));
  },
});

/** Nightly refresh of Google's own numbers. Free, so it runs for everyone. */
export const syncAllMetrics = internalAction({
  args: {},
  handler: async (ctx): Promise<{ businesses: number }> => {
    const businesses: { userId: Id<"users">; name: string }[] =
      await ctx.runQuery(internal.performance.connectedBusinesses, {});
    for (const b of businesses) {
      try {
        await ctx.runAction(internal.performance.syncMetricsForUser, {
          userId: b.userId,
          days: 30,
        });
      } catch (error) {
        console.error(`[cron] metrics failed for ${b.name}`, error);
      }
    }
    return { businesses: businesses.length };
  },
});

/**
 * Weekly rank check. Deliberately not daily: every run costs one SerpApi
 * search per keyword, per business.
 */
export const checkAllRanks = internalAction({
  args: {},
  handler: async (ctx): Promise<{ businesses: number }> => {
    const businesses: { userId: Id<"users">; name: string }[] =
      await ctx.runQuery(internal.performance.connectedBusinesses, {});
    for (const b of businesses) {
      try {
        await ctx.runAction(internal.performance.checkRanksForUser, {
          userId: b.userId,
        });
      } catch (error) {
        console.error(`[cron] ranks failed for ${b.name}`, error);
      }
    }
    return { businesses: businesses.length };
  },
});
