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
 */

const MOCK = process.env.GOOGLE_API_MOCK_URL?.replace(/\/+$/, "");

/** True when the backend is talking to the fake Google, not the real one. */
export const GOOGLE_MOCKED = Boolean(MOCK);

/** OAuth 2 token endpoint: code exchange and refresh. */
export const TOKEN_URL = MOCK
  ? `${MOCK}/oauth2/token`
  : "https://oauth2.googleapis.com/token";

/** Account Management API: which accounts this Google user manages. */
export const ACCOUNTS_URL = MOCK
  ? `${MOCK}/accountmanagement/v1/accounts`
  : "https://mybusinessaccountmanagement.googleapis.com/v1/accounts";

/** Business Information API: the listing itself, categories, services. */
export const INFO_BASE = MOCK
  ? `${MOCK}/businessinformation/v1`
  : "https://mybusinessbusinessinformation.googleapis.com/v1";

/** The legacy v4 API: local posts, media and reviews. */
export const V4_BASE = MOCK
  ? `${MOCK}/v4`
  : "https://mybusiness.googleapis.com/v4";

/** Business Profile Performance API: daily views, calls, directions. */
export const PERF_BASE = MOCK
  ? `${MOCK}/performance/v1`
  : "https://businessprofileperformance.googleapis.com/v1";
