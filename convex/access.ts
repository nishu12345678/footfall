import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import {
  action,
  mutation,
  query,
  type ActionCtx,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc, Id, TableNames } from "./_generated/dataModel";

/**
 * The paywall.
 *
 * Gating in the browser is decoration — anyone can call a public Convex
 * function directly with a session token. So the check lives here, on the
 * server, and every app-facing function is registered through one of these
 * three wrappers instead of the plain `query`/`mutation`/`action`.
 *
 * Deliberately NOT wrapped:
 *   - convex/auth.ts       — you have to sign in before you can pay
 *   - convex/billing.ts    — the paywall cannot sit in front of the till
 *   - site.bySlug          — the public shop microsites at /s/<slug> are
 *                            read by strangers who have no account at all
 */

export const PAYWALL_MESSAGE =
  "Your footfall plan has ended. Renew to keep the listing running.";

/** True when this user has a paid row that hasn't run out yet. */
export async function hasActivePlan(
  ctx: QueryCtx | MutationCtx,
  userId: string,
): Promise<boolean> {
  const rows = await ctx.db
    .query("subscriptions")
    .withIndex("by_user", (q) => q.eq("userId", userId as never))
    .collect();

  const now = Date.now();
  return rows.some(
    (r) => r.status === "paid" && (r.expiresAt ?? 0) > now,
  );
}

async function requirePaidRead(ctx: QueryCtx | MutationCtx) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Sign in first.");
  if (!(await hasActivePlan(ctx, userId))) throw new Error(PAYWALL_MESSAGE);
}

async function requirePaidAction(ctx: ActionCtx) {
  const ok: boolean = await ctx.runQuery(internal.billing.isActive, {});
  if (!ok) throw new Error(PAYWALL_MESSAGE);
}

/* The casts keep each wrapper's public type identical to the Convex
   builder it stands in for, so call sites and generated types are
   unchanged — only the runtime gains the check. */

/* eslint-disable @typescript-eslint/no-explicit-any */

export const paidQuery = ((def: any) =>
  query({
    args: def.args,
    returns: def.returns,
    handler: async (ctx: QueryCtx, args: any) => {
      await requirePaidRead(ctx);
      return def.handler(ctx, args);
    },
  })) as typeof query;

export const paidMutation = ((def: any) =>
  mutation({
    args: def.args,
    returns: def.returns,
    handler: async (ctx: MutationCtx, args: any) => {
      await requirePaidRead(ctx);
      return def.handler(ctx, args);
    },
  })) as typeof mutation;

export const paidAction = ((def: any) =>
  action({
    args: def.args,
    returns: def.returns,
    handler: async (ctx: ActionCtx, args: any) => {
      await requirePaidAction(ctx);
      return def.handler(ctx, args);
    },
  })) as typeof action;

/* eslint-enable @typescript-eslint/no-explicit-any */

/* ------------------------------- ownership -------------------------------

   Every row a shop owns carries its businessId. A client-callable function
   that takes a row id has to prove the row belongs to the caller's business
   before it reads, changes or publishes it. Document ids reach the browser,
   sit in logs and are guessable in bulk — "hard to guess" is not an
   authorisation model.

   A row that is missing and a row that is someone else's are refused with
   the same message, so the API never confirms which ids exist.           */

export const NOT_FOUND_MESSAGE = "Not found.";

/** Tables whose rows belong to exactly one business. */
export type OwnedTable = {
  [T in TableNames]: Doc<T> extends { businessId: Id<"businesses"> }
    ? T
    : never;
}[TableNames];

/** What an ownership check hands back: the row and the business it's in. */
export type Owned<T extends OwnedTable> = {
  row: Doc<T>;
  business: Doc<"businesses">;
};

/** The business behind a user, or a thrown error. */
export async function businessOf(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
): Promise<Doc<"businesses">> {
  const business = await ctx.db
    .query("businesses")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  if (!business) throw new Error("Connect your Google profile first.");
  return business;
}

/** The signed-in caller's business, or a thrown error. */
export async function ownedBusiness(
  ctx: QueryCtx | MutationCtx,
): Promise<Doc<"businesses">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Sign in first.");
  return await businessOf(ctx, userId);
}

async function rowOf<T extends OwnedTable>(
  ctx: QueryCtx | MutationCtx,
  business: Doc<"businesses">,
  id: Id<T>,
): Promise<Doc<T>> {
  const row = await ctx.db.get(id);
  // Every OwnedTable document carries a businessId; TypeScript can't see
  // through the generic to know it, hence the narrow read.
  const owner = (row as { businessId?: Id<"businesses"> } | null)?.businessId;
  if (!row || owner !== business._id) throw new Error(NOT_FOUND_MESSAGE);
  return row;
}

/** The caller's business and one of its rows. Refuses anything else. */
export async function ownedRow<T extends OwnedTable>(
  ctx: QueryCtx | MutationCtx,
  id: Id<T>,
): Promise<Owned<T>> {
  const business = await ownedBusiness(ctx);
  return { row: await rowOf(ctx, business, id), business };
}

/**
 * The same check for code acting on a user's behalf without a session —
 * the crons, and the internal actions the public ones dispatch to.
 */
export async function ownedRowFor<T extends OwnedTable>(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  id: Id<T>,
): Promise<Owned<T>> {
  const business = await businessOf(ctx, userId);
  return { row: await rowOf(ctx, business, id), business };
}
