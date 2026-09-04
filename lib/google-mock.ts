/**
 * A fake Google Business Profile.
 *
 * footfall can't be exercised without a listing, and a real one needs a
 * Google Cloud project with Business Profile API access, which Google only
 * grants to verified businesses. This is the listing you don't have: one
 * account, one salon in Thane, with reviews, photos, posts and a month of
 * performance, answering on the same paths and in the same shapes as the
 * real APIs, so the Convex code that talks to Google runs unchanged.
 *
 * It is served by app/api/mock/google when GOOGLE_MOCK_ENABLED=1, and the
 * backend is pointed at it with GOOGLE_API_MOCK_URL (see
 * convex/googleHosts.ts). The same handler is driven directly by
 * convex/googleMock.test.ts, which is what keeps the shapes honest.
 *
 * State lives in this module. A post published through it shows up in the
 * next list; a reply lands on its review. Restart the dev server, or POST
 * _control/reset, to start over. POST _control/revoke makes every call
 * fail the way Google does once an owner removes the app from their
 * account, which is how the reconnect path gets tested.
 */

export const MOCK_ACCOUNT = "accounts/900800700";
export const MOCK_LOCATION = "locations/100200300";
const PARENT = `${MOCK_ACCOUNT}/${MOCK_LOCATION}`;

type Star = "ONE" | "TWO" | "THREE" | "FOUR" | "FIVE";

export type MockReview = {
  name: string;
  reviewId: string;
  reviewer: { displayName: string; profilePhotoUrl?: string };
  starRating: Star;
  comment?: string;
  createTime: string;
  updateTime: string;
  reviewReply?: { comment: string; updateTime: string };
};

export type MockPost = {
  name: string;
  languageCode: string;
  summary: string;
  topicType: string;
  state: "LIVE";
  createTime: string;
  updateTime: string;
  callToAction?: unknown;
  media?: { mediaFormat: "PHOTO"; googleUrl: string }[];
};

export type MockMedia = {
  name: string;
  mediaFormat: "PHOTO" | "VIDEO";
  /** Absolute, or "img/<seed>" for a picture the mock draws itself. */
  googleUrl: string;
  description?: string;
  createTime: string;
  locationAssociation: { category: string };
};

export type MockState = {
  revoked: boolean;
  tokensIssued: number;
  serviceItems: unknown[];
  posts: MockPost[];
  media: MockMedia[];
  reviews: MockReview[];
};

export type MockRequest = {
  method: string;
  /** Path after the mock's base, e.g. "v4/accounts/1/locations/2/reviews". */
  path: string;
  query: URLSearchParams;
  /** Parsed body: a JSON object, or form fields for the token endpoint. */
  body: unknown;
  /** The bearer token from the Authorization header, if any. */
  bearer: string | null;
  /** The mock's own absolute base URL, for the image links it hands out. */
  origin: string;
};

export type MockResponse = { status: number; body: unknown };

/* -------------------------------- fixture ------------------------------- */

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

/** Stable pseudo-randomness, so performance numbers survive a restart. */
export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

const SERVICE_TYPES = [
  ["job_type_id:haircut", "Haircut"],
  ["job_type_id:hair_coloring", "Hair colouring"],
  ["job_type_id:hair_spa", "Hair spa"],
  ["job_type_id:keratin_treatment", "Keratin treatment"],
  ["job_type_id:facial", "Facial"],
  ["job_type_id:waxing", "Waxing"],
  ["job_type_id:threading", "Threading"],
  ["job_type_id:manicure", "Manicure"],
  ["job_type_id:pedicure", "Pedicure"],
  ["job_type_id:bridal_makeup", "Bridal makeup"],
].map(([serviceTypeId, displayName]) => ({ serviceTypeId, displayName }));

const HOURS = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
].map((day) => ({
  openDay: day,
  openTime: { hours: 10 },
  closeDay: day,
  closeTime: { hours: day === "SUNDAY" ? 18 : 20 },
}));

