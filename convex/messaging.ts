import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type ActionCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

/**
 * SMS and WhatsApp, through Twilio and nothing else.
 *
 * Every message the product sends comes through `sendNow` (or the `send`
 * action that wraps it) and leaves a row in `messages`. The row is the
 * truth about what happened: "sent" means Twilio accepted the message,
 * "delivered" means Twilio's status callback said the handset got it, and
 * "failed"/"undelivered" carry Twilio's own error code. Nothing here ever
 * reports a message as delivered on its own say-so.
 *
 * Configuration (Convex deployment env):
 *   TWILIO_ENABLED=1               master switch; anything else disables all
 *                                  Twilio calls, regardless of other keys
 *   TWILIO_ACCOUNT_SID             required
 *   TWILIO_AUTH_TOKEN              required
 *   TWILIO_FROM_NUMBER             an SMS-capable number, E.164 — OR —
 *   TWILIO_MESSAGING_SERVICE_SID   a Messaging Service (preferred: Twilio
 *                                  picks the sender and handles DLT/India)
 *   TWILIO_WHATSAPP_FROM           the WhatsApp sender, E.164, optional.
 *                                  Without it WhatsApp sends are skipped.
 *   OTP_DEV_ECHO=1                 dev only: log sign-in codes; without
 *                                  Twilio configured, treat the send as done
 */

export type Channel = "sms" | "whatsapp";

const TWILIO_API = "https://api.twilio.com/2010-04-01";

/** Retry delays after a transient failure. Three tries, then give up. */
const RETRY_AFTER_MS = [10_000, 60_000, 5 * 60_000];

/* ------------------------------- numbers -------------------------------- */

/**
 * Digits only, with country code, as E.164 ("+919319102143").
 * Indian numbers are the default: a bare 10-digit number gets +91.
 * Returns null for anything that can't be a real mobile number.
 */
export function toE164(raw: string, countryCode = "91"): string | null {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) digits = countryCode + digits;
  else if (digits.length === 13 && digits.startsWith("0" + countryCode)) {
    digits = digits.slice(1);
  }
  // E.164 is at most 15 digits; anything shorter than 8 is a typo.
  if (digits.length < 8 || digits.length > 15) return null;
  // An Indian mobile starts with 6-9.
  if (digits.startsWith(countryCode) && digits.length === 12) {
    if (!/^[6-9]/.test(digits.slice(2))) return null;
  }
  return `+${digits}`;
}

/* --------------------------------- config -------------------------------- */

type TwilioConfig = {
  accountSid: string;
  authToken: string;
  from?: string;
  messagingServiceSid?: string;
  whatsappFrom?: string;
};

/** The server-side enforcement gate. Credentials alone never enable sends. */
export function twilioEnabled(): boolean {
  return process.env.TWILIO_ENABLED === "1";
}

export function twilioConfig(): TwilioConfig | null {
  if (!twilioEnabled()) return null;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;
  if (!accountSid || !authToken) return null;
  if (!from && !messagingServiceSid && !whatsappFrom) return null;
  return { accountSid, authToken, from, messagingServiceSid, whatsappFrom };
}

/** Where Twilio reports delivery back to. Set automatically by Convex. */
function statusCallbackUrl(): string | null {
  const site = process.env.CONVEX_SITE_URL;
  if (!site || site.includes("127.0.0.1") || site.includes("localhost")) {
    // Twilio can't reach a laptop. No callback; rows stay at "sent".
    return null;
  }
  return `${site.replace(/\/+$/, "")}/twilio/status`;
}

/* ------------------------------- the rows ------------------------------- */

