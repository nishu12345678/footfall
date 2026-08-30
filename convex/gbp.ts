import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

/**
 * Step 4 — the parts of the listing that decide whether anyone finds it:
 * where you serve, what people search, when you're open, what you offer.
 */

export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** A small, category-agnostic set. Real Google attributes are per-category. */
export const ATTRIBUTE_CHOICES = [
  { key: "home_delivery", label: "Home delivery" },
  { key: "card_payments", label: "Card payments accepted" },
  { key: "upi", label: "UPI accepted" },
  { key: "parking", label: "Free parking" },
  { key: "wheelchair", label: "Wheelchair accessible entrance" },
  { key: "appointments", label: "Appointments available" },
  { key: "installation", label: "Installation service" },
  { key: "gst_invoice", label: "GST invoice provided" },
];

async function requireBusiness(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Sign in first.");
  const business = await ctx.db
    .query("businesses")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  if (!business) throw new Error("Connect your Google profile first.");
  return business;
}

/* -------------------------------- read ---------------------------------- */

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business) return null;

    // Queried one by one on purpose: a shared helper with a variable table
    // name collapses the four row types into a union.
    const [serviceAreas, keywords, hours, attributes] = await Promise.all([
      ctx.db
        .query("serviceAreas")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
      ctx.db
        .query("keywords")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
      ctx.db
        .query("businessHours")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
      ctx.db
        .query("attributes")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
    ]);

    return {
      business,
      serviceAreas,
      keywords,
      hours: hours.sort((a, b) => a.day - b.day),
      attributes,
      attributeChoices: ATTRIBUTE_CHOICES,
    };
  },
});

/* --------------------------- service areas ------------------------------ */

export const addServiceArea = mutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const business = await requireBusiness(ctx);
    const trimmed = name.trim();
    if (!trimmed) return;

    const existing = await ctx.db
      .query("serviceAreas")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    if (existing.some((r) => r.name.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }
    await ctx.db.insert("serviceAreas", { businessId: business._id, name: trimmed });
  },
});

export const removeServiceArea = mutation({
  args: { id: v.id("serviceAreas") },
  handler: async (ctx, { id }) => {
    await requireBusiness(ctx);
    await ctx.db.delete(id);
  },
});

/* ------------------------------ keywords -------------------------------- */

export const addKeyword = mutation({
  args: { term: v.string() },
  handler: async (ctx, { term }) => {
    const business = await requireBusiness(ctx);
    const trimmed = term.trim().toLowerCase();
    if (!trimmed) return;

    const existing = await ctx.db
      .query("keywords")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    if (existing.some((r) => r.term.toLowerCase() === trimmed)) return;

    await ctx.db.insert("keywords", {
      businessId: business._id,
      term: trimmed,
      targeted: true,
      nearMe: trimmed.includes("near me") || trimmed.includes("nearby"),
    });
  },
});

export const removeKeyword = mutation({
  args: { id: v.id("keywords") },
  handler: async (ctx, { id }) => {
    await requireBusiness(ctx);
    await ctx.db.delete(id);
  },
});

export const keywordContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business) return null;

    const [offerings, specialties, areas, keywords] = await Promise.all([
      ctx.db
        .query("offerings")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
      ctx.db
        .query("specialties")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
      ctx.db
        .query("serviceAreas")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
      ctx.db
        .query("keywords")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
    ]);

    return {
      name: business.orgName,
      category: business.primaryCategory,
      city: business.city,
      offerings: offerings.map((r) => r.label),
      specialties: specialties.map((r) => r.label),
      areas: areas.map((r) => r.name),
      have: keywords.map((r) => r.term),
    };
  },
});

/**
 * The keywords a neighbour would actually type. Not "salon near me" but
 * "hair spa thane west" — trade plus locality, which is what a local
 * business can realistically win.
 */