function review(
  id: string,
  displayName: string,
  starRating: Star,
  daysAgo: number,
  comment?: string,
  reply?: string,
): MockReview {
  return {
    name: `${PARENT}/reviews/${id}`,
    reviewId: id,
    reviewer: { displayName },
    starRating,
    comment,
    createTime: ago(daysAgo),
    updateTime: ago(daysAgo),
    reviewReply: reply
      ? { comment: reply, updateTime: ago(Math.max(daysAgo - 1, 0)) }
      : undefined,
  };
}

function freshState(): MockState {
  return {
    revoked: false,
    tokensIssued: 0,
    serviceItems: [],
    reviews: [
      review(
        "r1",
        "Priya Sharma",
        "FIVE",
        3,
        "Got a keratin treatment done here last week and my hair has never felt this smooth. Sunita was patient with all my questions.",
      ),
      review(
        "r2",
        "Rahul Mehta",
        "FOUR",
        6,
        "Good haircut, reasonable price. But the wait was long even with an appointment.",
      ),
      review(
        "r3",
        "Sneha Kulkarni",
        "FIVE",
        11,
        "Best bridal makeup in Thane. They came home on the wedding morning and everything was on time.",
        "Thank you Sneha, it was a joy to be part of your day. Wishing you both a wonderful life ahead.",
      ),
      review(
        "r4",
        "Amit Desai",
        "TWO",
        14,
        "Asked for a trim and lost three inches. Staff argued instead of listening.",
      ),
      review(
        "r5",
        "Neha Joshi",
        "FIVE",
        22,
        "Clean place, gentle hands, and the hair spa is worth every rupee.",
        "Thanks Neha, the hair spa is our favourite too. See you next month.",
      ),
      review("r6", "Karan Patil", "THREE", 30),
      review(
        "r7",
        "Anjali Rao",
        "FIVE",
        45,
        "Regular here for threading and facials. Never had a bad experience in two years.",
        "Two years already, Anjali. Thank you for trusting us with your skin all this time.",
      ),
      review(
        "r8",
        "Vikram Shah",
        "ONE",
        70,
        "Overpriced for what it is.",
        "We're sorry it felt that way, Vikram. Do call us on the salon number so we can understand what went wrong.",
      ),
    ],
    media: [
      ["glow-front", "Front of the salon on Pokhran Road", 200],
      ["glow-spa", "Hair spa station", 160],
      ["glow-bridal", "Bridal makeup, ready to leave", 120],
      ["glow-pedicure", "Pedicure corner", 90],
      ["glow-shelf", "Products we use and sell", 60],
      ["glow-reception", "Reception", 30],
    ].map(([seed, description, daysAgo], i) => ({
      name: `${PARENT}/media/m${i + 1}`,
      mediaFormat: "PHOTO" as const,
      googleUrl: `img/${seed}`,
      description: String(description),
      createTime: ago(Number(daysAgo)),
      locationAssociation: { category: "ADDITIONAL" },
    })),
    posts: [
      {
        name: `${PARENT}/localPosts/p1`,
        languageCode: "en-IN",
        summary:
          "Monsoon hair spa offer: any hair spa with a free scalp massage this month. Walk in or call to book, we're open till 8.",
        topicType: "STANDARD",
        state: "LIVE",
        createTime: ago(58),
        updateTime: ago(58),
        media: [{ mediaFormat: "PHOTO", googleUrl: "img/glow-spa" }],
      },
      {
        name: `${PARENT}/localPosts/p2`,
        languageCode: "en-IN",
        summary:
          "We're now open on Sundays, 10 to 6. Bridal trials on Sunday mornings by appointment.",
        topicType: "STANDARD",
        state: "LIVE",
        createTime: ago(150),
        updateTime: ago(150),
      },
    ],
  };
}

let state: MockState = freshState();

export function resetGoogleMock(): void {
  state = freshState();
}

export function getGoogleMockState(): MockState {
  return state;
}

/* ------------------------------- documents ------------------------------ */

function absolute(url: string, origin: string): string {
  return url.startsWith("img/") ? `${origin}/${url}=s0` : url;
}

