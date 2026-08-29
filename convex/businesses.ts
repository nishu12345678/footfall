import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

/** The signed-in owner's business, or null if they haven't connected yet. */
export const mine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    return await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
  },
});

/**
 * Step 2 — the owner confirms what Google already told us.
 * Everything here arrives pre-filled; they're reviewing, not typing.
 */
export const updateLocation = mutation({
  args: {
    orgName: v.string(),
    locationName: v.optional(v.string()),
    streetAddress: v.optional(v.string()),
    city: v.optional(v.string()),
    pinCode: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business) throw new Error("Connect your Google profile first.");

    await ctx.db.patch(business._id, {
      ...args,
      // Only ever move forward; going back to edit shouldn't undo progress.
      onboardingStep: Math.max(business.onboardingStep, 3),
    });

    return { ok: true };
  },
});
