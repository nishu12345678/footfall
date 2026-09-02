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
 * and the redirect, this still grants the period. Both call markPaid, which
 * is idempotent, so a payment confirmed twice is charged once.
 *
 * The raw body is hashed exactly as received — parsing it first would change
 * the bytes and break the signature.
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

    if (!safeEqual(expected, signature)) {
      console.error("[razorpay] webhook signature mismatch");
      return new Response("bad signature", { status: 400 });
    }

    let event: unknown;
    try {
      event = JSON.parse(raw);
    } catch {
      return new Response("bad json", { status: 400 });
    }

    const body = event as {
      event?: unknown;
      payload?: {
        payment?: { entity?: { id?: unknown; order_id?: unknown } };
      };
    };

    const name = typeof body.event === "string" ? body.event : "";
    const entity = body.payload?.payment?.entity;
    const paymentId = typeof entity?.id === "string" ? entity.id : null;
    const orderId = typeof entity?.order_id === "string" ? entity.order_id : null;

    // Only a captured payment means the money actually moved.
    if (name === "payment.captured" && orderId && paymentId) {
      await ctx.runMutation(internal.billing.markPaid, {
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        confirmedBy: "webhook",
      });
    } else {
      console.log("[razorpay] ignoring event", name);
    }

    // Anything other than 2xx makes Razorpay retry, so acknowledge events
    // we deliberately ignore too.
    return new Response("ok", { status: 200 });
  }),
});

export default http;
