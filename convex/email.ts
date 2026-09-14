import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { render } from "./emailTemplates";
import { activeBusinessFor } from "./access";

/**
 * Email, through Resend and nothing else.
 *
 * Same discipline as messaging.ts: one entry point (`sendNow` / `send`),
 * one row per email in `emails`, and the row says what actually happened.
 * "sent" means Resend accepted it; "delivered", "bounced" and
 * "complained" come from Resend's webhook at /resend/webhook.
 *
 * Duplicates are stopped twice over. Our own dedupe key refuses a second
 * row for the same event, and the same key goes to Resend as an
 * Idempotency-Key, so a retried request after a network blip can't send
 * two copies either.
 *
 * Configuration (Convex deployment env):
 *   RESEND_API_KEY          required (AUTH_RESEND_KEY still read as a fallback)
 *   EMAIL_FROM              "footfall <hello@footfall.zone>"; must be a
 *                           verified Resend domain (AUTH_EMAIL_FROM fallback)
 *   RESEND_WEBHOOK_SECRET   the "whsec_…" from the Resend webhook page
 *   EMAIL_REPLY_TO          optional
 *   OTP_DEV_ECHO=1          dev only: without Resend, treat sends as done
 */

const RESEND_API = "https://api.resend.com/emails";
const RETRY_AFTER_MS = [10_000, 60_000, 5 * 60_000];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function apiKey(): string | null {
  return process.env.RESEND_API_KEY ?? process.env.AUTH_RESEND_KEY ?? null;
}

export function fromAddress(): string {
  // `convex env set --from-file` keeps surrounding quotes, and Resend
  // rejects a from field that starts with one. Strip them here.
  const raw =
    process.env.EMAIL_FROM ??
    process.env.AUTH_EMAIL_FROM ??
    "footfall <onboarding@resend.dev>";
  return raw.trim().replace(/^["']+|["']+$/g, "").trim();
}

export function normaliseEmail(raw: string): string | null {
  const email = String(raw ?? "").trim().toLowerCase();
  return EMAIL_RE.test(email) ? email : null;
}

/* ------------------------------- the rows ------------------------------- */

export const create = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    businessId: v.optional(v.id("businesses")),
    to: v.string(),
    subject: v.string(),
    purpose: v.string(),
    dedupeKey: v.optional(v.string()),
  },
  returns: v.union(
    v.object({ id: v.id("emails"), suppressed: v.boolean() }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    if (args.dedupeKey) {
      const existing = await ctx.db
        .query("emails")
        .withIndex("by_dedupe", (q) => q.eq("dedupeKey", args.dedupeKey))
        .first();
      if (existing && existing.status !== "failed") return null;
    }
    const suppressed = await ctx.db
      .query("emailSuppressions")
      .withIndex("by_email", (q) => q.eq("email", args.to))
      .first();

    const now = Date.now();
    const id = await ctx.db.insert("emails", {
      ...args,
      status: suppressed ? "skipped" : "queued",
      error: suppressed ? `Suppressed: ${suppressed.reason}` : undefined,
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    });
    return { id, suppressed: Boolean(suppressed) };
  },
});

export const get = internalQuery({
  args: { id: v.id("emails") },
  handler: async (ctx, { id }) => await ctx.db.get(id),
});

export const record = internalMutation({
  args: {
    id: v.id("emails"),
    status: v.string(),
    resendId: v.optional(v.string()),
    error: v.optional(v.string()),
    attempted: v.optional(v.boolean()),
    nextAttemptAt: v.optional(v.number()),
  },
  handler: async (ctx, { id, attempted, ...rest }) => {
    const row = await ctx.db.get(id);
    if (!row) return;
    await ctx.db.patch(id, {
      ...rest,
      attempts: row.attempts + (attempted ? 1 : 0),
      updatedAt: Date.now(),
    });
  },
});

