import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { hmacHex, safeEqual } from "./billing";

const http = httpRouter();

// Mounts the routes Convex Auth needs (token exchange, OAuth callbacks).
auth.addHttpRoutes(http);

/**
 * Google Business Profile consent lands here.
 *
 * It lives on .convex.site rather than the Next app because Google would not
 * return an authorisation code to an http://localhost redirect URI. This is
 * the same HTTPS origin Convex Auth's own Google login already uses.
 */
http.route({
  path: "/google/callback",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const params = url.searchParams;
    const redirectUri = `${url.origin}/google/callback`;

    const fallback = process.env.SITE_URL ?? "http://localhost:3000";
    const bounce = (to: string, error?: string) =>
      new Response(null, {
        status: 302,
        headers: {
          Location: error
            ? `${to}?error=${encodeURIComponent(error)}`
            : to,
        },
      });

    console.log(
      "[google/callback] params:",
      JSON.stringify(
        Object.fromEntries(
          [...params.entries()].map(([k, v]) => [
            k,
            k === "code" ? `${v.slice(0, 8)}…(${v.length} chars)` : v,
          ]),
        ),
      ),
    );

    const googleError = params.get("error");
    if (googleError) {
      return bounce(
        `${fallback}/app/connect`,
        googleError === "access_denied"
          ? "You didn't grant access, so we can't manage the listing."
          : googleError,
      );
    }

    const code = params.get("code");
    const state = params.get("state");
    if (!code || !state) {
      return bounce(
        `${fallback}/app/connect`,
        "Google didn't return an authorisation code.",
      );
    }

    const result = await ctx.runAction(internal.google.completeLink, {
      code,
      state,
      redirectUri,
    });

    const returnTo = result.returnTo ?? `${fallback}/app/connect/processing`;
    if (!result.ok) {
      return bounce(`${fallback}/app/connect`, result.error ?? "Linking failed.");
    }
    return bounce(returnTo);
  }),
});

/**
 * Razorpay's own confirmation.
 *
 * The browser hand-back in billing.verifyPayment is the fast path; this is
 * the one that has to be right. If the customer's phone dies between paying
 * and the redirect, this still grants the period.
 *
 * Three things keep it honest:
 *   - the raw body is hashed exactly as received — parsing it first would
 *     change the bytes and break the signature;
 *   - every event is keyed by x-razorpay-event-id and written down before
 *     it is acted on, so a redelivery is skipped;
 *   - the work itself runs in billing.handleWebhook, whose every step is
 *     idempotent, so even a lost event row can't double a period.
 *
 * Razorpay retries on anything but a 2xx. Events we ignore on purpose are
 * acknowledged too; a bad signature is not, so it shows up in their logs.
 */
http.route({
  path: "/razorpay/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[razorpay] webhook hit with no RAZORPAY_WEBHOOK_SECRET set");
      return new Response("not configured", { status: 500 });
    }

    const raw = await request.text();
    const signature = request.headers.get("x-razorpay-signature") ?? "";
    const expected = await hmacHex(secret, raw);

    if (!signature || !safeEqual(expected, signature)) {
      console.error("[razorpay] webhook signature mismatch");
      return new Response("bad signature", { status: 400 });
    }

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return new Response("bad json", { status: 400 });
    }

    // Razorpay sets this on every delivery. The fake webhook script and
    // very old events may not; hash the body so those still dedupe.
    const eventId =
      request.headers.get("x-razorpay-event-id") ??
      `sha:${(await hmacHex("event", raw)).slice(0, 40)}`;

    try {
      const outcome = await ctx.runAction(internal.billing.handleWebhook, {
        eventId,
        body,
      });
      return new Response(outcome, { status: 200 });
    } catch (error) {
      // Our fault, not theirs: let Razorpay retry it later.
      console.error("[razorpay] webhook handler threw", error);
      return new Response("retry", { status: 500 });
    }
  }),
});

