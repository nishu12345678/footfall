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
 * Photos on the Google Business Profile.
 *
 * Two directions: read what's already on the listing so the owner sees it
 * in one place, and push up new ones they add. Fresh photos are one of the
 * few signals a shop can produce endlessly without writing anything.
 *
 * Media lives on the legacy v4 endpoint, like posts.
 */

const V4_BASE = "https://mybusiness.googleapis.com/v4";

function parentFor(business: {
  gbpAccountName?: string;
  gbpLocationName?: string;
}) {
  if (!business.gbpAccountName || !business.gbpLocationName) return null;
  const locationId = business.gbpLocationName.replace(/^locations\//, "");
  return `${business.gbpAccountName}/locations/${locationId}`;
}

/* --------------------------------- read --------------------------------- */

export const photosFor = internalQuery({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, { businessId }) =>
    await ctx.db
      .query("photos")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect(),
});

/* ------------------------------ sync down ------------------------------- */

export const saveGooglePhotos = internalMutation({
  args: {
    businessId: v.id("businesses"),
    items: v.array(
      v.object({
        url: v.string(),
        caption: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { businessId, items }) => {
    const existing = await ctx.db
      .query("photos")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
    const have = new Set(existing.map((p) => p.url).filter(Boolean));

    let added = 0;
    for (const item of items) {
      if (have.has(item.url)) continue;
      await ctx.db.insert("photos", {
        businessId,
        url: item.url,
        caption: item.caption,
        status: "published",
        publishedAt: Date.now(),
      });
      added += 1;
    }
    return added;
  },
});

export const syncForUser = internalAction({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    { userId },
  ): Promise<{ added: number; total: number }> => {
    const business = await ctx.runQuery(internal.google.businessForUser, {
      userId,
    });
    if (!business) throw new Error("Connect your Google profile first.");

    const parent = parentFor(business);
    if (!parent) throw new Error("No Google listing linked.");

    const token: string = await ctx.runAction(internal.google.accessTokenFor, {
      userId,
    });

    const res = await fetch(`${V4_BASE}/${parent}/media?pageSize=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[gbp/media] ${res.status} ${text.slice(0, 400)}`);
      throw new Error(`Google refused (${res.status}): ${text.slice(0, 200)}`);
    }

    const data = JSON.parse(text || "{}");
    const items = (data.mediaItems ?? [])
      .filter((m: any) => m?.googleUrl || m?.thumbnailUrl)
      .map((m: any) => ({
        url: String(m.googleUrl ?? m.thumbnailUrl),
        caption: m.description ? String(m.description) : undefined,
      }));

    const added: number = await ctx.runMutation(
      internal.photos.saveGooglePhotos,
      { businessId: business._id, items },
    );

    return { added, total: items.length };
  },
});

/* ------------------------------- upload up ------------------------------ */

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    return await ctx.storage.generateUploadUrl();
  },
});

export const savePhoto = mutation({
  args: { storageId: v.id("_storage"), caption: v.optional(v.string()) },
  handler: async (ctx, { storageId, caption }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business) throw new Error("Connect your Google profile first.");

    const url = await ctx.storage.getUrl(storageId);
    return await ctx.db.insert("photos", {
      businessId: business._id,
      storageId,
      url: url ?? undefined,
      caption,
      status: "bucket",
    });
  },
});

export const removePhoto = mutation({
  args: { id: v.id("photos") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    const row = await ctx.db.get(id);
    if (row?.status === "published") {
      throw new Error("This one is already on Google. Remove it there.");
    }
    if (row) await ctx.db.delete(id);
  },
});

export const markPhotoPublished = internalMutation({
  args: { id: v.id("photos"), error: v.optional(v.string()) },
  handler: async (ctx, { id, error }) => {
    const photo = await ctx.db.get(id);
    if (!photo) return;

    if (error) {
      await ctx.db.patch(id, { status: "failed", caption: photo.caption });
      return;
    }

    await ctx.db.patch(id, { status: "published", publishedAt: Date.now() });
    await ctx.db.insert("agentActions", {
      businessId: photo.businessId,
      type: "media",
      title: "Photo published",
      detail: photo.caption,
      imageUrl: photo.url,
      createdAt: Date.now(),
    });
  },
});

export const photoById = internalQuery({
  args: { id: v.id("photos") },
  handler: async (ctx, { id }) => await ctx.db.get(id),
});

export const pushPhoto = internalAction({
  args: { photoId: v.id("photos"), userId: v.id("users") },
  handler: async (
    ctx,
    { photoId, userId },
  ): Promise<{ ok: boolean; error?: string }> => {
    const photo = await ctx.runQuery(internal.photos.photoById, { id: photoId });
    if (!photo?.url) return { ok: false, error: "That photo is gone." };

    const business = await ctx.runQuery(internal.google.businessForUser, {
      userId,
    });
    const parent = business ? parentFor(business) : null;
    if (!parent) return { ok: false, error: "No Google listing linked." };

    const token: string = await ctx.runAction(internal.google.accessTokenFor, {
      userId,
    });

    const res = await fetch(`${V4_BASE}/${parent}/media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mediaFormat: "PHOTO",
        locationAssociation: { category: "ADDITIONAL" },
        sourceUrl: photo.url,
        ...(photo.caption ? { description: photo.caption } : {}),
      }),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`[gbp/media] POST ${res.status} ${text.slice(0, 400)}`);
      const message = `Google refused (${res.status}): ${text.slice(0, 200)}`;
      await ctx.runMutation(internal.photos.markPhotoPublished, {
        id: photoId,
        error: message,
      });
      return { ok: false, error: message };
    }

    await ctx.runMutation(internal.photos.markPhotoPublished, { id: photoId });
    return { ok: true };
  },
});

export const publishPhoto = action({
  args: { id: v.id("photos") },
  handler: async (
    ctx,
    { id },
  ): Promise<{ ok: boolean; error?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    return await ctx.runAction(internal.photos.pushPhoto, {
      photoId: id,
      userId,
    });
  },
});

/* ------------------------------- the agent ------------------------------ */

export const nextQueued = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business || !business.agentActive) return null;

    const queued = await ctx.db
      .query("photos")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    return queued.find((p) => p.status === "bucket") ?? null;
  },
});

/**
 * Drips one waiting photo onto the listing a day.
 *
 * Uploading thirty photos at once looks like a one-off. One a day looks
 * like a shop someone is running, which is the point.
 */
export const publishDaily = internalAction({
  args: {},
  handler: async (ctx): Promise<{ published: number }> => {
    const businesses: { userId: Id<"users">; name: string }[] =
      await ctx.runQuery(internal.performance.connectedBusinesses, {});

    let published = 0;
    for (const b of businesses) {
      try {
        const next = await ctx.runQuery(internal.photos.nextQueued, {
          userId: b.userId,
        });
        if (!next) continue;
        const r = await ctx.runAction(internal.photos.pushPhoto, {
          photoId: next._id,
          userId: b.userId,
        });
        if (r.ok) published += 1;
      } catch (error) {
        console.error(`[agent] photo failed for ${b.name}`, error);
      }
    }
    return { published };
  },
});

export const syncFromGoogle = action({
  args: {},
  handler: async (ctx): Promise<{ added: number; total: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    return await ctx.runAction(internal.photos.syncForUser, { userId });
  },
});
