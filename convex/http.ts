import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

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

export default http;