export const suggestKeywords = action({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const c = await ctx.runQuery(internal.gbp.keywordContext, { userId });
    if (!c) throw new Error("Connect your Google profile first.");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");

    const prompt = [
      `Business: ${c.name}`,
      c.category ? `Category: ${c.category}` : "",
      c.city ? `City: ${c.city}` : "",
      c.areas.length ? `Serves: ${c.areas.join(", ")}` : "",
      c.offerings.length ? `Sells: ${c.offerings.join(", ")}` : "",
      c.specialties.length ? `Known for: ${c.specialties.join(", ")}` : "",
      c.have.length ? `Already targeting (skip these): ${c.have.join(", ")}` : "",
      "",
      "List 12 search phrases a nearby customer would actually type into Google before visiting a shop like this.",
      "Rules: lowercase. 2-5 words. Mix 'near me' phrases with ones naming the city or locality.",
      "Favour buying intent over browsing. No brand names the shop doesn't sell.",
      'Reply as JSON only: {"items":["...","..."]}',
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You do local SEO for Indian neighbourhood businesses. You know how people actually type searches on a phone.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[openai] ${res.status} ${body.slice(0, 300)}`);
      throw new Error(`Keyword suggestions failed (${res.status}).`);
    }

    const data = await res.json();
    let items: string[] = [];
    try {
      items = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}").items ?? [];
    } catch {
      console.error("[openai] unparseable keyword reply");
    }

    const seen = new Set(c.have.map((h: string) => h.toLowerCase()));
    return items
      .filter((i) => typeof i === "string" && i.trim())
      .map((i) => i.trim().toLowerCase())
      .filter((i) => !seen.has(i))
      .slice(0, 12);
  },
});

/* -------------------------------- hours --------------------------------- */

export const setHours = mutation({
  args: {
    hours: v.array(
      v.object({
        day: v.number(),
        open: v.optional(v.string()),
        close: v.optional(v.string()),
        closed: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, { hours }) => {
    const business = await requireBusiness(ctx);

    const existing = await ctx.db
      .query("businessHours")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);

    for (const row of hours) {
      await ctx.db.insert("businessHours", { businessId: business._id, ...row });
    }
  },
});

export const saveSyncedHours = internalMutation({
  args: {
    businessId: v.id("businesses"),
    hours: v.array(
      v.object({
        day: v.number(),
        open: v.optional(v.string()),
        close: v.optional(v.string()),
        closed: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, { businessId, hours }) => {
    const existing = await ctx.db
      .query("businessHours")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
    if (existing.length > 0) return;

    for (const row of hours) {
      await ctx.db.insert("businessHours", { businessId, ...row });
    }
  },
});

/* ------------------------------ attributes ------------------------------ */

export const toggleAttribute = mutation({
  args: { key: v.string(), label: v.string(), enabled: v.boolean() },
  handler: async (ctx, { key, label, enabled }) => {
    const business = await requireBusiness(ctx);

    const existing = await ctx.db
      .query("attributes")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    const match = existing.find((r) => r.key === key);

    if (match) {
      await ctx.db.patch(match._id, { enabled });
      return;
    }
    await ctx.db.insert("attributes", {
      businessId: business._id,
      key,
      label,
      enabled,
    });
  },
});

/* ------------------------------- complete ------------------------------- */

export const complete = mutation({
  args: {},
  handler: async (ctx) => {
    const business = await requireBusiness(ctx);
    await ctx.db.patch(business._id as Id<"businesses">, {
      onboardingStep: Math.max(business.onboardingStep, 5),
    });
  },
});

/* --------------------------- keyword research ----------------------------
   Real signals, not invented volume numbers.

   demand      Google Autocomplete. If Google suggests a phrase, people type
               it; how early it appears is a rough popularity proxy.
   winnability The map results for that phrase. Three rivals with 500 reviews
               each is a wall; three with 15 reviews is an opening.

   Nothing here claims a monthly search volume, because no source we have
   provides one. DataForSEO or Google Ads would, and both cost money.      */

type Researched = {
  term: string;
  suggestedAt?: number;
  topReviews?: number;
  rivals?: number;
  score: number;
  why: string;
};

async function autocomplete(seed: string): Promise<string[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error("SERPAPI_KEY is not set.");

  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google_autocomplete");
  url.searchParams.set("q", seed);
  url.searchParams.set("gl", "in");
  url.searchParams.set("hl", "en");
  url.searchParams.set("api_key", key);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) {
    console.log(`[serpapi/autocomplete] ${data.error}`);
    return [];
  }
  return (data.suggestions ?? [])
    .map((s: { value?: string }) => (s.value ?? "").toLowerCase().trim())
    .filter(Boolean);
}

async function competition(
  term: string,
  lat: number,
  lng: number,
): Promise<{ topReviews: number; rivals: number }> {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new Error("SERPAPI_KEY is not set.");

  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("q", term);
  url.searchParams.set("ll", `@${lat},${lng},14z`);
  url.searchParams.set("type", "search");
  url.searchParams.set("api_key", key);

  const res = await fetch(url.toString());
  const data = await res.json();
  const results = data.local_results ?? [];
  const top3 = results.slice(0, 3);
  const topReviews =
    top3.length === 0
      ? 0
      : Math.round(
          top3.reduce((t: number, r: any) => t + (r.reviews ?? 0), 0) / top3.length,
        );
  return { topReviews, rivals: results.length };
}

export const researchKeywords = action({
  args: { deep: v.optional(v.boolean()) },
  handler: async (ctx, { deep = false }): Promise<Researched[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const c = await ctx.runQuery(internal.gbp.keywordContext, { userId });
    if (!c) throw new Error("Connect your Google profile first.");

    const business = await ctx.runQuery(internal.google.businessForUser, {
      userId,
    });
    if (!business?.lat || !business?.lng) {
      throw new Error("We don't have coordinates for your shop yet.");
    }

    // Seeds come from what the shop actually sells, plus its category.
    const seeds = [
      ...(c.category ? [c.category.toLowerCase()] : []),
      ...c.offerings.slice(0, 4).map((o: string) => o.toLowerCase()),
    ].slice(0, 5);

    if (seeds.length === 0) throw new Error("Add some offerings first.");

    const pool = new Map<string, number>();
    for (const seed of seeds) {
      const suggestions = await autocomplete(seed);
      suggestions.forEach((term, i) => {
        if (!pool.has(term) || (pool.get(term) ?? 99) > i) pool.set(term, i);
      });
    }

    const city = (c.city ?? "").toLowerCase();
    const already = new Set(c.have.map((h: string) => h.toLowerCase()));

    // Keep phrases that are local in intent and not already targeted:
    // "near me", or naming this city — not Delhi, Chennai, Noida.
    const otherCityWords = [
      "delhi", "mumbai", "chennai", "kolkata", "bangalore", "bengaluru",
      "hyderabad", "pune", "noida", "gurgaon", "lucknow", "jaipur",
      "ahmedabad", "kannur", "kochi", "surat", "indore", "nagpur",
    ].filter((w) => w !== city);

    const candidates = [...pool.entries()]
      .filter(([term]) => !already.has(term))
      .filter(([term]) => term.split(" ").length >= 2)
      .filter(([term]) => !otherCityWords.some((w) => term.includes(w)))
      .filter(([term]) => term.includes("near me") || !city || term.includes(city))
      .sort((a, b) => a[1] - b[1])
      .slice(0, deep ? 10 : 14);

    const out: Researched[] = [];

    for (const [term, suggestedAt] of candidates) {
      // Demand: how early Google suggested it. 0 is the top suggestion.
      const demand = Math.max(0, 10 - suggestedAt);

      if (!deep) {
        out.push({
          term,
          suggestedAt,
          score: demand,
          why: `Google suggests this at position ${suggestedAt + 1}`,
        });
        continue;
      }

      const { topReviews, rivals } = await competition(
        term,
        business.lat,
        business.lng,
      );
      // Winnability: the fewer reviews the current top three have, the more
      // realistic it is to displace them.
      const winnable =
        topReviews === 0 ? 5 : Math.max(0, 10 - Math.log10(topReviews + 1) * 3.5);
      const score = Math.round((demand * 0.6 + winnable * 0.4) * 10) / 10;

      out.push({
        term,
        suggestedAt,
        topReviews,
        rivals,
        score,
        why:
          `Suggested at position ${suggestedAt + 1}. ` +
          `Top 3 average ${topReviews} reviews — ` +
          (topReviews < 50
            ? "beatable."
            : topReviews < 200
              ? "competitive."
              : "hard to crack."),
      });
    }

    return out.sort((a, b) => b.score - a.score);
  },
});

/* ---------------------------- service areas ------------------------------
   A shop's service area is not a blank box. We know its city and street
   address from Google, so those go in by themselves, and the localities
   around it are offered as suggestions to confirm.                        */

export const seedServiceAreas = mutation({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const business = await requireBusiness(ctx);

    const existing = await ctx.db
      .query("serviceAreas")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    if (existing.length > 0) return existing.map((r) => r.name);

    // Only the city, which Google gives us as a clean field. Slicing a
    // locality out of the address line produced junk like
    // "agra Uttar Pradesh 282001" — the surrounding localities come from
    // the map instead, where they're real places with real distances.
    const seeds: string[] = [];
    if (business.city) seeds.push(business.city);

    for (const name of [...new Set(seeds)]) {
      await ctx.db.insert("serviceAreas", {
        businessId: business._id,
        name,
      });
    }
    return seeds;
  },
});

/**
 * Real localities around the shop, from OpenStreetMap, with real distances.
 *
 * A shop doesn't serve one colony — it serves everyone willing to travel to
 * it. So this works on a radius the owner picks, and every name is a place
 * that actually exists on the map rather than something a model recalled.
 */
export const setServiceRadius = mutation({
  args: { radiusKm: v.number() },
  handler: async (ctx, { radiusKm }) => {
    const business = await requireBusiness(ctx);
    await ctx.db.patch(business._id, {
      serviceRadiusKm: Math.min(Math.max(radiusKm, 2), 50),
    });
  },
});

export const nearbyAreas = action({
  args: { radiusKm: v.optional(v.number()) },
  handler: async (
    ctx,
    { radiusKm = 20 },
  ): Promise<
    { name: string; km: number; kind: string; lat: number; lng: number }[]
  > => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    let business = await ctx.runQuery(internal.google.businessForUser, {
      userId,
    });

    // Google leaves coordinates off plenty of listings; look them up from
    // the address rather than telling the owner we can't help.
    if (!business?.lat || !business?.lng) {
      await ctx.runAction(internal.google.ensureCoordinates, { userId });
      business = await ctx.runQuery(internal.google.businessForUser, { userId });
    }
    if (!business?.lat || !business?.lng) {
      throw new Error(
        "We couldn't work out where your shop is. Check the address in step 2.",
      );
    }

    const radius = Math.round(Math.min(Math.max(radiusKm, 2), 50) * 1000);
    const query =
      `[out:json][timeout:25];` +
      `(node["place"~"^(suburb|neighbourhood|quarter|town|village)$"]` +
      `(around:${radius},${business.lat},${business.lng}););out body 80;`;

    // Overpass asks callers to identify themselves, and individual mirrors
    // drop connections often enough that one endpoint isn't reliable.
    const MIRRORS = [
      "https://overpass-api.de/api/interpreter",
      "https://overpass.osm.ch/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter",
    ];

    let data: any = null;
    let lastError = "";

    for (const mirror of MIRRORS) {
      try {
        const res = await fetch(mirror, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "footfall/1.0 (local business listing tool)",
            Accept: "application/json",
          },
          body: new URLSearchParams({ data: query }),
        });
        if (!res.ok) {
          lastError = `${mirror} -> ${res.status}`;
          continue;
        }
        data = await res.json();
        break;
      } catch (error) {
        lastError = `${mirror} -> ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    if (!data) {
      console.error(`[overpass] all mirrors failed. ${lastError}`);
      throw new Error(
        "Couldn't reach the map service just now. Add your areas by hand, or try again in a minute.",
      );
    }
    const existing: string[] = await ctx.runQuery(internal.gbp.areasFor, {
      userId,
    });
    const have = new Set(existing.map((a) => a.toLowerCase()));

    const toRad = (x: number) => (x * Math.PI) / 180;
    const distance = (lat: number, lng: number) => {
      const dLat = toRad(lat - business.lat!);
      const dLng = toRad(lng - business.lng!);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(business.lat!)) *
          Math.cos(toRad(lat)) *
          Math.sin(dLng / 2) ** 2;
      return 2 * 6371 * Math.asin(Math.sqrt(a));
    };

    const seen = new Set<string>();
    return (data.elements ?? [])
      .filter((e: any) => e?.tags?.name && e.lat && e.lon)
      .map((e: any) => ({
        name: String(e.tags.name),
        kind: String(e.tags.place),
        km: Math.round(distance(e.lat, e.lon) * 10) / 10,
        lat: e.lat as number,
        lng: e.lon as number,
      }))
      .filter((e: { name: string }) => {
        const key = e.name.toLowerCase();
        if (have.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a: { km: number }, b: { km: number }) => a.km - b.km)
      .slice(0, 24);
  },
});

export const areasFor = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business) return [];
    const rows = await ctx.db
      .query("serviceAreas")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    return rows.map((r) => r.name);
  },
});
