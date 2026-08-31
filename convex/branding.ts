import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Step 5 — the logo we stamp on every post image, and the switch that turns
 * the agent on. This is the last thing between setup and the product working.
 */

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

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business) return null;

    return {
      business,
      offerings: await ctx.db
        .query("offerings")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
    };
  },
});

/** Convex hands the browser a one-time URL to upload straight to storage. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireBusiness(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveLogo = mutation({
  args: { storageId: v.id("_storage"), background: v.string() },
  handler: async (ctx, { storageId, background }) => {
    const business = await requireBusiness(ctx);
    const url = await ctx.storage.getUrl(storageId);
    await ctx.db.patch(business._id, {
      logoUrl: url ?? undefined,
      logoBackground: background,
    });
    return url;
  },
});

export const setLogoBackground = mutation({
  args: { background: v.string() },
  handler: async (ctx, { background }) => {
    const business = await requireBusiness(ctx);
    await ctx.db.patch(business._id, { logoBackground: background });
  },
});

/**
 * Finishes setup and switches the agent on. From here the product is
 * supposed to work without the owner opening it again.
 */
export const finishOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const business = await requireBusiness(ctx);

    await ctx.db.patch(business._id, {
      onboardingStep: 5,
      onboardingComplete: true,
      agentActive: true,
      agentStartedAt: business.agentStartedAt ?? Date.now(),
    });

    await ctx.db.insert("agentActions", {
      businessId: business._id,
      type: "seo",
      title: "Setup complete — agent is running",
      detail:
        "We'll start posting, replying to reviews and tracking your rank.",
      createdAt: Date.now(),
    });
  },
});

/* ----------------------------- logo finding ------------------------------
   Reading a logo off a website is guesswork: the strongest-looking image is
   often the site builder's own branding. So we return candidates and let the
   owner choose, with upload always available.                              */

function absolute(src: string, base: string): string | null {
  try {
    if (src.startsWith("data:")) return null;
    return new URL(src, base).toString();
  } catch {
    return null;
  }
}

async function scrapeForImages(url: string, key: string): Promise<string[]> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["html"],
        onlyMainContent: false,
      }),
    });
    if (!res.ok) return [];

    const data = await res.json();
    const html: string = data?.data?.html ?? "";
    const base: string = data?.data?.metadata?.sourceURL ?? url;

    const found: string[] = [];
    const push = (src?: string | null) => {
      if (!src) return;
      const abs = absolute(src, base);
      if (abs && !found.includes(abs)) found.push(abs);
    };

    // Brand-named images first — most likely to be the shop's own mark.
    for (const tag of html.matchAll(/<img[^>]+>/gi)) {
      if (!/logo|brand/i.test(tag[0])) continue;
      push(tag[0].match(/src=["']([^"']+)/i)?.[1]);
    }
    push(
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i,
      )?.[1],
    );
    for (const tag of html.matchAll(
      /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+>/gi,
    )) {
      push(tag[0].match(/href=["']([^"']+)/i)?.[1]);
    }
    return found.slice(0, 4);
  } catch (error) {
    console.log(`[firecrawl] scrape failed for ${url}`, error);
    return [];
  }
}

/**
 * Looks for the shop's logo across its whole web presence, not just the one
 * website we happen to have on file — a local business's real logo is often
 * on a listing site or a social page rather than a site they built.
 */
export const findLogoCandidates = action({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const business = await ctx.runQuery(internal.google.businessForUser, {
      userId,
    });
    if (!business) throw new Error("Connect your Google profile first.");

    const key = process.env.FIRECRAWL_API_KEY;
    if (!key) throw new Error("FIRECRAWL_API_KEY is not set.");

    const targets: string[] = [];
    if (business.website) targets.push(business.website);

    // Search the web for this business and read whatever it turns up.
    const query = [business.orgName, business.city, business.primaryCategory]
      .filter(Boolean)
      .join(" ");

    try {
      const res = await fetch("https://api.firecrawl.dev/v2/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, limit: 5 }),
      });
      if (res.ok) {
        const data = await res.json();
        const web = data?.data?.web ?? data?.data ?? [];
        const seenHosts = new Set(
          targets.map((t) => {
            try {
              return new URL(t).host;
            } catch {
              return t;
            }
          }),
        );
        for (const row of Array.isArray(web) ? web : []) {
          const url: string = row?.url ?? "";
          if (!url) continue;
          try {
            const host = new URL(url).host;
            if (seenHosts.has(host)) continue;
            seenHosts.add(host);
            targets.push(url);
          } catch {
            /* skip unparseable */
          }
        }
      }
    } catch (error) {
      console.log("[firecrawl] search failed", error);
    }

    if (targets.length === 0) {
      throw new Error(
        "We couldn't find your business online to read a logo from.",
      );
    }

    const all: string[] = [];
    for (const target of targets.slice(0, 4)) {
      for (const src of await scrapeForImages(target, key)) {
        if (!all.includes(src)) all.push(src);
      }
    }

    return all.slice(0, 12);
  },
});

/**
 * Copies a chosen image into Convex storage, so the logo keeps working even
 * if the shop's website changes or goes down.
 */
export const useLogoFromUrl = action({
  args: { url: v.string(), background: v.optional(v.string()) },
  handler: async (
    ctx,
    { url, background },
  ): Promise<{ ok: boolean; url: string | null }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const res = await fetch(url);
    if (!res.ok)
      throw new Error(`Could not download that image (${res.status}).`);

    const type = res.headers.get("content-type") ?? "image/png";
    if (!type.startsWith("image/"))
      throw new Error("That link isn't an image.");

    const blob = await res.blob();
    const storageId = await ctx.storage.store(blob);

    const stored: string | null = await ctx.runMutation(
      internal.branding.attachLogo,
      { userId, storageId, background: background ?? "white" },
    );
    return { ok: true, url: stored };
  },
});

export const attachLogo = internalMutation({
  args: {
    userId: v.id("users"),
    storageId: v.id("_storage"),
    background: v.string(),
  },
  handler: async (ctx, { userId, storageId, background }) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business) throw new Error("Connect your Google profile first.");

    const url = await ctx.storage.getUrl(storageId);
    await ctx.db.patch(business._id, {
      logoUrl: url ?? undefined,
      logoBackground: background,
    });
    return url;
  },
});