export const suppress = internalMutation({
  args: { email: v.string(), reason: v.string(), detail: v.optional(v.string()) },
  handler: async (ctx, { email, reason, detail }) => {
    const existing = await ctx.db
      .query("emailSuppressions")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (existing) return;
    await ctx.db.insert("emailSuppressions", {
      email,
      reason,
      detail,
      createdAt: Date.now(),
    });
    console.error(`[resend] suppressing ${email}: ${reason} ${detail ?? ""}`);
  },
});

/**
 * Takes an address off the suppression list, for when a bounce was our
 * fault (a bad `from`, a domain not yet verified) rather than theirs:
 *
 *   npx convex run email:unsuppress '{"email":"owner@example.com"}'
 */
export const unsuppress = internalMutation({
  args: { email: v.string() },
  returns: v.object({ removed: v.number() }),
  handler: async (ctx, { email }) => {
    const address = normaliseEmail(email) ?? email.trim().toLowerCase();
    const rows = await ctx.db
      .query("emailSuppressions")
      .withIndex("by_email", (q) => q.eq("email", address))
      .collect();
    for (const r of rows) await ctx.db.delete(r._id);
    return { removed: rows.length };
  },
});

/**
 * Resend's webhook. Bounces and complaints suppress the address; the
 * rest just keeps the row honest.
 */
const STATUS_RANK: Record<string, number> = {
  queued: 0,
  sent: 1,
  delayed: 1,
  delivered: 2,
  bounced: 3,
  complained: 3,
  failed: 3,
};

export const applyEvent = internalMutation({
  args: {
    resendId: v.string(),
    type: v.string(),
    to: v.optional(v.string()),
    detail: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, { resendId, type, to, detail }) => {
    const status = (
      {
        "email.sent": "sent",
        "email.delivered": "delivered",
        "email.delivery_delayed": "delayed",
        "email.bounced": "bounced",
        "email.complained": "complained",
        "email.failed": "failed",
      } as Record<string, string>
    )[type];
    if (!status) return false;

    const row = await ctx.db
      .query("emails")
      .withIndex("by_resend_id", (q) => q.eq("resendId", resendId))
      .first();

    const address = row?.to ?? (to ? normaliseEmail(to) : null);
    if (status === "bounced" || status === "complained") {
      if (address) {
        const existing = await ctx.db
          .query("emailSuppressions")
          .withIndex("by_email", (q) => q.eq("email", address))
          .first();
        if (!existing) {
          await ctx.db.insert("emailSuppressions", {
            email: address,
            reason: status,
            detail,
            createdAt: Date.now(),
          });
        }
      }
    }

    if (!row) return false;
    if ((STATUS_RANK[status] ?? 0) < (STATUS_RANK[row.status] ?? 0)) return true;
    await ctx.db.patch(row._id, {
      status,
      error: detail ?? row.error,
      updatedAt: Date.now(),
    });
    return true;
  },
});

/* ------------------------------- the send ------------------------------- */

export type EmailResult = {
  ok: boolean;
  /** "sent" | "skipped" | "failed" | "queued" */
  status: string;
  id: Id<"emails"> | null;
  error?: string;
};

export type EmailArgs = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  purpose: string;
  dedupeKey?: string;
  userId?: Id<"users">;
  businessId?: Id<"businesses">;
};

async function callResend(
  key: string,
  row: { to: string; subject: string; dedupeKey?: string },
  text: string,
  html: string | undefined,
): Promise<
  | { kind: "sent"; id: string }
  | { kind: "retry" | "permanent" | "config"; message: string; status?: number }
> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  // Resend keeps the key for 24 hours; a retried request with the same key
  // returns the original email instead of sending another.
  if (row.dedupeKey) headers["Idempotency-Key"] = row.dedupeKey.slice(0, 256);

  let res: Response;
  try {
    res = await fetch(RESEND_API, {
      method: "POST",
      headers,
      body: JSON.stringify({
        from: fromAddress(),
        to: [row.to],
        reply_to: process.env.EMAIL_REPLY_TO || undefined,
        subject: row.subject,
        text,
        html,
      }),
    });
  } catch (error) {
    return {
      kind: "retry",
      message: `Could not reach Resend: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const body = await res.text();
  let json: { id?: string; name?: string; message?: string } = {};
  try {
    json = JSON.parse(body);
  } catch {
    /* non-JSON: a gateway problem */
  }

  if (res.ok && json.id) return { kind: "sent", id: json.id };

  const message = json.message ?? body.slice(0, 200) ?? `HTTP ${res.status}`;
  console.error(`[resend] ${res.status} ${json.name ?? ""} ${message}`);

  if (res.status === 429 || res.status >= 500) return { kind: "retry", message };
  if (res.status === 401 || res.status === 403) return { kind: "config", message };
  return { kind: "permanent", message, status: res.status };
}

/**
 * Sends one email now, from any action. The single entry point.
 */
export async function sendNow(ctx: ActionCtx, args: EmailArgs): Promise<EmailResult> {
  const to = normaliseEmail(args.to);
  if (!to) {
    console.error(`[resend] refusing invalid address for ${args.purpose}`);
    return {
      ok: false,
      status: "failed",
      id: null,
      error: "That email address isn't valid.",
    };
  }

  const created = await ctx.runMutation(internal.email.create, {
    userId: args.userId,
    businessId: args.businessId,
    to,
    subject: args.subject.slice(0, 200),
    purpose: args.purpose,
    dedupeKey: args.dedupeKey,
  });
  if (created === null) {
    console.log(`[resend] duplicate suppressed: ${args.dedupeKey}`);
    return { ok: true, status: "skipped", id: null };
  }
  if (created.suppressed) {
    return {
      ok: false,
      status: "skipped",
      id: created.id,
      error: "That address has bounced before. Try a different one.",
    };
  }

  return await attempt(ctx, created.id, args.text, args.html);
}

async function attempt(
  ctx: ActionCtx,
  id: Id<"emails">,
  text: string,
  html: string | undefined,
): Promise<EmailResult> {
  const row = await ctx.runQuery(internal.email.get, { id });
  if (!row) return { ok: false, status: "failed", id, error: "No such email." };
  if (row.status !== "queued") {
    return { ok: row.status !== "failed" && row.status !== "skipped", status: row.status, id };
  }

  const key = apiKey();
  if (!key) {
    const dev = process.env.OTP_DEV_ECHO === "1";
    console.log(
      `[resend] not configured — ${dev ? "skipping" : "FAILING"} "${row.subject}" to ${row.to}\n${text.slice(0, 400)}`,
    );
    await ctx.runMutation(internal.email.record, {
      id,
      status: dev ? "skipped" : "failed",
      error: "Resend is not configured.",
      attempted: true,
    });
    return dev
      ? { ok: true, status: "skipped", id }
      : { ok: false, status: "failed", id, error: "Email isn't set up yet." };
  }

  const result = await callResend(key, row, text, html);

  if (result.kind === "sent") {
    await ctx.runMutation(internal.email.record, {
      id,
      status: "sent",
      resendId: result.id,
      attempted: true,
    });
    console.log(`[resend] ${row.purpose} -> ${row.to} ${result.id}`);
    return { ok: true, status: "sent", id };
  }

  const attempts = row.attempts + 1;
  if (result.kind === "retry" && attempts <= RETRY_AFTER_MS.length) {
    const delay = RETRY_AFTER_MS[attempts - 1];
    await ctx.runMutation(internal.email.record, {
      id,
      status: "queued",
      error: result.message,
      attempted: true,
      nextAttemptAt: Date.now() + delay,
    });
    await ctx.scheduler.runAfter(delay, internal.email.deliver, {
      id,
      text,
      html,
    });
    return { ok: false, status: "queued", id, error: result.message };
  }

  await ctx.runMutation(internal.email.record, {
    id,
    status: "failed",
    error: result.message,
    attempted: true,
  });
  // Only a complaint about the *recipient* marks the address bad. A bad
  // `from`, a missing domain or a malformed body is our problem, not
  // theirs, and must not lock them out of email.
  if (
    result.kind === "permanent" &&
    result.status === 422 &&
    /`to`|\bto\b.*(invalid|not valid)|(invalid|not valid).*\bto\b|recipient/i.test(result.message) &&
    !/`from`|`reply_to`|`subject`|domain/i.test(result.message)
  ) {
    await ctx.runMutation(internal.email.suppress, {
      email: row.to,
      reason: "invalid",
      detail: result.message,
    });
  }
  const ours =
    result.kind === "config" ||
    /`from`|`reply_to`|domain|api key|unauthori[sz]ed/i.test(result.message);
  return {
    ok: false,
    status: "failed",
    id,
    error: ours
      ? "Email isn't set up correctly on our side yet. Try signing in with your mobile number instead."
      : "Couldn't send to that address. Check it and try again.",
  };
}

/** Retries a queued email. Scheduled by `attempt`, never by hand. */
export const deliver = internalAction({
  args: { id: v.id("emails"), text: v.string(), html: v.optional(v.string()) },
  handler: async (ctx, { id, text, html }): Promise<EmailResult> =>
    await attempt(ctx, id, text, html),
});

/** The same thing as an action, for mutations that schedule an email. */
export const send = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    text: v.string(),
    html: v.optional(v.string()),
    purpose: v.string(),
    dedupeKey: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, args): Promise<EmailResult> => await sendNow(ctx, args),
});

/* ------------------------------ addressing ------------------------------ */

/**
 * Where to write to a user: the address they sign in with, or the one on
 * the listing. Returns null when there is nowhere to write.
 */
export const addressFor = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      email: v.string(),
      name: v.optional(v.string()),
      businessId: v.optional(v.id("businesses")),
      orgName: v.optional(v.string()),
    }),
    v.null(),
  ),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get(userId);
    const business = await activeBusinessFor(ctx, userId);
    const email =
      (user?.email && normaliseEmail(user.email)) ||
      (business?.email && normaliseEmail(business.email)) ||
      null;
    if (!email) return null;
    return {
      email,
      name: user?.name ?? undefined,
      businessId: business?._id,
      orgName: business?.orgName,
    };
  },
});

/**
 * Sends a templated email to a user, if we have an address. This is what
 * every product flow calls; the templates live in emailTemplates.ts.
 */
export const sendToUser = internalAction({
  args: {
    userId: v.id("users"),
    template: v.string(),
    params: v.optional(v.any()),
    dedupeKey: v.string(),
  },
  handler: async (ctx, { userId, template, params, dedupeKey }): Promise<EmailResult> => {
    const who = await ctx.runQuery(internal.email.addressFor, { userId });
    if (!who) {
      // Written down, so "why didn't I get that email?" has an answer.
      console.log(`[resend] no address for user ${userId}; skipping ${template}`);
      const created = await ctx.runMutation(internal.email.create, {
        userId,
        to: "(no address on file)",
        subject: template,
        purpose: template,
        dedupeKey,
      });
      if (created) {
        await ctx.runMutation(internal.email.record, {
          id: created.id,
          status: "skipped",
          error: "No email address on the account or the listing.",
        });
      }
      return { ok: false, status: "skipped", id: created?.id ?? null, error: "No email on file." };
    }
    const message = render(template, {
      ...(params ?? {}),
      name: who.name,
      orgName: who.orgName,
    });
    return await sendNow(ctx, {
      to: who.email,
      subject: message.subject,
      text: message.text,
      html: message.html,
      purpose: template,
      dedupeKey,
      userId,
      businessId: who.businessId,
    });
  },
});