/* ------------------------------- Twilio ---------------------------------
   Delivery status for every SMS and WhatsApp message. Twilio signs each
   callback with HMAC-SHA1 over the exact URL plus the POST fields sorted
   by name, keyed with the auth token.                                   */

async function twilioSignature(authToken: string, url: string, form: URLSearchParams) {
  const keys = [...form.keys()].sort();
  let data = url;
  for (const k of keys) data += k + (form.get(k) ?? "");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(authToken),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

http.route({
  path: "/twilio/status",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Keep accepting signed receipts for messages already in flight when the
    // outbound feature is switched off; this route cannot initiate a send.
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) return new Response("not configured", { status: 500 });

    const raw = await request.text();
    const form = new URLSearchParams(raw);

    // The URL Twilio signed is the public one we handed it, which is what
    // CONVEX_SITE_URL names; request.url can differ behind a proxy.
    const site = (process.env.CONVEX_SITE_URL ?? new URL(request.url).origin).replace(/\/+$/, "");
    const candidates = [`${site}/twilio/status`, request.url];
    const given = request.headers.get("x-twilio-signature") ?? "";
    let valid = false;
    for (const url of candidates) {
      if (safeEqual(await twilioSignature(authToken, url, form), given)) {
        valid = true;
        break;
      }
    }
    if (!valid) {
      console.error("[twilio] status callback signature mismatch");
      return new Response("bad signature", { status: 403 });
    }

    const sid = form.get("MessageSid") ?? form.get("SmsSid");
    const status = form.get("MessageStatus") ?? form.get("SmsStatus");
    if (!sid || !status) return new Response("missing fields", { status: 400 });

    await ctx.runMutation(internal.messaging.applyStatus, {
      providerSid: sid,
      providerStatus: status,
      errorCode: form.get("ErrorCode") ?? undefined,
      errorMessage: form.get("ErrorMessage") ?? undefined,
    });
    return new Response("ok", { status: 200 });
  }),
});

/* -------------------------------- Resend ---------------------------------
   Delivered / bounced / complained for every email. Resend signs with
   Svix: HMAC-SHA256 over "id.timestamp.body", base64, keyed with the
   base64-decoded part of the "whsec_…" secret.                          */

async function svixValid(secret: string, request: Request, raw: string) {
  const id = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signatures = request.headers.get("svix-signature");
  if (!id || !timestamp || !signatures) return false;

  // Five minutes of clock skew, either way.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;

  const keyBytes = Uint8Array.from(
    atob(secret.replace(/^whsec_/, "")),
    (c) => c.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${raw}`),
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(sig)));

  // Header carries "v1,<sig> v1,<sig>…"; any one matching is enough.
  return signatures
    .split(" ")
    .map((s) => s.split(",")[1] ?? "")
    .some((s) => safeEqual(s, expected));
}

http.route({
  path: "/resend/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) return new Response("not configured", { status: 500 });

    const raw = await request.text();
    if (!(await svixValid(secret, request, raw))) {
      console.error("[resend] webhook signature mismatch");
      return new Response("bad signature", { status: 400 });
    }

    let body: {
      type?: string;
      data?: {
        email_id?: string;
        to?: string[] | string;
        bounce?: { message?: string; type?: string };
        error?: { message?: string };
      };
    };
    try {
      body = JSON.parse(raw);
    } catch {
      return new Response("bad json", { status: 400 });
    }

    const type = body.type ?? "";
    const id = body.data?.email_id;
    if (!id) return new Response("ok", { status: 200 });

    const to = Array.isArray(body.data?.to) ? body.data?.to[0] : body.data?.to;
    const detail =
      body.data?.bounce?.message ??
      body.data?.error?.message ??
      body.data?.bounce?.type;

    await ctx.runMutation(internal.email.applyEvent, {
      resendId: id,
      type,
      to: to ?? undefined,
      detail: detail ?? undefined,
    });
    return new Response("ok", { status: 200 });
  }),
});

export default http;