function locationDoc() {
  return {
    name: MOCK_LOCATION,
    languageCode: "en",
    title: "Glow Salon",
    phoneNumbers: { primaryPhone: "+91 98200 12345" },
    categories: {
      primaryCategory: {
        name: "gcid:beauty_salon",
        displayName: "Beauty salon",
        serviceTypes: SERVICE_TYPES,
      },
      additionalCategories: [
        { name: "gcid:hair_salon", displayName: "Hair salon" },
        { name: "gcid:nail_salon", displayName: "Nail salon" },
      ],
    },
    storefrontAddress: {
      regionCode: "IN",
      languageCode: "en",
      postalCode: "400610",
      administrativeArea: "Maharashtra",
      locality: "Thane",
      addressLines: ["Shop 4, Vasant Vihar Complex", "Pokhran Road No. 2"],
    },
    websiteUri: "https://glowsalonthane.example.com",
    regularHours: { periods: HOURS },
    latlng: { latitude: 19.2183, longitude: 72.9781 },
    metadata: {
      mapsUri: "https://maps.google.com/?cid=900800700100200300",
      newReviewUri: "https://g.page/r/mock-glow-salon/review",
    },
    serviceItems: state.serviceItems,
  };
}

function mediaDoc(m: MockMedia, origin: string) {
  const googleUrl = absolute(m.googleUrl, origin);
  return { ...m, googleUrl, thumbnailUrl: googleUrl };
}

function postDoc(p: MockPost, origin: string) {
  return {
    ...p,
    media: p.media?.map((m) => ({
      ...m,
      googleUrl: absolute(m.googleUrl, origin),
    })),
  };
}

const STAR_VALUE: Record<Star, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

/* ------------------------------ performance ----------------------------- */

function metricValue(metric: string, date: string): number {
  const r = hashSeed(`${metric}|${date}`) % 100;
  switch (metric) {
    case "BUSINESS_IMPRESSIONS_DESKTOP_MAPS":
      return 3 + (r % 8);
    case "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH":
      return 4 + (r % 10);
    case "BUSINESS_IMPRESSIONS_MOBILE_MAPS":
      return 10 + (r % 25);
    case "BUSINESS_IMPRESSIONS_MOBILE_SEARCH":
      return 12 + (r % 30);
    case "CALL_CLICKS":
      return r % 4;
    case "BUSINESS_DIRECTION_REQUESTS":
      return r % 5;
    case "WEBSITE_CLICKS":
      return r % 6;
    default:
      return r % 10;
  }
}

function performance(query: URLSearchParams): MockResponse {
  const n = (k: string, fallback: number) => Number(query.get(k) ?? fallback);
  const today = new Date();
  const start = Date.UTC(
    n("dailyRange.start_date.year", today.getUTCFullYear()),
    n("dailyRange.start_date.month", today.getUTCMonth() + 1) - 1,
    n("dailyRange.start_date.day", today.getUTCDate() - 30),
  );
  const end = Date.UTC(
    n("dailyRange.end_date.year", today.getUTCFullYear()),
    n("dailyRange.end_date.month", today.getUTCMonth() + 1) - 1,
    n("dailyRange.end_date.day", today.getUTCDate()),
  );
  const metrics = query.getAll("dailyMetrics");
  if (metrics.length === 0) {
    return googleError(400, "INVALID_ARGUMENT", "dailyMetrics is required.");
  }

  const dates: { year: number; month: number; day: number; key: string }[] =
    [];
  for (let t = start; t <= end && dates.length < 400; t += DAY) {
    const d = new Date(t);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    dates.push({ year, month, day, key: `${year}-${month}-${day}` });
  }

  return ok({
    multiDailyMetricTimeSeries: [
      {
        dailyMetricTimeSeries: metrics.map((metric) => ({
          dailyMetric: metric,
          timeSeries: {
            datedValues: dates.map(({ year, month, day, key }) => ({
              date: { year, month, day },
              value: String(metricValue(metric, key)),
            })),
          },
        })),
      },
    ],
  });
}

/* -------------------------------- helpers ------------------------------- */

function ok(body: unknown): MockResponse {
  return { status: 200, body };
}

function googleError(
  code: number,
  status: string,
  message: string,
): MockResponse {
  return { status: code, body: { error: { code, message, status } } };
}