export const create = internalMutation({
  args: {
    userId: v.optional(v.id("users")),
    businessId: v.optional(v.id("businesses")),
    channel: v.union(v.literal("sms"), v.literal("whatsapp")),
    to: v.string(),
    body: v.string(),
    purpose: v.string(),
    dedupeKey: v.optional(v.string()),
  },
  returns: v.union(v.id("messages"), v.null()),
  handler: async (ctx, args) => {
    if (args.dedupeKey) {
      const existing = await ctx.db
        .query("messages")
        .withIndex("by_dedupe", (q) => q.eq("dedupeKey", args.dedupeKey))
        .first();
      // A retry of a failed send is fine; a second copy of one that went
      // (or is still going) is not.
      if (existing && existing.status !== "failed") return null;
    }
    const now = Date.now();
    return await ctx.db.insert("messages", {
      ...args,
      status: "queued",
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const get = internalQuery({
  args: { id: v.id("messages") },
  handler: async (ctx, { id }) => await ctx.db.get(id),
});

export const record = internalMutation({
  args: {
    id: v.id("messages"),
    status: v.string(),
    providerSid: v.optional(v.string()),
    providerStatus: v.optional(v.string()),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
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

/**
 * Twilio's status callback. Statuses only ever move forward: a late
 * "sent" must not overwrite a "delivered" that already landed.
 */
const STATUS_RANK: Record<string, number> = {
  queued: 0,
  accepted: 0,
  scheduled: 0,
  sending: 1,
  sent: 2,
  delivered: 3,
  read: 4,
  undelivered: 3,
  failed: 3,
  canceled: 3,
};

function ourStatus(twilio: string): string {
  switch (twilio) {
    case "delivered":
    case "read":
      return "delivered";
    case "undelivered":
      return "undelivered";
    case "failed":
    case "canceled":
      return "failed";
    case "queued":
    case "accepted":
    case "scheduled":
    case "sending":
    case "sent":
      return "sent";
    default:
      return "sent";
  }
}

export const applyStatus = internalMutation({
  args: {
    providerSid: v.string(),
    providerStatus: v.string(),
    errorCode: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, { providerSid, providerStatus, errorCode, errorMessage }) => {
    const row = await ctx.db
      .query("messages")
      .withIndex("by_sid", (q) => q.eq("providerSid", providerSid))
      .first();
    if (!row) {
      console.log(`[twilio] status for unknown message ${providerSid}`);
      return false;
    }
    const before = STATUS_RANK[row.providerStatus ?? "queued"] ?? 0;
    const after = STATUS_RANK[providerStatus] ?? 0;
    if (after < before) return true; // stale, out-of-order callback

    await ctx.db.patch(row._id, {
      status: ourStatus(providerStatus),
      providerStatus,
      errorCode: errorCode ?? row.errorCode,
      errorMessage: errorMessage ?? row.errorMessage,
      updatedAt: Date.now(),
    });
    if (providerStatus === "undelivered" || providerStatus === "failed") {
      console.error(
        `[twilio] ${row.channel} to ${row.to} ${providerStatus} (${errorCode ?? "?"}) purpose=${row.purpose}`,
      );
    }
    return true;
  },
});

/* ------------------------------- the send ------------------------------- */

export type SendResult = {
  ok: boolean;
  /** "sent" | "skipped" | "failed" | "queued" */
  status: string;
  id: Id<"messages"> | null;
  error?: string;
};

/** What the error meant, so the caller knows whether to retry. */
function classify(httpStatus: number) {
  if (httpStatus === 429 || httpStatus >= 500) return "retry";
  if (httpStatus === 401 || httpStatus === 403) return "config";
  // Invalid or unreachable number, opted out, region not enabled — no
  // amount of retrying will change these.
  return "permanent";
}

/** Twilio's own wording, cut to something a screen can show. */
function plain(code: number | undefined, message: string): string {
  switch (code) {
    case 21211:
    case 21214:
    case 21217:
      return "That mobile number isn't valid.";
    case 21614:
    case 30006:
      return "That number can't receive text messages.";
    case 21610:
      return "That number has opted out of messages.";
    case 21608:
      return "Twilio trial accounts can only message verified numbers.";
    case 21408:
      return "Messaging to that country isn't enabled on the Twilio account.";
    case 63007:
    case 63016:
    case 63018:
      return "WhatsApp isn't set up for this message yet.";
    case 30003:
    case 30005:
      return "That phone is off or unreachable.";
    case 30007:
      return "The carrier blocked the message.";
    default:
      return message.slice(0, 160);
  }
}

/**
 * One attempt at Twilio. Returns what to write on the row.
 */
async function callTwilio(
  cfg: TwilioConfig,
  channel: Channel,
  to: string,
  body: string,
): Promise<
  | { kind: "sent"; sid: string; status: string }
  | { kind: "retry" | "permanent" | "config"; code?: number; message: string }
> {
  const form = new URLSearchParams();
  form.set("Body", body);

  if (channel === "whatsapp") {
    if (!cfg.whatsappFrom) {
      return { kind: "config", message: "TWILIO_WHATSAPP_FROM is not set." };
    }
    form.set("To", `whatsapp:${to}`);
    form.set("From", `whatsapp:${cfg.whatsappFrom}`);
  } else {
    form.set("To", to);
    if (cfg.messagingServiceSid) {
      form.set("MessagingServiceSid", cfg.messagingServiceSid);
    } else if (cfg.from) {
      form.set("From", cfg.from);
    } else {
      return {
        kind: "config",
        message: "Set TWILIO_FROM_NUMBER or TWILIO_MESSAGING_SERVICE_SID.",
      };
    }
  }

  const callback = statusCallbackUrl();
  if (callback) form.set("StatusCallback", callback);

  let res: Response;
  try {
    res = await fetch(
      `${TWILIO_API}/Accounts/${cfg.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${cfg.accountSid}:${cfg.authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
    );
  } catch (error) {
    return {
      kind: "retry",
      message: `Could not reach Twilio: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  const text = await res.text();
  let json: { sid?: string; status?: string; code?: number; message?: string } =
    {};
  try {
    json = JSON.parse(text);
  } catch {
    /* Twilio always answers JSON; a non-JSON body is a gateway problem. */
  }

  if (res.ok && json.sid) {
    return { kind: "sent", sid: json.sid, status: json.status ?? "queued" };
  }

  const code = typeof json.code === "number" ? json.code : undefined;
  const message = json.message ?? text.slice(0, 200) ?? `HTTP ${res.status}`;
  console.error(`[twilio] ${res.status} ${code ?? ""} ${message}`);
  return { kind: classify(res.status), code, message };
}

/**
 * Sends one message now, from any action. This is the single entry point.
 *
 * Validation, dedupe, the Twilio call, and the row update all happen here.
 * On a transient Twilio problem the message is left "queued" and a retry
 * is scheduled; the caller gets status "queued" and can decide whether
 * that is good enough (a review invite: yes; a sign-in code: no).
 */
export async function sendNow(
  ctx: ActionCtx,
  args: {
    to: string;
    body: string;
    channel: Channel;
    purpose: string;
    dedupeKey?: string;
    userId?: Id<"users">;
    businessId?: Id<"businesses">;
  },
): Promise<SendResult> {
  // Do not create a message row or contact Twilio while the feature is off.
  // Callers such as reminders can safely treat this as an intentional skip.
  if (!twilioEnabled()) {
    console.log(`[twilio] disabled — skipping ${args.channel} for ${args.purpose}`);
    return { ok: true, status: "skipped", id: null };
  }

  const to = toE164(args.to);
  if (!to) {
    console.error(`[twilio] refusing invalid number for ${args.purpose}`);
    return {
      ok: false,
      status: "failed",
      id: null,
      error: "That mobile number isn't valid.",
    };
  }

  const id = await ctx.runMutation(internal.messaging.create, {
    ...args,
    to,
    body: args.body.slice(0, 1600),
  });
  if (id === null) {
    console.log(`[twilio] duplicate suppressed: ${args.dedupeKey}`);
    return { ok: true, status: "skipped", id: null };
  }

  return await attempt(ctx, id);
}

/** One delivery attempt on an existing row. Schedules the next if needed. */
async function attempt(ctx: ActionCtx, id: Id<"messages">): Promise<SendResult> {
  const row = await ctx.runQuery(internal.messaging.get, { id });
  if (!row) return { ok: false, status: "failed", id, error: "No such message." };
  if (row.status !== "queued") {
    return { ok: row.status !== "failed", status: row.status, id };
  }

  const cfg = twilioConfig();
  if (!cfg) {
    // Dev without Twilio: say so loudly, and let sign-in continue.
    const dev = process.env.OTP_DEV_ECHO === "1";
    console.log(
      `[twilio] not configured — ${dev ? "skipping" : "FAILING"} ${row.channel} to ${row.to}: ${row.body.slice(0, 80)}`,
    );
    await ctx.runMutation(internal.messaging.record, {
      id,
      status: dev ? "skipped" : "failed",
      errorMessage: "Twilio is not configured.",
      attempted: true,
    });
    return dev
      ? { ok: true, status: "skipped", id }
      : {
          ok: false,
          status: "failed",
          id,
          error: "Text messages aren't set up yet. Try email instead.",
        };
  }

  const result = await callTwilio(cfg, row.channel as Channel, row.to, row.body);

  if (result.kind === "sent") {
    await ctx.runMutation(internal.messaging.record, {
      id,
      status: "sent",
      providerSid: result.sid,
      providerStatus: result.status,
      attempted: true,
    });
    console.log(`[twilio] ${row.channel} ${row.purpose} -> ${row.to} ${result.sid}`);
    return { ok: true, status: "sent", id };
  }

  const attempts = row.attempts + 1;
  const friendly = plain(result.code, result.message);

  if (result.kind === "retry" && attempts <= RETRY_AFTER_MS.length) {
    const delay = RETRY_AFTER_MS[attempts - 1];
    await ctx.runMutation(internal.messaging.record, {
      id,
      status: "queued",
      errorCode: result.code ? String(result.code) : undefined,
      errorMessage: result.message,
      attempted: true,
      nextAttemptAt: Date.now() + delay,
    });
    await ctx.scheduler.runAfter(delay, internal.messaging.deliver, { id });
    return { ok: false, status: "queued", id, error: friendly };
  }

  await ctx.runMutation(internal.messaging.record, {
    id,
    status: "failed",
    errorCode: result.code ? String(result.code) : undefined,
    errorMessage: result.message,
    attempted: true,
  });
  return { ok: false, status: "failed", id, error: friendly };
}

/** Retries a queued message. Scheduled by `attempt`, never by hand. */
export const deliver = internalAction({
  args: { id: v.id("messages") },
  handler: async (ctx, { id }): Promise<SendResult> => await attempt(ctx, id),
});

/** The same thing as an action, for callers outside an action context. */
export const send = internalAction({
  args: {
    to: v.string(),
    body: v.string(),
    channel: v.union(v.literal("sms"), v.literal("whatsapp")),
    purpose: v.string(),
    dedupeKey: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    businessId: v.optional(v.id("businesses")),
  },
  handler: async (ctx, args): Promise<SendResult> => await sendNow(ctx, args),
});

/* ------------------------------ review invite ---------------------------- */

export const reviewInviteContext = internalQuery({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }) => {
    const customer = await ctx.db.get(customerId);
    if (!customer) return null;
    const business = await ctx.db.get(customer.businessId);
    if (!business) return null;
    return { customer, business };
  },
});

export const markInvited = internalMutation({
  args: { customerId: v.id("customers"), status: v.string() },
  handler: async (ctx, { customerId, status }) => {
    const customer = await ctx.db.get(customerId);
    if (!customer) return;

    const accepted = status === "sent" || status === "delivered";
    if (accepted) {
      await ctx.db.patch(customerId, { reviewLinkSentAt: Date.now() });
    }

    const title = accepted
      ? "Review link sent"
      : status === "queued"
        ? "Review link queued"
        : status === "skipped"
          ? "Review link not sent"
          : "Review link could not be sent";
    await ctx.db.insert("agentActions", {
      businessId: customer.businessId,
      type: "review_reply",
      title,
      detail: `To ${customer.phone.slice(-10)}${customer.name ? ` (${customer.name})` : ""}`,
      createdAt: Date.now(),
    });
  },
});

/**
 * Asks a customer for a review. WhatsApp first, because that is where an
 * Indian customer actually reads; SMS if WhatsApp isn't set up or refuses.
 */
export const sendReviewInvite = internalAction({
  args: { customerId: v.id("customers") },
  handler: async (ctx, { customerId }): Promise<SendResult> => {
    const c = await ctx.runQuery(internal.messaging.reviewInviteContext, {
      customerId,
    });
    if (!c) return { ok: false, status: "failed", id: null, error: "No customer." };

    const link = c.business.reviewUri ?? c.business.mapsUri;
    if (!link) {
      return {
        ok: false,
        status: "failed",
        id: null,
        error: "The listing has no review link yet.",
      };
    }

    const name = c.customer.name ? `Hi ${c.customer.name}, ` : "Hi, ";
    const body =
      `${name}thanks for visiting ${c.business.orgName}. ` +
      `If you have a moment, a Google review helps us a lot: ${link}`;

    const base = {
      to: c.customer.phone,
      body,
      purpose: "review_invite",
      userId: c.business.userId,
      businessId: c.business._id,
    };
    const day = new Date().toISOString().slice(0, 10);

    let result: SendResult = { ok: false, status: "skipped", id: null };
    if (twilioConfig()?.whatsappFrom) {
      result = await sendNow(ctx, {
        ...base,
        channel: "whatsapp",
        dedupeKey: `review_invite:wa:${customerId}:${day}`,
      });
    }
    if (!result.ok || result.status === "skipped") {
      result = await sendNow(ctx, {
        ...base,
        channel: "sms",
        dedupeKey: `review_invite:sms:${customerId}:${day}`,
      });
    }

    await ctx.runMutation(internal.messaging.markInvited, {
      customerId,
      status: result.ok ? result.status : "failed",
    });
    return result;
  },
});
