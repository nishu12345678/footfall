import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { hasActivePlan } from "./access";

/**
 * The Settings screen: who you are, how you sign in, what's connected,
 * and the two things you can take back — Google's access and your own
 * sessions.
 *
 * Not behind the paywall: a lapsed owner must still be able to sign out
 * and disconnect Google.
 */

export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const user = await ctx.db.get(userId);
    if (!user) return null;

    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();

    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const google = await ctx.db
      .query("googleAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    const now = Date.now();

    return {
      user: {
        name: user.name ?? null,
        email: user.email ?? null,
        phone: user.phone ?? null,
      },
      signIn: {
        phone: accounts.some((a) => a.provider === "twilio"),
        email: accounts.some((a) => a.provider === "email-otp"),
        google: accounts.some((a) => a.provider === "google"),
      },
      activeSessions: sessions.filter((s) => s.expirationTime > now).length,
      paid: await hasActivePlan(ctx, userId),
      business: business
        ? {
            _id: business._id,
            orgName: business.orgName,
            city: business.city ?? null,
            locationName: business.locationName ?? null,
            logoUrl: business.logoUrl ?? null,
            connected: Boolean(business.gbpLocationName),
            onboardingComplete: business.onboardingComplete,
            onboardingStep: business.onboardingStep,
            agentActive: business.agentActive,
          }
        : null,
      googleBusiness: google
        ? {
            connectedAt: google._creationTime,
            googleEmail: google.googleEmail ?? null,
            scope: google.scope,
            hasRefreshToken: Boolean(google.refreshToken),
          }
        : null,
    };
  },
});

export const noteSignedOutEverywhere = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business) return;
    await ctx.db.insert("agentActions", {
      businessId: business._id,
      type: "seo",
      title: "Signed out on every device",
      createdAt: Date.now(),
    });
  },
});

/**
 * Invalidates every session this user has, on every device, including
 * this one. Convex Auth deletes the sessions and their refresh tokens, so
 * an already-issued access token dies within its short lifetime and no
 * refresh can revive it.
 */
export const signOutEverywhere = action({
  args: {},
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    await ctx.runMutation(internal.auth.store, {
      args: { type: "invalidateSessions", userId },
    });
    await ctx.runMutation(internal.account.noteSignedOutEverywhere, { userId });
    await ctx.scheduler.runAfter(0, internal.email.sendToUser, {
      userId,
      template: "signed_out_everywhere",
      dedupeKey: `signed_out_everywhere:${userId}:${Date.now()}`,
    });
    return { ok: true };
  },
});
