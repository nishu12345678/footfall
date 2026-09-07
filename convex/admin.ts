import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";

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
  "subscriptions",
  "websiteChecks",
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
        _id: Id<(typeof tables)[number]>;
      }[];
      for (const row of rows) await ctx.db.delete(row._id);
      if (rows.length > 0) removed[table] = rows.length;
    }

    // Uploaded and generated images live in file storage, not a table, so
    // they survive a table wipe and leave the next test run with orphans.
    const files = await ctx.db.system.query("_storage").collect();
    for (const file of files) await ctx.storage.delete(file._id);
    if (files.length > 0) removed.files = files.length;

    return removed;
  },
});

/** Clears just the posts, for re-running the planner from scratch. */
export const clearPosts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("posts").collect();
    for (const row of rows) await ctx.db.delete(row._id);
    return rows.length;
  },
});

/** The signed-up owner of the one business, for running actions by hand. */
export const firstOwner = internalQuery({
  args: {},
  handler: async (ctx) => {
    const business = await ctx.db.query("businesses").first();
    return business
      ? { userId: business.userId, name: business.orgName }
      : null;
  },
});

/** Clears the photo cache so it can be re-pulled at a sensible size. */
export const clearPhotos = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("photos").collect();
    for (const row of rows) await ctx.db.delete(row._id);
    return rows.length;
  },
});

/* --------------------------- scoped removal ------------------------------
   Removing one business, or one owner and everything they have, without
   touching anyone else's. Every table below hangs off businessId and
   carries a by_business index; subscriptions, the Google link and the
   sign-in rows hang off the owner. dryRun counts without deleting, so the
   blast radius can be read before anything goes.                          */

const BUSINESS_TABLES = [
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
  "websiteChecks",
] as const;

/** Our own file-storage URLs look like .../api/storage/<id>. Google-hosted
    images are not ours to delete, and never match this. */