const notFound = () =>
  googleError(404, "NOT_FOUND", "Requested entity was not found.");

const field = (body: unknown, key: string): string | undefined => {
  if (!body || typeof body !== "object") return undefined;
  const v = (body as Record<string, unknown>)[key];
  return typeof v === "string" ? v : undefined;
};

/* -------------------------------- router -------------------------------- */

function token(method: string, body: unknown): MockResponse {
  if (method !== "POST") return notFound();
  if (state.revoked) {
    return {
      status: 400,
      body: {
        error: "invalid_grant",
        error_description: "Token has been expired or revoked.",
      },
    };
  }
  state.tokensIssued += 1;
  const grant = field(body, "grant_type");
  return ok({
    access_token: `mock-access-${state.tokensIssued}`,
    expires_in: 3599,
    // Google only hands a refresh token back on the first consent.
    ...(grant === "authorization_code" ? { refresh_token: "mock-refresh" } : {}),
    scope: "https://www.googleapis.com/auth/business.manage",
    token_type: "Bearer",
  });
}

function control(action: string): MockResponse {
  switch (action) {
    case "reset":
      resetGoogleMock();
      return ok({ ok: true, reset: true });
    case "revoke":
      state.revoked = true;
      return ok({ ok: true, revoked: true });
    case "restore":
      state.revoked = false;
      return ok({ ok: true, revoked: false });
    case "state":
      return ok({
        revoked: state.revoked,
        tokensIssued: state.tokensIssued,
        posts: state.posts.length,
        media: state.media.length,
        reviews: state.reviews.length,
        unreplied: state.reviews.filter((r) => !r.reviewReply).length,
        serviceItems: state.serviceItems.length,
      });
    default:
      return notFound();
  }
}

