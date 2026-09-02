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
import { paidAction, paidMutation, paidQuery } from "./access";

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

    const [hours, areas, reviews, photos, offerings] = await Promise.all([
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
        .take(12),
      ctx.db
        .query("photos")
        .withIndex("by_business", (q) => q.eq("businessId", site.businessId))
        .take(12),
      ctx.db
        .query("offerings")
        .withIndex("by_business", (q) => q.eq("businessId", site.businessId))
        .collect(),
    ]);

    const rated = reviews.filter((r) => r.rating > 0);
    const rating =
      rated.length > 0
        ? Math.round(
            (rated.reduce((total, r) => total + r.rating, 0) / rated.length) *
              10,
          ) / 10
        : null;

    // wa.me needs the full international number with no plus and no leading
    // zero. "093191 02143" has to become "919319102143" or the link is dead.
    const digits = (business.phone ?? "").replace(/\D/g, "");
    const local = digits.replace(/^0+/, "");
    const whatsapp =
      local.length === 10
        ? `91${local}`
        : local.startsWith("91") && local.length === 12
          ? local
          : local || null;

    return {
      site,
      business,
      hours: hours.sort((a, b) => a.day - b.day),
      areas: areas.map((a) => a.name),
      reviews,
      photos: photos.filter((p) => p.url),
      offerings: offerings.map((o) => o.label),
      rating,
      reviewCount: rated.length,
      whatsapp,
      tel: local.length ? `+91${local.replace(/^91/, "")}` : null,
    };
  },
});

/** The owner's own view, published or not. */
export const mine = paidQuery({
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

export const generateSite = paidAction({
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
        ? `Subjects people search for — cover these in plain words, and never` +
          ` write "near me" or "nearby" on the page: ${c.keywords
            .slice(0, 10)
            .map((k: string) =>
              k
                .replace(/\b(near me|nearby|near by|around me)\b/gi, "")
                .replace(/\s{2,}/g, " ")
                .trim(),
            )
            .filter(Boolean)
            .join(", ")}`
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
      "- services: 10 to 14 items, each with a 25-40 word description.",
      "- every service must be something this business genuinely offers.",
      "- do not pad the list with near-duplicates of the same thing.",
      "- work the locality into some descriptions, naturally, as a reader would say it.",
      "- faqs: 6 questions a real customer would ask before visiting.",
      "- metaTitle: under 60 characters. Business name, then the trade, then the city.",
      "- headline: name the trade and the locality, as someone searching would say it.",
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
            .slice(0, 14)
            .map((s: any) => ({ name: String(s.name), body: String(s.body) }))
        : [],
      faqs: Array.isArray(copy.faqs)
        ? copy.faqs
            .filter((f: any) => f?.q && f?.a)
            .slice(0, 8)
            .map((f: any) => ({ q: String(f.q), a: String(f.a) }))
        : [],
      metaTitle:
        copy.metaTitle ?? `${b.orgName}${b.city ? ` — ${b.city}` : ""}`,
      metaDescription: copy.metaDescription ?? "",
    });

    return { slug };
  },
});

