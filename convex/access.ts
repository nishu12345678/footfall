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
