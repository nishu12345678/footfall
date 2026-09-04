import { NextResponse, type NextRequest } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@/convex/_generated/api";

/**
 * Sends the owner to Google's consent screen.
 *
 * The redirect URI is this deployment's HTTPS endpoint on .convex.site, not
 * the Next app: Google would not return an authorisation code to an
 * http://localhost redirect. `state` is a one-time token that tells the
 * callback which signed-in user came back, and it carries the PKCE verifier.
 */

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomVerifier(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64url(new Uint8Array(digest));
}

export const GET = async (request: NextRequest) => {
  const origin = request.nextUrl.origin;
  const fail = (reason: string) =>
    NextResponse.redirect(
      `${origin}/app/connect?error=${encodeURIComponent(reason)}`,
    );

  // With the fake Google switched on there is no consent screen to visit:
  // the callback is called straight away with a made-up code, and the
  // backend exchanges it with the mock's own token endpoint. No Google
  // Cloud project needed. See docs/local-testing.md.
  const mocked = process.env.GOOGLE_MOCK_ENABLED === "1";

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const convexSite = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if ((!clientId && !mocked) || !convexUrl || !convexSite) {
    return fail("Google or Convex is not configured.");
  }

  const sessionToken = await convexAuthNextjsToken();
  if (!sessionToken) return fail("Your session expired. Sign in again.");

  const verifier = randomVerifier();
  const challenge = await challengeFor(verifier);

  let state: string;
  try {
    const client = new ConvexHttpClient(convexUrl);
    client.setAuth(sessionToken);
    state = await client.mutation(api.google.startLink, {
      returnTo: `${origin}/app/connect/processing`,
      codeVerifier: verifier,
    });
  } catch (error) {
    console.error("[google/start]", error);
    return fail(
      error instanceof Error ? error.message : "Could not start the link.",
    );
  }

  if (mocked) {
    const callback = new URL(`${convexSite}/google/callback`);
    callback.searchParams.set("code", "mock-authorisation-code");
    callback.searchParams.set("state", state);
    return NextResponse.redirect(callback.toString());
  }
  if (!clientId) return fail("Google is not configured.");

  // Diagnostic: ?probe=1 asks for a basic scope instead of business.manage.
  const probe = request.nextUrl.searchParams.get("probe") === "1";
  const scope = probe
    ? "openid email profile"
    : "https://www.googleapis.com/auth/business.manage";

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${convexSite}/google/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  console.log(`[google/start] ${url.toString()}`);
  return NextResponse.redirect(url.toString());
};
