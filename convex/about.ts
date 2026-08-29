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
 * Step 3 — what the shop actually sells, and what it's known for.
 *
 * Suggestions come from the listing's own category and city, and from the
 * shop's website when it has one. The owner taps to accept; nothing is
 * added on their behalf.
 */

type Kind = "offerings" | "specialties";

async function businessFor(ctx: {
  auth: any;
  db: any;
}): Promise<Id<"businesses">> {
  const userId = await getAuthUserId(ctx as never);
  if (!userId) throw new Error("Sign in first.");
  const business = await ctx.db
    .query("businesses")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .first();
  if (!business) throw new Error("Connect your Google profile first.");
  return business._id;
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

    const [offerings, specialties] = await Promise.all([
      ctx.db
        .query("offerings")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
      ctx.db
        .query("specialties")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
    ]);

    return { business, offerings, specialties };
  },
});

/* ------------------------------- mutate --------------------------------- */

export const add = mutation({
  args: { kind: v.string(), label: v.string(), source: v.string() },
  handler: async (ctx, { kind, label, source }) => {
    const businessId = await businessFor(ctx as never);
    const table = kind === "specialties" ? "specialties" : "offerings";

    const trimmed = label.trim();
    if (!trimmed) return;

    const existing = await ctx.db
      .query(table)
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();

    const match = existing.find(
      (row) => row.label.toLowerCase() === trimmed.toLowerCase(),
    );
    if (match) {
      if (!match.selected) await ctx.db.patch(match._id, { selected: true });
      return;
    }

    await ctx.db.insert(table, {
      businessId,
      label: trimmed,
      source,
      selected: true,
    });
  },
});

export const remove = mutation({
  args: { kind: v.string(), id: v.string() },
  handler: async (ctx, { kind, id }) => {
    await businessFor(ctx as never);
    const table = kind === "specialties" ? "specialties" : "offerings";
    const row = await ctx.db.get(id as Id<typeof table>);
    if (row) await ctx.db.delete(row._id);
  },
});

export const complete = mutation({
  args: {},
  handler: async (ctx) => {
    const businessId = await businessFor(ctx as never);
    const business = await ctx.db.get(businessId);
    if (!business) return;
    await ctx.db.patch(businessId, {
      onboardingStep: Math.max(business.onboardingStep, 4),
    });
  },
});

/* ----------------------------- ai suggest ------------------------------- */

export const businessContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business) return null;

    const [offerings, specialties] = await Promise.all([
      ctx.db
        .query("offerings")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
      ctx.db
        .query("specialties")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
    ]);

    return {
      businessId: business._id,
      name: business.orgName,
      category: business.primaryCategory,
      city: business.city,
      website: business.website,
      have: [...offerings, ...specialties].map((r) => r.label),
    };
  },
});

/** Reads the shop's own website, if it has one, for grounding. */
async function siteText(website?: string): Promise<string> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key || !website) return "";
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: website, formats: ["markdown"] }),
    });
    if (!res.ok) {
      console.log(`[firecrawl] ${res.status} ${(await res.text()).slice(0, 200)}`);
      return "";
    }
    const data = await res.json();
    const markdown: string = data?.data?.markdown ?? "";
    return markdown.slice(0, 3000);
  } catch (error) {
    console.log("[firecrawl] failed", error);
    return "";
  }
}

export const suggest = action({
  args: { kind: v.string() },
  handler: async (ctx, { kind }): Promise<string[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const context = await ctx.runQuery(internal.about.businessContext, {
      userId,
    });
    if (!context) throw new Error("Connect your Google profile first.");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");

    const wantSpecialties = kind === "specialties";
    const site = await siteText(context.website);

    const ask = wantSpecialties
      ? `things this business is BEST KNOWN FOR — short reputation phrases a happy customer would use, like "Premium Marble Collection" or "Expert Installation Advice"`
      : `products and services this business SELLS — short catalogue items, like "Floor Tiles" or "Bathroom Fittings"`;

    const prompt = [
      `Business: ${context.name}`,
      context.category ? `Category: ${context.category}` : "",
      context.city ? `City: ${context.city}` : "",
      context.have.length
        ? `Already listed (do not repeat these): ${context.have.join(", ")}`
        : "",
      site ? `\nFrom their website:\n${site}` : "",
      "",
      `List 8 ${ask}.`,
      `Rules: 2-4 words each. Title Case. No punctuation. Specific to this business and this Indian city, not generic marketing words.`,
      `Reply as JSON only: {"items":["...","..."]}`,
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
              "You help Indian local business owners describe their shop for Google. You are concrete and specific, never generic.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[openai] ${res.status} ${body.slice(0, 300)}`);
      throw new Error(`Suggestions failed (${res.status}).`);
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? "{}";
    let items: string[] = [];
    try {
      items = JSON.parse(raw).items ?? [];
    } catch {
      console.error("[openai] unparseable reply", raw.slice(0, 200));
    }

    const seen = new Set(context.have.map((h: string) => h.toLowerCase()));
    return items
      .filter((i) => typeof i === "string" && i.trim())
      .map((i) => i.trim())
      .filter((i) => !seen.has(i.toLowerCase()))
      .slice(0, 8);
  },
});
