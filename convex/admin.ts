import { ConvexError, v } from "convex/values";
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
  "subscriptions",
  "paymentEvents",
  "refunds",
  "messages",
  "emails",
  "emailSuppressions",
  "postGenerations",
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
        _id: any;
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
   Removing one business without touching anyone else's. Every table below
   hangs off businessId and carries a by_business index; the sign-in rows
   hang off its owner. dryRun counts without deleting, so the blast radius
   can be read before anything goes.                                       */

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
] as const;

/** Our own file-storage URLs look like .../api/storage/<id>. Google-hosted
    images are not ours to delete, and never match this. */
function ourStorageId(url: string | undefined): string | null {
  if (typeof url !== "string") return null;
  const m = url.match(/\/api\/storage\/([^/?#]+)/);
  return m ? m[1] : null;
}

export const removeBusiness = internalMutation({
  args: {
    businessId: v.id("businesses"),
    includeUser: v.optional(v.boolean()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { businessId, includeUser = false, dryRun = true }) => {
    const business = await ctx.db.get(businessId);
    if (!business) throw new ConvexError("No such business.");

    const counted: Record<string, number> = {};
    const bump = (table: string, n: number) => {
      if (n > 0) counted[table] = (counted[table] ?? 0) + n;
    };

    // Files live in storage, not a table, so they outlive their rows.
    const storageIds = new Set<string>();

    for (const table of BUSINESS_TABLES) {
      const rows = (await ctx.db
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .query(table as any)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .withIndex("by_business", (q: any) => q.eq("businessId", businessId))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .collect()) as any[];
      bump(table, rows.length);
      for (const row of rows) {
        if (row.storageId) storageIds.add(row.storageId);
        const fromUrl = ourStorageId(row.imageUrl) ?? ourStorageId(row.url);
        if (fromUrl) storageIds.add(fromUrl);
        if (!dryRun) await ctx.db.delete(row._id);
      }
    }

    const userId = business.userId;

    const accounts = await ctx.db
      .query("googleAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    bump("googleAccounts", accounts.length);
    if (!dryRun) for (const a of accounts) await ctx.db.delete(a._id);

    const tokens = (await ctx.db.query("googleLinkTokens").collect()).filter(
      (t) => t.userId === userId,
    );
    bump("googleLinkTokens", tokens.length);
    if (!dryRun) for (const t of tokens) await ctx.db.delete(t._id);

    const logo = ourStorageId(business.logoUrl);
    if (logo) storageIds.add(logo);
    bump("businesses", 1);
    if (!dryRun) await ctx.db.delete(businessId);

    if (includeUser) {
      const sessions = await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect();
      for (const s of sessions) {
        const refresh = await ctx.db
          .query("authRefreshTokens")
          .withIndex("sessionId", (q) => q.eq("sessionId", s._id))
          .collect();
        bump("authRefreshTokens", refresh.length);
        if (!dryRun) for (const r of refresh) await ctx.db.delete(r._id);

        const verifiers = (await ctx.db.query("authVerifiers").collect()).filter(
          (x) => x.sessionId === s._id,
        );
        bump("authVerifiers", verifiers.length);
        if (!dryRun) for (const x of verifiers) await ctx.db.delete(x._id);
      }
      bump("authSessions", sessions.length);
      if (!dryRun) for (const s of sessions) await ctx.db.delete(s._id);

      const authAccounts = await ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
        .collect();
      for (const a of authAccounts) {
        const codes = await ctx.db
          .query("authVerificationCodes")
          .withIndex("accountId", (q) => q.eq("accountId", a._id))
          .collect();
        bump("authVerificationCodes", codes.length);
        if (!dryRun) for (const c of codes) await ctx.db.delete(c._id);
      }
      bump("authAccounts", authAccounts.length);
      if (!dryRun) for (const a of authAccounts) await ctx.db.delete(a._id);

      const user = await ctx.db.get(userId);
      if (user?.email) {
        const limits = await ctx.db
          .query("authRateLimits")
          .withIndex("identifier", (q) => q.eq("identifier", user.email!))
          .collect();
        bump("authRateLimits", limits.length);
        if (!dryRun) for (const l of limits) await ctx.db.delete(l._id);
      }
      bump("users", user ? 1 : 0);
      if (!dryRun && user) await ctx.db.delete(user._id);
    }

    bump("files", storageIds.size);
    if (!dryRun) {
      for (const id of storageIds) {
        // A file already gone is not an error worth failing the whole
        // removal over.
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await ctx.storage.delete(id as any);
        } catch {
          /* already gone */
        }
      }
    }

    return { dryRun, business: business.orgName, removed: counted };
  },
});

/**
 * One-off, for the move from MSG91 to Twilio: phone sign-in accounts were
 * keyed on the provider id "msg91", and the provider is now "twilio". Same
 * numbers, same users — only the label changes, so nobody gets a second
 * account on their next sign-in. Safe to run again.
 *
 *   npx convex run admin:migratePhoneProvider
 */
export const migratePhoneProvider = internalMutation({
  args: {},
  returns: v.object({ accounts: v.number(), codes: v.number() }),
  handler: async (ctx) => {
    let accounts = 0;
    const rows = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) => q.eq("provider", "msg91"))
      .collect();
    for (const row of rows) {
      await ctx.db.patch(row._id, { provider: "twilio" });
      accounts += 1;
    }
    let codes = 0;
    const pending = await ctx.db.query("authVerificationCodes").collect();
    for (const row of pending) {
      if (row.provider === "msg91") {
        await ctx.db.patch(row._id, { provider: "twilio" });
        codes += 1;
      }
    }
    return { accounts, codes };
  },
});

/* ------------------------------ erase a user -----------------------------
   Everything one person left behind, gone: their business and all its
   content, their payments and message/email logs, their sign-in accounts
   and sessions, their files. This is the "delete my account" of last
   resort, run by hand:

     npx convex run admin:eraseUser '{"email":"owner@example.com"}'
     npx convex run admin:eraseUser '{"phone":"919319102143","dryRun":false}'

   dryRun defaults to TRUE: the first run only counts, so the blast radius
   is read before anything goes. Receipts note: subscriptions and refunds
   are deleted with the rest — if you need the money trail for accounts,
   export it first (Razorpay keeps its own copy either way).             */

export const eraseUser = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { userId, email, phone, dryRun = true }) => {
    // ---- find the user, by whichever handle was given
    let user = userId ? await ctx.db.get(userId) : null;
    if (!user && email) {
      user = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email.trim().toLowerCase()))
        .first();
    }
    if (!user && phone) {
      const digits = phone.replace(/\D/g, "");
      const all = await ctx.db.query("users").collect();
      user = all.find((u) => (u.phone ?? "").replace(/\D/g, "") === digits) ?? null;
    }
    if (!user) throw new ConvexError("No such user.");
    const uid = user._id;

    const counted: Record<string, number> = {};
    const bump = (table: string, n: number) => {
      if (n > 0) counted[table] = (counted[table] ?? 0) + n;
    };
    const storageIds = new Set<string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const zap = async (table: string, rows: any[]) => {
      bump(table, rows.length);
      for (const row of rows) {
        if (row.storageId) storageIds.add(row.storageId);
        const fromUrl = ourStorageId(row.imageUrl) ?? ourStorageId(row.url);
        if (fromUrl) storageIds.add(fromUrl);
        if (!dryRun) await ctx.db.delete(row._id);
      }
    };

    // ---- the business and everything hanging off it
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", uid))
      .first();
    if (business) {
      for (const table of BUSINESS_TABLES) {
        await zap(
          table,
          await ctx.db
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .query(table as any)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .withIndex("by_business", (q: any) => q.eq("businessId", business._id))
            .collect(),
        );
      }
      await zap(
        "postGenerations",
        await ctx.db
          .query("postGenerations")
          .withIndex("by_business", (q) => q.eq("businessId", business._id))
          .collect(),
      );
      const logo = ourStorageId(business.logoUrl);
      if (logo) storageIds.add(logo);
      bump("businesses", 1);
      if (!dryRun) await ctx.db.delete(business._id);
    }

    // ---- Google connection
    await zap(
      "googleAccounts",
      await ctx.db
        .query("googleAccounts")
        .withIndex("by_user", (q) => q.eq("userId", uid))
        .collect(),
    );
    await zap(
      "googleLinkTokens",
      (await ctx.db.query("googleLinkTokens").collect()).filter(
        (t) => t.userId === uid,
      ),
    );

    // ---- money: orders, their webhook events, refunds
    const subs = await ctx.db
      .query("subscriptions")
      .withIndex("by_user", (q) => q.eq("userId", uid))
      .collect();
    for (const sub of subs) {
      await zap(
        "paymentEvents",
        await ctx.db
          .query("paymentEvents")
          .withIndex("by_order", (q) => q.eq("razorpayOrderId", sub.razorpayOrderId))
          .collect(),
      );
      await zap(
        "refunds",
        await ctx.db
          .query("refunds")
          .withIndex("by_subscription", (q) => q.eq("subscriptionId", sub._id))
          .collect(),
      );
    }
    await zap("subscriptions", subs);

    // ---- message and email logs (rows keyed by user or by their business)
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_user", (q) => q.eq("userId", uid))
      .collect();
    await zap("messages", messages);
    const emails = await ctx.db
      .query("emails")
      .withIndex("by_user", (q) => q.eq("userId", uid))
      .collect();
    await zap("emails", emails);
    if (user.email) {
      await zap(
        "emailSuppressions",
        await ctx.db
          .query("emailSuppressions")
          .withIndex("by_email", (q) => q.eq("email", user.email!.toLowerCase()))
          .collect(),
      );
    }

    // ---- sign-in: sessions, refresh tokens, accounts, codes, the user
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", uid))
      .collect();
    for (const s of sessions) {
      await zap(
        "authRefreshTokens",
        await ctx.db
          .query("authRefreshTokens")
          .withIndex("sessionId", (q) => q.eq("sessionId", s._id))
          .collect(),
      );
      await zap(
        "authVerifiers",
        (await ctx.db.query("authVerifiers").collect()).filter(
          (x) => x.sessionId === s._id,
        ),
      );
    }
    await zap("authSessions", sessions);

    const authAccounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", uid))
      .collect();
    for (const a of authAccounts) {
      await zap(
        "authVerificationCodes",
        await ctx.db
          .query("authVerificationCodes")
          .withIndex("accountId", (q) => q.eq("accountId", a._id))
          .collect(),
      );
    }
    await zap("authAccounts", authAccounts);

    for (const identifier of [user.email, user.phone].filter(Boolean) as string[]) {
      await zap(
        "authRateLimits",
        await ctx.db
          .query("authRateLimits")
          .withIndex("identifier", (q) => q.eq("identifier", identifier))
          .collect(),
      );
    }

    bump("users", 1);
    if (!dryRun) await ctx.db.delete(uid);

    // ---- their files
    bump("files", storageIds.size);
    if (!dryRun) {
      for (const id of storageIds) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await ctx.storage.delete(id as any);
        } catch {
          /* already gone */
        }
      }
    }

    return {
      dryRun,
      user: user.email ?? user.phone ?? String(uid),
      business: business?.orgName ?? null,
      removed: counted,
    };
  },
});
