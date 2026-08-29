import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
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
