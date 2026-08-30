import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";

/**
 * Google Business Profile connection.
 *
 * The scope we ask for is business.manage — "see, edit, create and delete
 * your Google business listings". That single scope covers reading the
 * listing, publishing posts, and replying to reviews.
 */

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ACCOUNTS_URL =
  "https://mybusinessaccountmanagement.googleapis.com/v1/accounts";
const INFO_BASE = "https://mybusinessbusinessinformation.googleapis.com/v1";

const LOCATION_READ_MASK = [
  "name",
  "title",
  "storefrontAddress",
  "phoneNumbers",
  "websiteUri",
  "categories",
  "latlng",
  "regularHours",
  "metadata",
].join(",");

export type GoogleLocation = {
  name: string;
  title: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  phone?: string;
  website?: string;
  category?: string;
  lat?: number;
  lng?: number;
  reviewUri?: string;
  mapsUri?: string;
  accountName: string;
};

/* ---------------------------- token storage ----------------------------- */

export const saveAccount = internalMutation({
  args: {
    userId: v.id("users"),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.number(),
    scope: v.string(),
    googleEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("googleAccounts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();

    if (existing) {
      // Google only returns a refresh token on first consent; keep the old one.
      await ctx.db.patch(existing._id, {
        ...args,
        refreshToken: args.refreshToken ?? existing.refreshToken,
      });
      return existing._id;
    }
    return await ctx.db.insert("googleAccounts", args);
  },
});

export const accountForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) =>
    await ctx.db
      .query("googleAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first(),
});

export const patchAccessToken = internalMutation({
  args: {
    accountId: v.id("googleAccounts"),
    accessToken: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, { accountId, accessToken, expiresAt }) => {
    await ctx.db.patch(accountId, { accessToken, expiresAt });
  },
});

/* ------------------------------ oauth code ------------------------------ */

export const exchangeCode = action({
  args: {
    code: v.string(),
    codeVerifier: v.string(),
    redirectUri: v.string(),
  },
  handler: async (ctx, { code, codeVerifier, redirectUri }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("Google credentials are not configured.");
    }

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: codeVerifier,
      }),
    });

    const payload = await res.json();
    if (!res.ok) {
      console.error("[google] token exchange failed", payload);
      throw new Error(
        `Google rejected the sign-in: ${payload.error_description ?? payload.error ?? res.status}`,
      );
    }

    await ctx.runMutation(internal.google.saveAccount, {
      userId,
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
      scope: payload.scope ?? "",
    });

    return { ok: true };
  },
});

/* ---------------------------- access token ------------------------------ */

async function freshAccessToken(
  ctx: { runQuery: any; runMutation: any },
  userId: Id<"users">,
): Promise<string> {
  const account = await ctx.runQuery(internal.google.accountForUser, { userId });
  if (!account) throw new Error("Google account is not connected.");

  // 60s of headroom so a call can't expire mid-flight.
  if (account.expiresAt > Date.now() + 60_000) return account.accessToken;

  if (!account.refreshToken) {
    throw new Error("Google access expired. Reconnect your profile.");
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: account.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const payload = await res.json();
  if (!res.ok) {
    console.error("[google] refresh failed", payload);
    throw new Error("Could not refresh Google access. Reconnect your profile.");
  }

  await ctx.runMutation(internal.google.patchAccessToken, {
    accountId: account._id,
    accessToken: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  });

  return payload.access_token as string;
}

async function googleGet(url: string, token: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[google] GET ${url} -> ${res.status} ${text.slice(0, 400)}`);
    throw new Error(`Google API ${res.status}: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text || "{}");
}

/* ---------------------------- read listings ----------------------------- */

export const listLocations = action({
  args: {},
  handler: async (ctx): Promise<GoogleLocation[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const token = await freshAccessToken(ctx, userId);

    const accounts = await googleGet(ACCOUNTS_URL, token);
    const accountList: { name: string }[] = accounts.accounts ?? [];
    if (accountList.length === 0) return [];

    const out: GoogleLocation[] = [];

    for (const account of accountList) {
      const url =
        `${INFO_BASE}/${account.name}/locations` +
        `?readMask=${encodeURIComponent(LOCATION_READ_MASK)}&pageSize=100`;
      const page = await googleGet(url, token);

      for (const loc of page.locations ?? []) {
        const addr = loc.storefrontAddress;
        out.push({
          name: loc.name,
          title: loc.title ?? "Untitled listing",
          address: addr
            ? [...(addr.addressLines ?? []), addr.locality, addr.administrativeArea]
                .filter(Boolean)
                .join(", ")
            : undefined,
          city: addr?.locality,
          state: addr?.administrativeArea,
          pinCode: addr?.postalCode,
          phone: loc.phoneNumbers?.primaryPhone,
          website: loc.websiteUri,
          category: loc.categories?.primaryCategory?.displayName,
          lat: loc.latlng?.latitude,
          lng: loc.latlng?.longitude,
          reviewUri: loc.metadata?.newReviewUri,
          mapsUri: loc.metadata?.mapsUri,
          accountName: account.name,
        });
      }
    }

    return out;
  },
});

