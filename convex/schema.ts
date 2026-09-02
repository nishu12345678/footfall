import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

/**
 * footfall data model.
 *
 * Shaped from the product flow: phone login -> connect Google Business
 * Profile -> 5-step onboarding -> home dashboard -> performance.
 */
export default defineSchema({
  /* ----------------------------- identity -----------------------------
     Convex Auth owns users, authAccounts, authSessions and the rest.
     Sign-in is mobile number + OTP; see convex/auth.ts. */

  ...authTables,

  /* ----------------------------- business ----------------------------- */

  businesses: defineTable({
    userId: v.id("users"),

    // Step 2 — Location Information
    orgName: v.string(),
    locationName: v.optional(v.string()),
    streetAddress: v.optional(v.string()),
    city: v.optional(v.string()),
    state: v.optional(v.string()),
    pinCode: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    website: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),

    // Google Business Profile linkage
    gbpAccountName: v.optional(v.string()), // "accounts/123"
    gbpLocationName: v.optional(v.string()), // "locations/456"
    primaryCategory: v.optional(v.string()),
    /** Google's own id for the category, e.g. "gcid:dental_clinic". The
        services we push have to hang off one of these. */
    primaryCategoryId: v.optional(v.string()),
    additionalCategories: v.optional(
      v.array(v.object({ id: v.string(), name: v.string() })),
    ),
    servicesPushedAt: v.optional(v.number()),
    // Google's own "write a review" short link, from location metadata.
    reviewUri: v.optional(v.string()),
    mapsUri: v.optional(v.string()),

    // How far out this business realistically pulls customers from. Every
    // "near me" rank check is measured across this radius, not at the door.
    serviceRadiusKm: v.optional(v.number()),
    // How far out we measure a "near me" search. A clinic is judged over a
    // few kilometres, a tile showroom over a district.
    scanRadiusKm: v.optional(v.number()),
    radiusReason: v.optional(v.string()),

    // When we last pulled performance data and ran a rank check.
    metricsSyncedAt: v.optional(v.number()),
    ranksCheckedAt: v.optional(v.number()),

    // Step 5 — branding
    logoUrl: v.optional(v.string()),
    logoBackground: v.optional(v.string()), // "black" | "white"

    // Onboarding progress: which of the 5 steps is complete
    onboardingStep: v.number(),
    onboardingComplete: v.boolean(),
    agentActive: v.boolean(),
    // When the agent was first switched on. Everything before this date is
    // the shop as it was; everything after is the shop with us running it.
    agentStartedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_gbp_location", ["gbpLocationName"]),

  /**
   * One-time tokens that carry "who started this link" through Google's
   * redirect, so the HTTPS callback on .convex.site knows which user came
   * back. Short-lived and single-use.
   */
  googleLinkTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    codeVerifier: v.string(),
    returnTo: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  }).index("by_token", ["token"]),

  /** OAuth tokens for the Google account that owns the listing. */
  googleAccounts: defineTable({
    userId: v.id("users"),
    businessId: v.optional(v.id("businesses")),
    googleEmail: v.optional(v.string()),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
    scope: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_business", ["businessId"]),

  /**
   * A free one-page site for shops that don't have one, built entirely from
   * the Google listing. Its job is local SEO: correct NAP, service and area
   * wording people actually search, and LocalBusiness structured data.
   */
  sites: defineTable({
    businessId: v.id("businesses"),
    slug: v.string(),
    headline: v.string(),
    subhead: v.optional(v.string()),
    about: v.string(),
    services: v.array(v.object({ name: v.string(), body: v.string() })),
    faqs: v.array(v.object({ q: v.string(), a: v.string() })),
    metaTitle: v.string(),
    metaDescription: v.string(),
    published: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_slug", ["slug"]),

  /* ------------------------ step 3: about business -------------------- */

  offerings: defineTable({
    businessId: v.id("businesses"),
    label: v.string(),
    source: v.string(), // "user" | "ai"
    selected: v.boolean(),
  }).index("by_business", ["businessId"]),

  specialties: defineTable({
    businessId: v.id("businesses"),
    label: v.string(),
    source: v.string(),
    selected: v.boolean(),
  }).index("by_business", ["businessId"]),

  /* -------------------------- step 4: gbp info ------------------------ */

  serviceAreas: defineTable({
    businessId: v.id("businesses"),
    name: v.string(),
  }).index("by_business", ["businessId"]),

  keywords: defineTable({
    businessId: v.id("businesses"),
    term: v.string(),
    targeted: v.boolean(),
    /** True for "near me" phrasing, which is what people actually type. */
    nearMe: v.optional(v.boolean()),

    // Measured across the service area, not from a single point.
    rank: v.optional(v.number()), // best position found anywhere
    avgRank: v.optional(v.number()), // average where found
    coverageFound: v.optional(v.number()), // points where we appear
    coverageTotal: v.optional(v.number()), // points searched
    previousRank: v.optional(v.number()),
    previousCoverage: v.optional(v.number()),
    checkedAt: v.optional(v.number()),
  }).index("by_business", ["businessId"]),

  businessHours: defineTable({
    businessId: v.id("businesses"),
    day: v.number(), // 0 = Monday
    open: v.optional(v.string()), // "10:00"
    close: v.optional(v.string()), // "20:00"
    closed: v.boolean(),
  }).index("by_business", ["businessId"]),

  attributes: defineTable({
    businessId: v.id("businesses"),
    key: v.string(),
    label: v.string(),
    enabled: v.boolean(),
  }).index("by_business", ["businessId"]),

  /* ------------------------------ content ----------------------------- */

  posts: defineTable({
    businessId: v.id("businesses"),
    title: v.optional(v.string()),
    body: v.string(),
    imageUrl: v.optional(v.string()),
    status: v.string(), // "draft" | "scheduled" | "published" | "failed"
    imageSource: v.optional(v.string()), // "listing" | "made"
    imageNote: v.optional(v.string()),
    scheduledFor: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
    gbpPostName: v.optional(v.string()),
    error: v.optional(v.string()),
    generatedBy: v.string(), // "ai" | "user"
  })
    .index("by_business", ["businessId"])
    .index("by_business_status", ["businessId", "status"]),

  photos: defineTable({
    businessId: v.id("businesses"),
    storageId: v.optional(v.id("_storage")),
    url: v.optional(v.string()),
    caption: v.optional(v.string()),
    mediaType: v.optional(v.string()), // "photo" | "video"
    status: v.string(), // "bucket" | "scheduled" | "published"
    publishedAt: v.optional(v.number()),
  }).index("by_business", ["businessId"]),

  reviews: defineTable({
    businessId: v.id("businesses"),
    gbpReviewName: v.optional(v.string()),
    authorName: v.optional(v.string()),
    authorPhoto: v.optional(v.string()),
    rating: v.number(),
    comment: v.optional(v.string()),
    createdAt: v.number(),
    replyText: v.optional(v.string()),
    replyStatus: v.string(), // "none" | "drafted" | "published" | "failed"
    repliedAt: v.optional(v.number()),
    // A complaint is answered by a person. We write the draft; the owner
    // reads it before anything is published under their name.
    replyNeedsApproval: v.optional(v.boolean()),
    replyDraftedAt: v.optional(v.number()),
    replyError: v.optional(v.string()),
  })
    .index("by_business", ["businessId"])
    .index("by_business_reply", ["businessId", "replyStatus"]),

  /* ------------------------ review collection ------------------------- */

  customers: defineTable({
    businessId: v.id("businesses"),
    phone: v.string(),
    name: v.optional(v.string()),
    reviewLinkSentAt: v.optional(v.number()),
    reviewLeftAt: v.optional(v.number()),
    source: v.string(), // "manual" | "qr" | "import"
  })
    .index("by_business", ["businessId"])
    .index("by_business_phone", ["businessId", "phone"]),

  /* ----------------------------- analytics ---------------------------- */

  /** Daily GBP performance, from the Business Profile Performance API. */
  metrics: defineTable({
    businessId: v.id("businesses"),
    date: v.string(), // "2026-08-29"
    views: v.number(),
    calls: v.number(),
    directions: v.number(),
    websiteClicks: v.optional(v.number()),
  })
    .index("by_business", ["businessId"])
    .index("by_business_date", ["businessId", "date"]),

  competitors: defineTable({
    businessId: v.id("businesses"),
    name: v.string(),
    rating: v.optional(v.number()),
    reviewCount: v.optional(v.number()),
    averageRank: v.optional(v.number()),
    /** The Google category they list under — the top relevance signal. */
    category: v.optional(v.string()),
    checkedAt: v.number(),
  }).index("by_business", ["businessId"]),

  /**
   * One row per pin, per keyword, per run. This is the geo-grid:
   * SerpApi is queried with ll=@lat,lng,zoom for each pin.
   */
  rankGrid: defineTable({
    businessId: v.id("businesses"),
    keyword: v.string(),
    lat: v.number(),
    lng: v.number(),
    rank: v.optional(v.number()), // null/undefined = not in results
    runId: v.string(),
    checkedAt: v.number(),
  })
    .index("by_business", ["businessId"])
    .index("by_run", ["runId"])
    .index("by_business_keyword", ["businessId", "keyword"]),

  /** The "Grexa AI Actions" feed equivalent — what the agent did, and when. */
  agentActions: defineTable({
    businessId: v.id("businesses"),
    type: v.string(), // "post" | "media" | "review_reply" | "seo" | "keywords"
    title: v.string(),
    detail: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_business", ["businessId"]),

  /* ------------------------------- billing ---------------------------------
     One row per purchase, so this table doubles as the receipt ledger.

     Access is "does this user have a paid row whose expiresAt is still in
     the future". There is no separate is_subscribed flag to drift out of
     sync with what was actually paid. */

  subscriptions: defineTable({
    userId: v.id("users"),
    plan: v.string(), // "monthly" | "yearly"
    /** What Razorpay was actually asked for, in paise. Never trusted from
        the browser — the server picks it from its own plan table. */
    amountPaise: v.number(),
    currency: v.string(),
    razorpayOrderId: v.string(),
    razorpayPaymentId: v.optional(v.string()),
    /** "created" until the money is captured, then "paid". Only "paid"
        rows grant access. */
    status: v.string(),
    paidAt: v.optional(v.number()),
    startsAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    /** Which side confirmed it — the browser handing back a signature, or
        Razorpay's webhook. Both can arrive; whichever lands first wins and
        the other is ignored. Worth keeping when reconciling a dispute. */
    confirmedBy: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_order", ["razorpayOrderId"]),

  /* ------------------------------ free report ------------------------------
     What we found when we looked at the shop's website. Cached because it
     costs a Firecrawl call, and a free user can ask for the report as often
     as they like. */

  websiteChecks: defineTable({
    businessId: v.id("businesses"),
    url: v.string(),
    reachable: v.boolean(),
    checkedAt: v.number(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    wordCount: v.optional(v.number()),
    /** Does the page actually say where the shop is and how to ring it?
        A site that names neither is invisible for "near me" searches. */
    namesCity: v.optional(v.boolean()),
    namesPhone: v.optional(v.boolean()),
    error: v.optional(v.string()),
  }).index("by_business", ["businessId"]),
});
