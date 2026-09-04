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
import type { MutationCtx, QueryCtx } from "./_generated/server";
import {
  NOT_FOUND_MESSAGE,
  ownedBusiness,
  ownedRow,
  paidAction,
  paidMutation,
  paidQuery,
} from "./access";

/**
 * Step 3 — what the shop actually sells, and what it's known for.
 *
 * Suggestions come from the listing's own category and city, and from the
 * shop's website when it has one. The owner taps to accept; nothing is
 * added on their behalf.
 */

type Kind = "offerings" | "specialties";

async function businessFor(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<"businesses">> {
  return (await ownedBusiness(ctx))._id;
}

/* -------------------------------- read ---------------------------------- */

export const list = paidQuery({
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

export const add = paidMutation({
  args: { kind: v.string(), label: v.string(), source: v.string() },
  handler: async (ctx, { kind, label, source }) => {
    const businessId = await businessFor(ctx);
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

export const remove = paidMutation({
  args: { kind: v.string(), id: v.string() },
  handler: async (ctx, { kind, id }) => {
    const table = kind === "specialties" ? "specialties" : "offerings";
    // The id arrives as a plain string; a malformed one is "not found" too.
    const rowId = ctx.db.normalizeId(table, id);
    if (!rowId) throw new Error(NOT_FOUND_MESSAGE);
    const { row } = await ownedRow(ctx, rowId);
    await ctx.db.delete(row._id);
  },
});

export const complete = paidMutation({
  args: {},
  handler: async (ctx) => {
    const businessId = await businessFor(ctx);
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

/**
 * Reads what the web already says about this shop.
 *
 * A local business's real catalogue is rarely on a website they built — it's
 * on their JustDial page, their IndiaMART listing, their Instagram. So we
 * search for the business first and read the top few results, rather than
 * only the one URL we happen to have on file.
 */
async function webContext(
  name: string,
  city?: string,
  category?: string,
  website?: string,
): Promise<string> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return "";

  const targets: string[] = [];
  if (website) targets.push(website);

  try {
    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: [name, city, category].filter(Boolean).join(" "),
        limit: 5,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const web = data?.data?.web ?? data?.data ?? [];
      const hosts = new Set(
        targets.map((u) => {
          try {
            return new URL(u).host;
          } catch {
            return u;
          }
        }),
      );
      for (const row of Array.isArray(web) ? web : []) {
        const url: string = row?.url ?? "";
        if (!url) continue;
        try {
          const host = new URL(url).host;
          if (hosts.has(host)) continue;
          hosts.add(host);
          targets.push(url);
        } catch {
          /* skip */
        }
      }
    }
  } catch (error) {
    console.log("[firecrawl] search failed", error);
  }

  const chunks: string[] = [];
  for (const url of targets.slice(0, 3)) {
    try {
      const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, formats: ["markdown"] }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const markdown: string = data?.data?.markdown ?? "";
      if (markdown)
        chunks.push(`--- from ${url} ---\n${markdown.slice(0, 2500)}`);
    } catch {
      /* one bad page shouldn't stop the rest */
    }
  }

  return chunks.join("\n\n").slice(0, 7000);
}

export const suggest = paidAction({
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
    const site = await webContext(
      context.name,
      context.city,
      context.category,
      context.website,
    );

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