/* ------------------------------ link one -------------------------------- */

export const createBusinessFromLocation = internalMutation({
  args: {
    userId: v.id("users"),
    location: v.object({
      name: v.string(),
      title: v.string(),
      address: v.optional(v.string()),
      city: v.optional(v.string()),
      state: v.optional(v.string()),
      pinCode: v.optional(v.string()),
      phone: v.optional(v.string()),
      website: v.optional(v.string()),
      category: v.optional(v.string()),
      lat: v.optional(v.number()),
      lng: v.optional(v.number()),
      reviewUri: v.optional(v.string()),
      mapsUri: v.optional(v.string()),
      accountName: v.string(),
    }),
  },
  handler: async (ctx, { userId, location }) => {
    const existing = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    const fields = {
      userId,
      orgName: location.title,
      locationName: location.city
        ? `${location.title}, ${location.city}`
        : location.title,
      streetAddress: location.address,
      city: location.city,
      state: location.state,
      pinCode: location.pinCode,
      phone: location.phone,
      website: location.website,
      lat: location.lat,
      lng: location.lng,
      gbpAccountName: location.accountName,
      gbpLocationName: location.name,
      primaryCategory: location.category,
      reviewUri: location.reviewUri,
      mapsUri: location.mapsUri,
      onboardingStep: 2,
      onboardingComplete: false,
      agentActive: false,
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
      return existing._id;
    }
    const businessId = await ctx.db.insert("businesses", fields);

    await ctx.db.insert("agentActions", {
      businessId,
      type: "seo",
      title: "Google Business Profile connected",
      detail: location.title,
      createdAt: Date.now(),
    });

    return businessId;
  },
});

export const linkLocation = action({
  args: {
    location: v.object({
      name: v.string(),
      title: v.string(),
      address: v.optional(v.string()),
      city: v.optional(v.string()),
      state: v.optional(v.string()),
      pinCode: v.optional(v.string()),
      phone: v.optional(v.string()),
      website: v.optional(v.string()),
      category: v.optional(v.string()),
      lat: v.optional(v.number()),
      lng: v.optional(v.number()),
      reviewUri: v.optional(v.string()),
      mapsUri: v.optional(v.string()),
      accountName: v.string(),
    }),
  },
  handler: async (ctx, { location }): Promise<{ businessId: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const businessId: Id<"businesses"> = await ctx.runMutation(
      internal.google.createBusinessFromLocation,
      { userId, location },
    );

    return { businessId };
  },
});

/* ------------------------- https callback plumbing -----------------------
   Google would not return an authorisation code to http://localhost. The
   consent redirect now lands on this deployment's HTTPS endpoint instead,
   the same origin Convex Auth's own Google login uses successfully.        */

export const startLink = mutation({
  args: { returnTo: v.string(), codeVerifier: v.string() },
  handler: async (ctx, { returnTo, codeVerifier }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const token = crypto.randomUUID().replace(/-/g, "");
    await ctx.db.insert("googleLinkTokens", {
      userId,
      token,
      codeVerifier,
      returnTo,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    return token;
  },
});

export const consumeLinkToken = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const row = await ctx.db
      .query("googleLinkTokens")
      .withIndex("by_token", (q) => q.eq("token", token))
      .first();
    if (!row) return null;
    if (row.usedAt || row.expiresAt < Date.now()) return null;

    await ctx.db.patch(row._id, { usedAt: Date.now() });
    return {
      userId: row.userId,
      codeVerifier: row.codeVerifier,
      returnTo: row.returnTo,
    };
  },
});

/** Exchanges the code on behalf of the user the link token identifies. */
export const completeLink = internalAction({
  args: { code: v.string(), state: v.string(), redirectUri: v.string() },
  handler: async (
    ctx,
    { code, state, redirectUri },
  ): Promise<{
    ok: boolean;
    returnTo: string | null;
    error: string | null;
  }> => {
    const link = await ctx.runMutation(internal.google.consumeLinkToken, {
      token: state,
    });
    if (!link) {
      return { ok: false, returnTo: null, error: "That link expired. Try again." };
    }

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: link.codeVerifier,
      }),
    });

    const payload = await res.json();
    if (!res.ok) {
      console.error("[google] token exchange failed", payload);
      return {
        ok: false,
        returnTo: link.returnTo,
        error: payload.error_description ?? payload.error ?? "Token exchange failed",
      };
    }

    await ctx.runMutation(internal.google.saveAccount, {
      userId: link.userId,
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
      scope: payload.scope ?? "",
    });

    return { ok: true, returnTo: link.returnTo, error: null };
  },
});

