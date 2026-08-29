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
    });

    await ctx.db.insert("agentActions", {
      businessId: business._id,
      type: "seo",
      title: "Setup complete — agent is running",
      detail: "We'll start posting, replying to reviews and tracking your rank.",
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

export const findLogoCandidates = action({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const business = await ctx.runQuery(internal.google.businessForUser, {
      userId,
    });
    if (!business?.website) {
      throw new Error("We don't have a website for your shop to read.");
    }

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
        formats: ["html"],
        onlyMainContent: false,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[firecrawl] ${res.status} ${body.slice(0, 200)}`);
      throw new Error(`Could not read your website (${res.status}).`);
    }

    const data = await res.json();
    const html: string = data?.data?.html ?? "";
    const base: string = data?.data?.metadata?.sourceURL ?? business.website;

    const found: string[] = [];
    const push = (src?: string | null) => {
      if (!src) return;
      const url = absolute(src, base);
      if (url && !found.includes(url)) found.push(url);
    };

    // Named brand images first — most likely to be the shop's own mark.
    for (const tag of html.matchAll(/<img[^>]+>/gi)) {
      const raw = tag[0];
      if (!/logo|brand|header-img/i.test(raw)) continue;
      push(raw.match(/src=["']([^"']+)/i)?.[1]);
    }
    // Then the social preview image and the site icons.
    push(
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i,
      )?.[1],
    );
    push(
      html.match(
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i,
      )?.[1],
    );
    for (const tag of html.matchAll(
      /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+>/gi,
    )) {
      push(tag[0].match(/href=["']([^"']+)/i)?.[1]);
    }

    return found.slice(0, 8);
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
    if (!res.ok) throw new Error(`Could not download that image (${res.status}).`);

    const type = res.headers.get("content-type") ?? "image/png";
    if (!type.startsWith("image/")) throw new Error("That link isn't an image.");

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
