/**
 * Where the Google Business Profile APIs live.
 *
 * Every Google call in convex/ builds its URL from one of these, so the
 * whole backend can be pointed at a fake Google with a single env var.
 * That is how footfall is exercised without a real listing: set
 * GOOGLE_API_MOCK_URL on a local deployment to the mock served by
 * app/api/mock/google (see docs/local-testing.md) and posts, photos,
 * reviews, performance and the OAuth token exchange all go there instead.
 *
 * Leave it unset — the normal state, and the only sane one on production —
 * and these are Google's own hosts.
 *
 * They are functions, not constants, on purpose: the variable is read at
 * call time, so `npx convex env set` takes effect on the very next call
 * without waiting for a redeploy to replace a warm module.
 */

/**
 * The authorisation code the Next start route hands to the callback when
 * the fake Google is on. Only the mock's token endpoint accepts it; the
 * real one answers "Malformed auth code", which is the tell that the two
 * halves of the mock switch disagree.
 */
export const MOCK_AUTH_CODE = "mock-authorisation-code";

function mockBase(): string | null {
  const raw = process.env.GOOGLE_API_MOCK_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

/** True when the backend is talking to the fake Google, not the real one. */
export function googleMocked(): boolean {
  return mockBase() !== null;
}

/** OAuth 2 token endpoint: code exchange and refresh. */
export function tokenUrl(): string {
  const m = mockBase();
  return m ? `${m}/oauth2/token` : "https://oauth2.googleapis.com/token";
}

/** Account Management API: which accounts this Google user manages. */
export function accountsUrl(): string {
  const m = mockBase();
  return m
    ? `${m}/accountmanagement/v1/accounts`
    : "https://mybusinessaccountmanagement.googleapis.com/v1/accounts";
}

/** Business Information API: the listing itself, categories, services. */
export function infoBase(): string {
  const m = mockBase();
  return m
    ? `${m}/businessinformation/v1`
    : "https://mybusinessbusinessinformation.googleapis.com/v1";
}

/** The legacy v4 API: local posts, media and reviews. */
export function v4Base(): string {
  const m = mockBase();
  return m ? `${m}/v4` : "https://mybusiness.googleapis.com/v4";
}

/** Business Profile Performance API: daily views, calls, directions. */
export function perfBase(): string {
  const m = mockBase();
  return m
    ? `${m}/performance/v1`
    : "https://businessprofileperformance.googleapis.com/v1";
}
