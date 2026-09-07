/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

/**
 * admin:removeUser is the one command that deletes an owner outright, so it
 * gets checked from both sides: everything of theirs goes, and nothing of
 * anyone else's does. A dry run must count exactly what the real run would
 * remove, and remove nothing.
 */

const modules = import.meta.glob("./**/*.ts");

const DAY = 24 * 60 * 60 * 1000;

type T = ReturnType<typeof convexTest<typeof schema.tables>>;

type Owner = { userId: Id<"users">; businessId: Id<"businesses"> };

async function seedOwner(t: T, label: string): Promise<Owner> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const userId = await ctx.db.insert("users", {
      name: label,
      email: `${label}@example.com`,
    });
    const businessId = await ctx.db.insert("businesses", {
      userId,
      orgName: `${label} shop`,
      city: "Hyderabad",
      gbpAccountName: `accounts/${label}`,
      gbpLocationName: `locations/${label}`,
      onboardingStep: 5,
      onboardingComplete: true,
      agentActive: true,
    });
    await ctx.db.insert("subscriptions", {
      userId,
      plan: "monthly",
      amountPaise: 199_900,
      currency: "INR",
      razorpayOrderId: `order_${label}`,
      status: "paid",
      paidAt: now,
      startsAt: now,
      expiresAt: now + 30 * DAY,
    });
    await ctx.db.insert("googleAccounts", {
      userId,
      businessId,
      accessToken: `token-${label}`,
      refreshToken: `refresh-${label}`,
      expiresAt: now + DAY,
      scope: "https://www.googleapis.com/auth/business.manage",
    });
    await ctx.db.insert("posts", {
      businessId,
      body: `${label} post`,
      status: "draft",
      generatedBy: "user",
    });
    await ctx.db.insert("reviews", {
      businessId,
      gbpReviewName: `accounts/${label}/locations/${label}/reviews/1`,
      authorName: "Priya",
      rating: 5,
      comment: "Lovely pool.",
      createdAt: now,
      replyStatus: "none",
    });
    await ctx.db.insert("authSessions", {
      userId,
      expirationTime: now + DAY,
    });
    return { userId, businessId };
  });
}

/** What is left of one owner, table by table. */
async function remains(t: T, { userId, businessId }: Owner) {
  return await t.run(async (ctx) => ({
    user: (await ctx.db.get(userId)) !== null,
    business: (await ctx.db.get(businessId)) !== null,
    posts: (
      await ctx.db
        .query("posts")
        .withIndex("by_business", (q) => q.eq("businessId", businessId))
        .collect()
    ).length,
    reviews: (
      await ctx.db
        .query("reviews")
        .withIndex("by_business", (q) => q.eq("businessId", businessId))
        .collect()
    ).length,
    subscriptions: (
      await ctx.db
        .query("subscriptions")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    ).length,
    googleAccounts: (
      await ctx.db
        .query("googleAccounts")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect()
    ).length,
    sessions: (
      await ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", userId))
        .collect()
    ).length,
  }));
}

const INTACT = {
  user: true,
  business: true,
  posts: 1,
  reviews: 1,
  subscriptions: 1,
  googleAccounts: 1,
  sessions: 1,
};

const GONE = {
  user: false,
  business: false,
  posts: 0,
  reviews: 0,
  subscriptions: 0,
  googleAccounts: 0,
  sessions: 0,
};

test("a dry run counts everything the owner has and deletes nothing", async () => {
  const t = convexTest(schema, modules);
  const a = await seedOwner(t, "a");
  const b = await seedOwner(t, "b");

  const result = await t.mutation(internal.admin.removeUser, {
    userId: a.userId,
  });

  expect(result.dryRun).toBe(true);
  expect(result.businesses).toEqual(["a shop"]);
  expect(result.removed).toEqual({
    posts: 1,
    reviews: 1,
    businesses: 1,
    googleAccounts: 1,
    subscriptions: 1,
    authSessions: 1,
    users: 1,
  });
  expect(await remains(t, a)).toEqual(INTACT);
  expect(await remains(t, b)).toEqual(INTACT);
});

test("removing one owner leaves the other untouched", async () => {
  const t = convexTest(schema, modules);
  const a = await seedOwner(t, "a");
  const b = await seedOwner(t, "b");

  const result = await t.mutation(internal.admin.removeUser, {
    userId: a.userId,
    dryRun: false,
  });

  expect(result.dryRun).toBe(false);
  expect(result.removed.users).toBe(1);
  expect(await remains(t, a)).toEqual(GONE);
  expect(await remains(t, b)).toEqual(INTACT);
});

test("an unknown user is refused", async () => {
  const t = convexTest(schema, modules);
  const a = await seedOwner(t, "a");
  await t.mutation(internal.admin.removeUser, {
    userId: a.userId,
    dryRun: false,
  });

  await expect(
    t.mutation(internal.admin.removeUser, { userId: a.userId }),
  ).rejects.toThrow(/no such user/i);
});
