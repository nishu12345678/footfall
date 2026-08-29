import { query } from "./_generated/server";
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
