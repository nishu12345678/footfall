import { NextResponse, type NextRequest } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@/convex/_generated/api";

/**
 * Google sends the owner back here. We swap the code for tokens through a
 * Convex action (so the tokens are written server-side, never touching the
 * browser) and then hand off to the processing screen.
 */
export const GET = async (request: NextRequest) => {
  const origin = request.nextUrl.origin;
  const params = request.nextUrl.searchParams;

  // Log exactly what Google sent so a missing `code` is obvious.
  console.log(
    "[google/callback] params:",
    JSON.stringify(
      Object.fromEntries(
        [...params.entries()].map(([k, v]) => [
          k,
          k === "code" ? `${v.slice(0, 8)}…(${v.length} chars)` : v,
        ]),
      ),
      null,
      2,
    ),
  );

  const fail = (reason: string) =>
    NextResponse.redirect(
      `${origin}/app/connect?error=${encodeURIComponent(reason)}`,
    );

  const googleError = params.get("error");
  if (googleError) {
    return fail(
      googleError === "access_denied"
        ? "You didn't grant access, so we can't manage the listing."
        : googleError,
    );
  }

  const code = params.get("code");
  if (!code) return fail("Google didn't send an authorisation code.");

  const state = params.get("state");
  const expected = request.cookies.get("g_state")?.value;
  if (!state || !expected || state !== expected) {
    return fail("That sign-in link expired. Try connecting again.");
  }

  const codeVerifier = request.cookies.get("g_verifier")?.value;
  if (!codeVerifier) {
    return fail("That sign-in link expired. Try connecting again.");
  }

  const token = await convexAuthNextjsToken();
  console.log(
    `[google/callback] convex session token: ${token ? "present" : "MISSING"}`,
  );
  if (!token) return fail("Your session expired. Sign in again.");

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return fail("Backend is not configured.");

  try {
    const client = new ConvexHttpClient(convexUrl);
    client.setAuth(token);
    await client.action(api.google.exchangeCode, {
      code,
      codeVerifier,
      redirectUri: `${origin}/api/google/callback`,
    });
  } catch (error) {
    console.error("[google/callback]", error);
    return fail(
      error instanceof Error ? error.message : "Could not link your Google account.",
    );
  }

  const response = NextResponse.redirect(`${origin}/app/connect/processing`);
  response.cookies.delete("g_state");
  response.cookies.delete("g_verifier");
  return response;
};