export function handleGoogleMock(req: MockRequest): MockResponse {
  const path = req.path.replace(/^\/+|\/+$/g, "");
  const method = req.method.toUpperCase();
  const origin = req.origin.replace(/\/+$/, "");

  if (path === "oauth2/token") return token(method, req.body);
  if (path.startsWith("_control/")) return control(path.slice(9));

  if (!req.bearer) {
    return googleError(
      401,
      "UNAUTHENTICATED",
      "Request is missing required authentication credential.",
    );
  }
  if (state.revoked) {
    return googleError(
      401,
      "UNAUTHENTICATED",
      "Request had invalid authentication credentials. Expected OAuth 2 access token.",
    );
  }

  let m: RegExpMatchArray | null;

  if (path === "accountmanagement/v1/accounts") {
    if (method !== "GET") return notFound();
    return ok({
      accounts: [
        { name: MOCK_ACCOUNT, accountName: "Glow Salon", type: "PERSONAL" },
      ],
    });
  }

  if ((m = path.match(/^businessinformation\/v1\/(accounts\/[^/]+)\/locations$/))) {
    if (method !== "GET") return notFound();
    return ok({ locations: m[1] === MOCK_ACCOUNT ? [locationDoc()] : [] });
  }

  if ((m = path.match(/^businessinformation\/v1\/(locations\/[^/:]+)$/))) {
    if (m[1] !== MOCK_LOCATION) return notFound();
    if (method === "GET") return ok(locationDoc());
    if (method === "PATCH") {
      const items =
        req.body && typeof req.body === "object"
          ? (req.body as { serviceItems?: unknown }).serviceItems
          : undefined;
      if (Array.isArray(items)) state.serviceItems = items;
      return ok(locationDoc());
    }
    return notFound();
  }

  if ((m = path.match(/^v4\/(accounts\/[^/]+\/locations\/[^/]+)\/localPosts$/))) {
    if (m[1] !== PARENT) return notFound();
    if (method === "GET") {
      const newestFirst = [...state.posts].sort((a, b) =>
        b.createTime.localeCompare(a.createTime),
      );
      return ok({ localPosts: newestFirst.map((p) => postDoc(p, origin)) });
    }
    if (method === "POST") {
      const body = (req.body ?? {}) as {
        summary?: unknown;
        languageCode?: unknown;
        topicType?: unknown;
        callToAction?: unknown;
        media?: { sourceUrl?: unknown }[];
      };
      if (typeof body.summary !== "string" || !body.summary.trim()) {
        return googleError(400, "INVALID_ARGUMENT", "summary is required.");
      }
      const now = new Date().toISOString();
      const post: MockPost = {
        name: `${PARENT}/localPosts/p${state.posts.length + 1}`,
        languageCode:
          typeof body.languageCode === "string" ? body.languageCode : "en",
        summary: body.summary,
        topicType:
          typeof body.topicType === "string" ? body.topicType : "STANDARD",
        state: "LIVE",
        createTime: now,
        updateTime: now,
        callToAction: body.callToAction,
        media: Array.isArray(body.media)
          ? body.media
              .filter((x) => typeof x?.sourceUrl === "string")
              .map((x) => ({
                mediaFormat: "PHOTO" as const,
                googleUrl: String(x.sourceUrl),
              }))
          : undefined,
      };
      state.posts.push(post);
      return ok(postDoc(post, origin));
    }
    return notFound();
  }

  if ((m = path.match(/^v4\/(accounts\/[^/]+\/locations\/[^/]+)\/media$/))) {
    if (m[1] !== PARENT) return notFound();
    if (method === "GET") {
      return ok({ mediaItems: state.media.map((x) => mediaDoc(x, origin)) });
    }
    if (method === "POST") {
      const body = (req.body ?? {}) as {
        mediaFormat?: unknown;
        sourceUrl?: unknown;
        description?: unknown;
        locationAssociation?: { category?: unknown };
      };
      if (typeof body.sourceUrl !== "string") {
        return googleError(400, "INVALID_ARGUMENT", "sourceUrl is required.");
      }
      const item: MockMedia = {
        name: `${PARENT}/media/m${state.media.length + 1}`,
        mediaFormat: body.mediaFormat === "VIDEO" ? "VIDEO" : "PHOTO",
        googleUrl: body.sourceUrl,
        description:
          typeof body.description === "string" ? body.description : undefined,
        createTime: new Date().toISOString(),
        locationAssociation: {
          category:
            typeof body.locationAssociation?.category === "string"
              ? body.locationAssociation.category
              : "ADDITIONAL",
        },
      };
      state.media.push(item);
      return ok(mediaDoc(item, origin));
    }
    return notFound();
  }

  if ((m = path.match(/^v4\/(accounts\/[^/]+\/locations\/[^/]+)\/reviews$/))) {
    if (m[1] !== PARENT || method !== "GET") return notFound();
    const reviews = [...state.reviews].sort((a, b) =>
      b.createTime.localeCompare(a.createTime),
    );
    const average =
      reviews.reduce((t, r) => t + STAR_VALUE[r.starRating], 0) /
      Math.max(reviews.length, 1);
    return ok({
      reviews,
      averageRating: Math.round(average * 10) / 10,
      totalReviewCount: reviews.length,
    });
  }

  if (
    (m = path.match(
      /^v4\/(accounts\/[^/]+\/locations\/[^/]+)\/reviews\/([^/]+)\/reply$/,
    ))
  ) {
    if (m[1] !== PARENT) return notFound();
    const target = state.reviews.find((r) => r.reviewId === m![2]);
    if (!target) return notFound();
    if (method === "PUT") {
      const comment = field(req.body, "comment");
      if (!comment) {
        return googleError(400, "INVALID_ARGUMENT", "comment is required.");
      }
      target.reviewReply = {
        comment: comment.slice(0, 4096),
        updateTime: new Date().toISOString(),
      };
      target.updateTime = target.reviewReply.updateTime;
      return ok(target.reviewReply);
    }
    if (method === "DELETE") {
      target.reviewReply = undefined;
      return ok({});
    }
    return notFound();
  }

  if (
    (m = path.match(
      /^performance\/v1\/(locations\/[^/:]+):fetchMultiDailyMetricsTimeSeries$/,
    ))
  ) {
    if (m[1] !== MOCK_LOCATION || method !== "GET") return notFound();
    return performance(req.query);
  }

  return notFound();
}