export const setPublished = paidMutation({
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

/* ---------------------------- existing sites -----------------------------
   A shop that already has a website doesn't need a second one. What it
   needs is to know what's missing from the one it has. The checks below are
   deterministic — we look for the thing and report whether it's there —
   with the model only used to phrase what to do about it.                 */

export type SiteCheck = {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
};

export const reviewExistingSite = paidAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ url: string; checks: SiteCheck[]; advice: string[] }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const business = await ctx.runQuery(internal.google.businessForUser, {
      userId,
    });
    if (!business?.website) throw new Error("No website on file to look at.");

    const key = process.env.FIRECRAWL_API_KEY;
    if (!key) throw new Error("FIRECRAWL_API_KEY is not set.");

    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: business.website,
        formats: ["markdown", "html"],
        onlyMainContent: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Couldn't read your website (${res.status}).`);
    }

    const data = await res.json();
    const html: string = data?.data?.html ?? "";
    const markdown: string = data?.data?.markdown ?? "";
    const haystack = `${html}\n${markdown}`.toLowerCase();

    const digits = (value?: string) => (value ?? "").replace(/\D/g, "");
    const phoneDigits = digits(business.phone).slice(-10);
    const pageDigits = haystack.replace(/\D/g, "");

    const checks: SiteCheck[] = [
      {
        id: "phone",
        label: "Your phone number is on the page",
        passed: phoneDigits.length === 10 && pageDigits.includes(phoneDigits),
        detail:
          "Google cross-checks the phone on your site against your listing. A mismatch weakens both.",
      },
      {
        id: "address",
        label: "Your address is on the page",
        passed: Boolean(
          business.city && haystack.includes(business.city.toLowerCase()),
        ),
        detail:
          "The same address as your Google listing, written the same way, is one of the strongest local signals.",
      },
      {
        id: "schema",
        label: "Search engines can read your business details",
        passed:
          haystack.includes("localbusiness") || haystack.includes("schema.org"),
        detail:
          "LocalBusiness structured data tells Google your hours, address and phone directly instead of making it guess.",
      },
      {
        id: "hours",
        label: "Your opening hours are shown",
        passed: /open|hours|timing|am\s*[-–]\s*|closed/i.test(markdown),
        detail: "Wrong or missing hours is the fastest way to lose a walk-in.",
      },
      {
        id: "map",
        label: "There's a map or directions link",
        passed:
          haystack.includes("maps.google") ||
          haystack.includes("goo.gl/maps") ||
          haystack.includes("google.com/maps"),
        detail:
          "People decide to visit when they can see how far away you are.",
      },
      {
        id: "whatsapp",
        label: "Customers can message you on WhatsApp",
        passed: haystack.includes("wa.me") || haystack.includes("api.whatsapp"),
        detail:
          "Most enquiries from a phone start on WhatsApp, not a contact form.",
      },
      {
        id: "reviews",
        label: "You ask for Google reviews",
        passed:
          haystack.includes("writereview") ||
          haystack.includes("g.page") ||
          haystack.includes("review us"),
        detail:
          "A link to leave a review turns a happy customer into a ranking signal.",
      },
      {
        id: "locality",
        label: "Your locality appears in the copy",
        passed: Boolean(
          business.city &&
          (markdown
            .toLowerCase()
            .match(new RegExp(business.city.toLowerCase(), "g"))?.length ??
            0) >= 2,
        ),
        detail:
          "People search a trade plus a place. If the place isn't on the page, you can't match the search.",
      },
    ];

    const failed = checks.filter((c) => !c.passed);
    if (failed.length === 0) {
      return {
        url: business.website,
        checks,
        advice: [
          "Your site covers the basics. Keep the listing itself active.",
        ],
      };
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return { url: business.website, checks, advice: [] };

    const prompt = [
      `Business: ${business.orgName}, a ${business.primaryCategory ?? "local business"} in ${business.city ?? "India"}.`,
      `Their website: ${business.website}`,
      "",
      "These checks failed on their site:",
      ...failed.map((f) => `- ${f.label}: ${f.detail}`),
      "",
      "Write one short instruction per failed check telling the owner what to do about it.",
      "Rules: plain words a shopkeeper understands, no jargon, no SEO terminology.",
      "One sentence each. Say what to add and where, not why it matters.",
      'Reply as JSON only: {"items":["...","..."]}',
    ].join("\n");

    const ai = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You advise Indian shop owners on their websites. Practical and plain. Never use jargon.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    let advice: string[] = [];
    if (ai.ok) {
      const payload = await ai.json();
      try {
        advice =
          JSON.parse(payload?.choices?.[0]?.message?.content ?? "{}").items ??
          [];
      } catch {
        advice = [];
      }
    }

    return { url: business.website, checks, advice };
  },
});
