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
 * A free one-page website for shops that don't have one.
 *
 * Everything on it comes from the Google listing, so the name, address and
 * phone match Google exactly — that consistency is one of the few local SEO
 * levers a small shop fully controls. The page carries LocalBusiness
 * structured data, real opening hours, and service wording built from what
 * people in that area actually search.
 */

function slugify(...parts: (string | undefined)[]) {
  return parts
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/* ------------------------------ public read ----------------------------- */

export const bySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const site = await ctx.db
      .query("sites")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!site || !site.published) return null;

    const business = await ctx.db.get(site.businessId);
    if (!business) return null;

    const [hours, areas, reviews] = await Promise.all([
      ctx.db
        .query("businessHours")
        .withIndex("by_business", (q) => q.eq("businessId", site.businessId))
        .collect(),
      ctx.db
        .query("serviceAreas")
        .withIndex("by_business", (q) => q.eq("businessId", site.businessId))
        .collect(),
      ctx.db
        .query("reviews")
        .withIndex("by_business", (q) => q.eq("businessId", site.businessId))
        .order("desc")
        .take(6),
    ]);

    return {
      site,
      business,
      hours: hours.sort((a, b) => a.day - b.day),
      areas: areas.map((a) => a.name),
      reviews,
    };
  },
});

/** The owner's own view, published or not. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business) return null;

    const site = await ctx.db
      .query("sites")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .first();

    return { business, site };
  },
});

/* ------------------------------- context -------------------------------- */

export const siteContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business) return null;

    const [offerings, specialties, areas, keywords, hours] = await Promise.all([
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
      ctx.db
        .query("businessHours")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
    ]);

    return {
      business,
      offerings: offerings.map((r) => r.label),
      specialties: specialties.map((r) => r.label),
      areas: areas.map((r) => r.name),
      keywords: keywords.map((r) => r.term),
      hasHours: hours.length > 0,
    };
  },
});

export const saveSite = internalMutation({
  args: {
    businessId: v.id("businesses"),
    slug: v.string(),
    headline: v.string(),
    subhead: v.optional(v.string()),
    about: v.string(),
    services: v.array(v.object({ name: v.string(), body: v.string() })),
    faqs: v.array(v.object({ q: v.string(), a: v.string() })),
    metaTitle: v.string(),
    metaDescription: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sites")
      .withIndex("by_business", (q) => q.eq("businessId", args.businessId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: Date.now() });
      return existing.slug;
    }

    // Keep slugs unique without a race: append a short suffix if taken.
    let slug = args.slug;
    if (
      await ctx.db
        .query("sites")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .first()
    ) {
      slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    await ctx.db.insert("sites", {
      ...args,
      slug,
      published: true,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("agentActions", {
      businessId: args.businessId,
      type: "seo",
      title: "Website created",
      detail: `/s/${slug}`,
      createdAt: Date.now(),
    });

    return slug;
  },
});

/* ------------------------------ generation ------------------------------ */

export const generateSite = action({
  args: {},
  handler: async (ctx): Promise<{ slug: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const c = await ctx.runQuery(internal.site.siteContext, { userId });
    if (!c) throw new Error("Connect your Google profile first.");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");

    const b = c.business;
    const where = [b.city, b.pinCode].filter(Boolean).join(" ");

    const prompt = [
      `Business: ${b.orgName}`,
      b.primaryCategory ? `Category: ${b.primaryCategory}` : "",
      b.streetAddress ? `Address: ${b.streetAddress}` : "",
      where ? `City: ${where}` : "",
      c.areas.length ? `Also serves: ${c.areas.join(", ")}` : "",
      c.offerings.length ? `Sells: ${c.offerings.join(", ")}` : "",
      c.specialties.length ? `Known for: ${c.specialties.join(", ")}` : "",
      c.keywords.length
        ? `Phrases people search: ${c.keywords.slice(0, 10).join(", ")}`
        : "",
      c.hasHours
        ? "Opening hours are on file and shown on the page separately."
        : "NO OPENING HOURS ARE KNOWN for this business.",
      "",
      "Write the copy for a simple one-page website for this local business.",
      "This page exists to rank in local search, so:",
      "- work the city and locality into the headline and the about text naturally",
      "- use the searched phrases as service names where they genuinely fit",
      "- write for someone deciding whether to visit today",
      "",
      "Rules:",
      "- Plain Indian English. Warm and factual, never corporate.",
      "- Do NOT invent prices, discounts, years in business, awards, or claims.",
      "- Do NOT state opening hours, days open, or timings anywhere in the copy,",
      "  including the FAQs. The page shows real hours separately when we have them.",
      "  If asked about timings in an FAQ, say to check the Google listing or call.",
      "- Do NOT invent a menu, dish names, brands, or services you were not given.",
      "- about: 60-90 words.",
      "- services: 4 to 6 items, each with a 20-35 word description.",
      "- faqs: 4 questions a real customer would ask before visiting.",
      "- metaTitle: under 60 characters, include the business name and city.",
      "- metaDescription: under 155 characters.",
      "",
      'Reply as JSON only: {"headline":"...","subhead":"...","about":"...",',
      '"services":[{"name":"...","body":"..."}],',
      '"faqs":[{"q":"...","a":"..."}],',
      '"metaTitle":"...","metaDescription":"..."}',
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
              "You write websites for Indian neighbourhood businesses. Concrete and local. You never invent facts about a business.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[openai] ${res.status} ${text.slice(0, 300)}`);
      throw new Error(`Could not write the website (${res.status}).`);
    }

    const data = await res.json();
    let copy: any = {};
    try {
      copy = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}");
    } catch {
      throw new Error("The model returned something we couldn't read.");
    }

    const slug: string = await ctx.runMutation(internal.site.saveSite, {
      businessId: b._id as Id<"businesses">,
      slug: slugify(b.orgName, b.city),
      headline: copy.headline ?? b.orgName,
      subhead: copy.subhead,
      about: copy.about ?? "",
      services: Array.isArray(copy.services)
        ? copy.services
            .filter((s: any) => s?.name && s?.body)
            .slice(0, 6)
            .map((s: any) => ({ name: String(s.name), body: String(s.body) }))
        : [],
      faqs: Array.isArray(copy.faqs)
        ? copy.faqs
            .filter((f: any) => f?.q && f?.a)
            .slice(0, 6)
            .map((f: any) => ({ q: String(f.q), a: String(f.a) }))
        : [],
      metaTitle:
        copy.metaTitle ?? `${b.orgName}${b.city ? ` — ${b.city}` : ""}`,
      metaDescription: copy.metaDescription ?? "",
    });

    return { slug };
  },
});

export const setPublished = mutation({
  args: { published: v.boolean() },
  handler: async (ctx, { published }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business) throw new Error("Connect your Google profile first.");

    const site = await ctx.db
      .query("sites")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .first();
    if (!site) throw new Error("No website yet.");

    await ctx.db.patch(site._id, { published });
  },
});
