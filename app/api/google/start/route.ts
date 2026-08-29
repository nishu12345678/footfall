import { NextResponse, type NextRequest } from "next/server";

/**
 * Sends the owner to Google's consent screen.
 *
 * We ask for one scope: business.manage — "see, edit, create and delete your
 * Google business listings". access_type=offline plus prompt=consent is what
 * makes Google hand back a refresh token, without which the agent can only
 * act for an hour.
 */
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
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url.toString());
  response.cookies.set("g_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https"),
    path: "/",
    maxAge: 600,
  });
  return response;
};