/**
 * Re-reads the linked listing from Google and updates the stored copy.
 * Used to backfill fields added after a business was first connected.
 */
export const refreshLocation = action({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean; title?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const business = await ctx.runQuery(internal.google.businessForUser, {
      userId,
    });
    if (!business?.gbpLocationName) {
      throw new Error("No Google listing is linked.");
    }

    const token = await freshAccessToken(ctx, userId);
    const url =
      `${INFO_BASE}/${business.gbpLocationName}` +
      `?readMask=${encodeURIComponent(LOCATION_READ_MASK)}`;
    const loc = await googleGet(url, token);

    const addr = loc.storefrontAddress;
    await ctx.runMutation(internal.google.createBusinessFromLocation, {
      userId,
      location: {
        name: loc.name,
        title: loc.title ?? business.orgName,
        address: addr
          ? [...(addr.addressLines ?? []), addr.locality, addr.administrativeArea]
              .filter(Boolean)
              .join(", ")
          : undefined,
        city: addr?.locality,
        state: addr?.administrativeArea,
        pinCode: addr?.postalCode,
        phone: loc.phoneNumbers?.primaryPhone,
        website: loc.websiteUri,
        category: loc.categories?.primaryCategory?.displayName,
        lat: loc.latlng?.latitude,
        lng: loc.latlng?.longitude,
        reviewUri: loc.metadata?.newReviewUri,
        mapsUri: loc.metadata?.mapsUri,
        accountName: business.gbpAccountName ?? "",
      },
    });

    return { ok: true, title: loc.title };
  },
});

export const businessForUser = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) =>
    await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first(),
});

/** A valid access token for this user, refreshing it first if needed. */
export const accessTokenFor = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<string> =>
    await freshAccessToken(ctx, userId),
});

/* ---------------------------- coordinates -------------------------------
   Google leaves latlng off plenty of listings — clinics and service-area
   businesses especially. Without it there is no rank check, no geo-grid and
   no nearby areas, so we geocode the address once and keep it.            */

export const patchCoordinates = internalMutation({
  args: { businessId: v.id("businesses"), lat: v.number(), lng: v.number() },
  handler: async (ctx, { businessId, lat, lng }) => {
    await ctx.db.patch(businessId, { lat, lng });
  },
});

export const ensureCoordinates = internalAction({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    { userId },
  ): Promise<{ lat: number; lng: number } | null> => {
    const business = await ctx.runQuery(internal.google.businessForUser, {
      userId,
    });
    if (!business) return null;
    if (business.lat !== undefined && business.lng !== undefined) {
      return { lat: business.lat, lng: business.lng };
    }

    // A full Indian shop address rarely geocodes as written — "4/127, Bagh
    // Farzana Rd, Bank Colony, Civil Lines, Agra" finds nothing, while
    // "Civil Lines, Agra" finds the locality. So we drop segments off the
    // front until something matches, then fall back to the pin code and city.
    const segments = (business.streetAddress ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const attempts: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      attempts.push(segments.slice(i).join(", "));
    }
    if (business.pinCode) {
      attempts.push(
        [business.pinCode, business.city, business.state, "India"]
          .filter(Boolean)
          .join(", "),
      );
    }
    attempts.push(
      [business.city, business.state, "India"].filter(Boolean).join(", "),
    );

    const tried = new Set<string>();

    for (const query of attempts) {
      if (!query || query.length < 4 || tried.has(query)) continue;
      tried.add(query);
      try {
        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.searchParams.set("q", query);
        url.searchParams.set("format", "json");
        url.searchParams.set("limit", "1");
        url.searchParams.set("countrycodes", "in");

        const res = await fetch(url.toString(), {
          headers: {
            "User-Agent": "footfall/1.0 (local business listing tool)",
            Accept: "application/json",
          },
        });
        if (!res.ok) continue;

        const rows = await res.json();
        const hit = Array.isArray(rows) ? rows[0] : null;
        if (!hit?.lat || !hit?.lon) continue;

        const lat = Number(hit.lat);
        const lng = Number(hit.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

        await ctx.runMutation(internal.google.patchCoordinates, {
          businessId: business._id,
          lat,
          lng,
        });
        console.log(`[geocode] "${query}" -> ${lat},${lng}`);
        return { lat, lng };
      } catch (error) {
        console.log(`[geocode] failed for "${query}"`, error);
      }
    }

    return null;
  },
});
