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

    // Step 5 — branding
    logoUrl: v.optional(v.string()),
    logoBackground: v.optional(v.string()), // "black" | "white"

    // Onboarding progress: which of the 5 steps is complete
    onboardingStep: v.number(),
    onboardingComplete: v.boolean(),
    agentActive: v.boolean(),
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
    rank: v.optional(v.number()),
    previousRank: v.optional(v.number()),
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
    replyStatus: v.string(), // "none" | "drafted" | "published"
    repliedAt: v.optional(v.number()),
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
});
