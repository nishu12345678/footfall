import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { apiKey } from "./email";

/**
 * Inbound email, through Resend receiving.
 *
 * Resend's webhook for email.received carries metadata only: from, to, subject,
 * attachments[] metadata. No body, no headers — those are fetched afterwards
 * from the retrieve endpoint, because the webhook design supports large
 * attachments that wouldn't fit in the POST body.
 *
 * Every message received on the footfall.zone domain is stored; contact@ is
 * simply the advertised address, but the webhook fires for all inbox addresses.
 */

const RESEND_RETRIEVE_API = "https://api.resend.com/emails/receiving";
const RETRY_AFTER_MS = [10_000, 60_000, 5 * 60_000];
const MAX_BODY_LENGTH = 400_000;

/**
 * Records metadata from the webhook. Dedupes by resendId so a svix redelivery
 * doesn't create a second row.
 */
export const record = internalMutation({
  args: {
    resendId: v.string(),
    messageId: v.optional(v.string()),
    from: v.string(),
    to: v.array(v.string()),
    cc: v.optional(v.array(v.string())),
    subject: v.string(),
    attachments: v.array(
      v.object({
        id: v.string(),
        filename: v.string(),
        contentType: v.optional(v.string()),
        contentDisposition: v.optional(v.string()),
        contentId: v.optional(v.string()),
      }),
    ),
    receivedAt: v.number(),
  },
  returns: v.union(v.id("inboundEmails"), v.null()),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("inboundEmails")
      .withIndex("by_resend_id", (q) => q.eq("resendId", args.resendId))
      .first();
    if (existing) return null;

    const now = Date.now();
    const id = await ctx.db.insert("inboundEmails", {
      ...args,
      status: "received",
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

/**
 * Patches body content and status after a fetch attempt.
 */
export const patchBody = internalMutation({
  args: {
    id: v.id("inboundEmails"),
    text: v.optional(v.string()),
    html: v.optional(v.string()),
    status: v.string(),
    error: v.optional(v.string()),
    attempts: v.number(),
  },
  handler: async (ctx, { id, ...rest }) => {
    await ctx.db.patch(id, {
      ...rest,
      updatedAt: Date.now(),
    });
  },
});

export const getRow = internalQuery({
  args: { id: v.id("inboundEmails") },
  handler: async (ctx, { id }) => await ctx.db.get(id),
});

/**
 * Fetches text and html from the retrieve endpoint. Caps each at 400 KB of
 * UTF-8 to stay under Convex's 1 MB document limit. Retries 429/5xx with the
 * same ladder as email.ts; permanent failures are marked fetch_failed.
 */
export const fetchBody = internalAction({
  args: { id: v.id("inboundEmails"), resendId: v.string() },
  handler: async (ctx, { id, resendId }): Promise<void> => {
    const key = apiKey();
    if (!key) {
      await ctx.runMutation(internal.inbound.patchBody, {
        id,
        status: "fetch_failed",
        error: "Resend is not configured.",
        attempts: 1,
      });
      return;
    }

    const row = await ctx.runQuery(internal.inbound.getRow, { id });
    if (!row) return;

    let res: Response;
    try {
      res = await fetch(`${RESEND_RETRIEVE_API}/${resendId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${key}` },
      });
    } catch (error) {
      return await retryOrFail(
        ctx,
        id,
        resendId,
        row.attempts + 1,
        `Could not reach Resend: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const body = await res.text();
    let json: { text?: string; html?: string; message?: string } = {};
    try {
      json = JSON.parse(body);
    } catch {
      /* non-JSON: a gateway problem */
    }

    if (!res.ok) {
      const message = json.message ?? body.slice(0, 200) ?? `HTTP ${res.status}`;
      console.error(`[resend-inbound] ${res.status} ${message}`);

      if (res.status === 429 || res.status >= 500) {
        return await retryOrFail(ctx, id, resendId, row.attempts + 1, message);
      }
      // 4xx is permanent
      await ctx.runMutation(internal.inbound.patchBody, {
        id,
        status: "fetch_failed",
        error: message,
        attempts: row.attempts + 1,
      });
      return;
    }

    // Success: cap each body part and mark fetched
    const text = json.text ? truncate(json.text, MAX_BODY_LENGTH) : undefined;
    const html = json.html ? truncate(json.html, MAX_BODY_LENGTH) : undefined;

    await ctx.runMutation(internal.inbound.patchBody, {
      id,
      text,
      html,
      status: "fetched",
      attempts: row.attempts + 1,
    });
    console.log(`[resend-inbound] fetched ${resendId} from ${row.from}`);
  },
});

async function retryOrFail(
  ctx: ActionCtx,
  id: Id<"inboundEmails">,
  resendId: string,
  attempts: number,
  message: string,
): Promise<void> {
  if (attempts <= RETRY_AFTER_MS.length) {
    const delay = RETRY_AFTER_MS[attempts - 1];
    await ctx.runMutation(internal.inbound.patchBody, {
      id,
      status: "received",
      error: message,
      attempts,
    });
    await ctx.scheduler.runAfter(delay, internal.inbound.fetchBody, {
      id,
      resendId,
    });
  } else {
    await ctx.runMutation(internal.inbound.patchBody, {
      id,
      status: "fetch_failed",
      error: message,
      attempts,
    });
  }
}

/** Caps by UTF-8 bytes, not chars: a Devanagari thread is 3 bytes a letter. */
function truncate(s: string, maxBytes: number): string {
  if (new TextEncoder().encode(s).length <= maxBytes) return s;
  let end = Math.min(s.length, maxBytes);
  while (end > 0 && new TextEncoder().encode(s.slice(0, end)).length > maxBytes) {
    end = Math.floor(end * 0.9);
  }
  return s.slice(0, end) + "\n… [truncated]";
}