function ourStorageId(url: string | undefined): string | null {
  if (typeof url !== "string") return null;
  const m = url.match(/\/api\/storage\/([^/?#]+)/);
  return m ? m[1] : null;
}

/** What one removal has found so far, and whether it is only looking. */
type Tally = {
  dryRun: boolean;
  counted: Record<string, number>;
  /** Files live in storage, not a table, so they outlive their rows. */
  storageIds: Set<string>;
};

function tally(dryRun: boolean): Tally {
  return { dryRun, counted: {}, storageIds: new Set() };
}

function bump(t: Tally, table: string, n: number) {
  if (n > 0) t.counted[table] = (t.counted[table] ?? 0) + n;
}

/** The business row and every row that hangs off it. */
async function purgeBusiness(
  ctx: MutationCtx,
  t: Tally,
  business: Doc<"businesses">,
) {
  for (const table of BUSINESS_TABLES) {
    const rows = (await ctx.db
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .query(table as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .withIndex("by_business", (q: any) => q.eq("businessId", business._id))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .collect()) as any[];
    bump(t, table, rows.length);
    for (const row of rows) {
      if (row.storageId) t.storageIds.add(row.storageId);
      const fromUrl = ourStorageId(row.imageUrl) ?? ourStorageId(row.url);
      if (fromUrl) t.storageIds.add(fromUrl);
      if (!t.dryRun) await ctx.db.delete(row._id);
    }
  }

  const logo = ourStorageId(business.logoUrl);
  if (logo) t.storageIds.add(logo);
  bump(t, "businesses", 1);
  if (!t.dryRun) await ctx.db.delete(business._id);
}

/** The Google connection: stored tokens and any half-finished link. */
async function purgeGoogleLink(
  ctx: MutationCtx,
  t: Tally,
  userId: Id<"users">,
) {
  const accounts = await ctx.db
    .query("googleAccounts")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  bump(t, "googleAccounts", accounts.length);
  if (!t.dryRun) for (const a of accounts) await ctx.db.delete(a._id);

  const tokens = (await ctx.db.query("googleLinkTokens").collect()).filter(
    (x) => x.userId === userId,
  );
  bump(t, "googleLinkTokens", tokens.length);
  if (!t.dryRun) for (const x of tokens) await ctx.db.delete(x._id);
}

/** Payments, sessions, sign-in accounts and the user row itself. */
async function purgeUser(ctx: MutationCtx, t: Tally, userId: Id<"users">) {
  const subscriptions = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  bump(t, "subscriptions", subscriptions.length);
  if (!t.dryRun) for (const s of subscriptions) await ctx.db.delete(s._id);

  const sessions = await ctx.db
    .query("authSessions")
    .withIndex("userId", (q) => q.eq("userId", userId))
    .collect();
  for (const s of sessions) {
    const refresh = await ctx.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (q) => q.eq("sessionId", s._id))
      .collect();
    bump(t, "authRefreshTokens", refresh.length);
    if (!t.dryRun) for (const r of refresh) await ctx.db.delete(r._id);

    const verifiers = (await ctx.db.query("authVerifiers").collect()).filter(
      (x) => x.sessionId === s._id,
    );
    bump(t, "authVerifiers", verifiers.length);
    if (!t.dryRun) for (const x of verifiers) await ctx.db.delete(x._id);
  }
  bump(t, "authSessions", sessions.length);
  if (!t.dryRun) for (const s of sessions) await ctx.db.delete(s._id);

  const authAccounts = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
    .collect();
  for (const a of authAccounts) {
    const codes = await ctx.db
      .query("authVerificationCodes")
      .withIndex("accountId", (q) => q.eq("accountId", a._id))
      .collect();
    bump(t, "authVerificationCodes", codes.length);
    if (!t.dryRun) for (const c of codes) await ctx.db.delete(c._id);
  }
  bump(t, "authAccounts", authAccounts.length);
  if (!t.dryRun) for (const a of authAccounts) await ctx.db.delete(a._id);

  const user = await ctx.db.get(userId);
  if (user?.email) {
    const limits = await ctx.db
      .query("authRateLimits")
      .withIndex("identifier", (q) => q.eq("identifier", user.email!))
      .collect();
    bump(t, "authRateLimits", limits.length);
    if (!t.dryRun) for (const l of limits) await ctx.db.delete(l._id);
  }
  bump(t, "users", user ? 1 : 0);
  if (!t.dryRun && user) await ctx.db.delete(user._id);
}

async function purgeFiles(ctx: MutationCtx, t: Tally) {
  bump(t, "files", t.storageIds.size);
  if (t.dryRun) return;
  for (const id of t.storageIds) {
    // A file already gone is not an error worth failing the removal over.
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ctx.storage.delete(id as any);
    } catch {
      /* already gone */
    }
  }
}

export const removeBusiness = internalMutation({
  args: {
    businessId: v.id("businesses"),
    includeUser: v.optional(v.boolean()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { businessId, includeUser = false, dryRun = true }) => {
    const business = await ctx.db.get(businessId);
    if (!business) throw new Error("No such business.");

    const t = tally(dryRun);
    await purgeBusiness(ctx, t, business);
    await purgeGoogleLink(ctx, t, business.userId);
    if (includeUser) await purgeUser(ctx, t, business.userId);
    await purgeFiles(ctx, t);

    return { dryRun, business: business.orgName, removed: t.counted };
  },
});

/**
 * Everything one owner has: the business and all that hangs off it, the
 * Google connection, payments, sessions, and the sign-in itself. Afterwards
 * that phone number or email can sign up again as if for the first time.
 *
 *   npx convex run admin:removeUser '{"userId": "<id>"}'                  # count only
 *   npx convex run admin:removeUser '{"userId": "<id>", "dryRun": false}'
 */
export const removeUser = internalMutation({
  args: { userId: v.id("users"), dryRun: v.optional(v.boolean()) },
  handler: async (ctx, { userId, dryRun = true }) => {
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("No such user.");

    const t = tally(dryRun);
    const businesses = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const business of businesses) await purgeBusiness(ctx, t, business);
    await purgeGoogleLink(ctx, t, userId);
    await purgeUser(ctx, t, userId);
    await purgeFiles(ctx, t);

    return {
      dryRun,
      user: user.email ?? user.phone ?? String(userId),
      businesses: businesses.map((b) => b.orgName),
      removed: t.counted,
    };
  },
});
