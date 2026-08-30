import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * Development helpers. These are internal functions, so nothing in the
 * browser can reach them — they can only be run with `npx convex run`
 * by someone holding the deployment credentials.
 */

const APP_TABLES = [
  "sites",
  "offerings",
  "specialties",
  "serviceAreas",
  "keywords",
  "businessHours",
  "attributes",
  "posts",
  "photos",
  "reviews",
  "customers",
  "metrics",
  "competitors",
  "rankGrid",
  "agentActions",
  "googleAccounts",
  "googleLinkTokens",
  "businesses",
] as const;

const AUTH_TABLES = [
  "authSessions",
  "authAccounts",
  "authRefreshTokens",
  "authVerificationCodes",
  "authVerifiers",
  "authRateLimits",
  "users",
] as const;

export const counts = internalQuery({
  args: {},
  handler: async (ctx) => {
    const out: Record<string, number> = {};
    for (const table of [...APP_TABLES, ...AUTH_TABLES]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      out[table] = (await ctx.db.query(table as any).collect()).length;
    }
    return out;
  },
});

/**
 * Wipes the deployment back to empty so onboarding can be walked again
 * from a clean slate. `includeAuth` also removes users and sessions,
 * which signs everyone out.
 */
export const wipe = internalMutation({
  args: { includeAuth: v.optional(v.boolean()) },
  handler: async (ctx, { includeAuth = true }) => {
    const removed: Record<string, number> = {};

    const tables = includeAuth ? [...APP_TABLES, ...AUTH_TABLES] : APP_TABLES;
    for (const table of tables) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = (await ctx.db.query(table as any).collect()) as {
        _id: any;
      }[];
      for (const row of rows) await ctx.db.delete(row._id);
      if (rows.length > 0) removed[table] = rows.length;
    }

    return removed;
  },
});
