import { NextResponse, type NextRequest } from "next/server";

/**
 * Sends the owner to Google's consent screen.
 *
 * One scope: business.manage — "see, edit, create and delete your Google
 * business listings". access_type=offline plus prompt=consent is what makes
 * Google hand back a refresh token, without which the agent can only act
 * for an hour.
 *
 * PKCE is included because Google can decline to issue an authorisation
 * code without it. The verifier rides along in an httpOnly cookie and is
 * replayed at token exchange.
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
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID is not set" },
      { status: 500 },
    );
  }

  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/google/callback`;
  const state = crypto.randomUUID();
  const verifier = randomVerifier();
  const challenge = await challengeFor(verifier);

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    "https://www.googleapis.com/auth/business.manage",
  );
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  console.log(`[google/start] ${url.toString()}`);

  const response = NextResponse.redirect(url.toString());
  const cookie = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: origin.startsWith("https"),
    path: "/",
    maxAge: 600,
  };
  response.cookies.set("g_state", state, cookie);
  response.cookies.set("g_verifier", verifier, cookie);
  return response;
};
