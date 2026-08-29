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
