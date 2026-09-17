import { ConvexError, v } from "convex/values";
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
import { activeBusinessFor,
  ownedRow,
  ownedRowFor,
  paidAction,
  paidMutation,
  type Owned,
} from "./access";
import { v4Base } from "./googleHosts";

/**
 * Photos on the Google Business Profile.
 *
 * Two directions: read what's already on the listing so the owner sees it
 * in one place, and push up new ones they add. Fresh photos are one of the
 * few signals a shop can produce endlessly without writing anything.
 *
 * Media lives on the legacy v4 endpoint, like posts.
 */

/**
 * Google serves its photos at whatever size the suffix asks for. The API
 * hands back "=s0", which means the original — often two megabytes. Six of
 * those on one screen reads to the owner as "the images are broken".
 */
function sized(url: string, width: number): string {
  const base = url.replace(/=[sw]\d+(-[a-z0-9-]+)?$/i, "").replace(/=s0$/i, "");
  return `${base}=w${width}`;
}

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
    /** True when `items` is the complete Google gallery, which makes it
        safe to drop mirrored rows Google no longer lists. */
    removeMissing: v.optional(v.boolean()),
  },
  handler: async (ctx, { businessId, items, removeMissing = false }) => {
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

    // A photo the owner deleted on Google used to linger here forever —
    // the sync only ever added. Mirrored rows (no storageId: we did not
    // upload them) that Google stopped listing go away with it.
    if (removeMissing) {
      const incoming = new Set(items.map((i) => i.url));
      for (const row of existing) {
        if (row.storageId) continue; // our own upload, not a mirror
        if (row.status !== "published") continue; // still in our queue
        if (!row.url || incoming.has(row.url)) continue;
        await ctx.db.delete(row._id);
      }
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
    if (!business) throw new ConvexError("Connect your Google profile first.");

    const parent = parentFor(business);
    if (!parent) throw new ConvexError("No Google listing linked.");

    const token: string = await ctx.runAction(internal.google.accessTokenFor, {
      userId,
    });

    const res = await fetch(`${v4Base()}/${parent}/media?pageSize=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[gbp/media] ${res.status} ${text.slice(0, 400)}`);
      throw new ConvexError("Google refused that request. Try again, or reconnect your profile from Settings.");
    }

    type MediaItem = {
      googleUrl?: string;
      thumbnailUrl?: string;
      description?: string;
      locationAssociation?: { category?: string };
    };
    const data = JSON.parse(text || "{}");
    const media: MediaItem[] = data.mediaItems ?? [];
    // The list comes newest-first, which makes the shop's latest upload
    // the site's hero by accident. The owner's chosen COVER (then
    // PROFILE) photo leads instead; everything else keeps API order.
    const rank = (m: MediaItem) => {
      const c = m.locationAssociation?.category ?? "";
      return c === "COVER" ? 0 : c === "PROFILE" ? 1 : 2;
    };
    const items = media
      .filter((m) => m?.googleUrl || m?.thumbnailUrl)
      // Google's media list carries the owner's account picture alongside
      // the shop's photos. Its URL sits under /a-/ or /a/, and a headshot
      // on a post about root canals helps nobody.
      .filter((m) => {
        const url = String(m.googleUrl ?? m.thumbnailUrl);
        return !/googleusercontent\.com\/a[-/]/.test(url);
      })
      .sort((a, b) => rank(a) - rank(b))
      .map((m) => ({
        url: sized(String(m.googleUrl ?? m.thumbnailUrl), 1600),
        caption: m.description ? String(m.description) : undefined,
      }));

    const added: number = await ctx.runMutation(
      internal.photos.saveGooglePhotos,
      {
        businessId: business._id,
        items,
        // Only reconcile deletions when this page held the whole gallery —
        // otherwise photos beyond the first page would look "gone".
        removeMissing: !data.nextPageToken,
      },
    );

    return { added, total: items.length };
  },
});

/**
 * Mirrors every connected shop's gallery overnight.
 *
 * Until this existed, photos only came down from Google when somebody
 * opened /app/photos or refreshed the free report — neither of which an
 * owner does often. A photo deleted on Google stayed on the shop's public
 * site until one of those happened, which in practice could be never: a
 * cafe was showing a photo of a dental surgery.
 *
 * That is what makes it worth a nightly job rather than leaving it to the
 * UI. The owner cannot see the problem — their Google gallery looks
 * correct — so they have no reason to go and fix it.
 *
 * Reviews sync every four hours because a reply is time-sensitive. A
 * gallery only has to be right by morning.
 */
export const syncAllPhotos = internalAction({
  args: {},
  handler: async (ctx): Promise<{ businesses: number; added: number }> => {
    const businesses: { userId: Id<"users">; name: string }[] =
      await ctx.runQuery(internal.performance.connectedBusinesses, {});

    let added = 0;
    for (const b of businesses) {
      try {
        const r = await ctx.runAction(internal.photos.syncForUser, {
          userId: b.userId,
        });
        added += r.added;
      } catch (error) {
        // One shop's expired token must not stop the rest of the run.
        console.error(`[agent] photo sync failed for ${b.name}`, error);
      }
    }
    return { businesses: businesses.length, added };
  },
});

/* ------------------------------- upload up ------------------------------ */

export const generateUploadUrl = paidMutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in first.");
    return await ctx.storage.generateUploadUrl();
  },
});

export const savePhoto = paidMutation({
  args: {
    storageId: v.id("_storage"),
    caption: v.optional(v.string()),
    mediaType: v.optional(v.string()),
  },
  handler: async (ctx, { storageId, caption, mediaType }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in first.");

    const business = await activeBusinessFor(ctx, userId);
    if (!business) throw new ConvexError("Connect your Google profile first.");

    // A storage id can't be ownership-checked after the fact. That's fine:
    // generateUploadUrl only ever hands a URL to its own caller, so the
    // worst a stranger's id can do here is attach their own upload to
    // this business.
    const url = await ctx.storage.getUrl(storageId);
    return await ctx.db.insert("photos", {
      businessId: business._id,
      mediaType: mediaType === "video" ? "video" : "photo",
      storageId,
      url: url ?? undefined,
      caption,
      status: "bucket",
    });
  },
});

export const removePhoto = paidMutation({
  args: { id: v.id("photos") },
  handler: async (ctx, { id }) => {
    const { row } = await ownedRow(ctx, id);
    if (row.status === "published") {
      throw new ConvexError("This one is already on Google. Remove it there.");
    }
    await ctx.db.delete(row._id);
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

/** A photo, only if it belongs to this user's business. */
export const ownedPhoto = internalQuery({
  args: { userId: v.id("users"), id: v.id("photos") },
  handler: async (ctx, { userId, id }) => await ownedRowFor(ctx, userId, id),
});

export const pushPhoto = internalAction({
  args: { photoId: v.id("photos"), userId: v.id("users") },
  handler: async (
    ctx,
    { photoId, userId },
  ): Promise<{ ok: boolean; error?: string }> => {
    // Ownership is settled here, right before the Google call, for the
    // owner's button and the daily drip alike.
    const { row: photo, business }: Owned<"photos"> = await ctx.runQuery(
      internal.photos.ownedPhoto,
      { userId, id: photoId },
    );
    if (!photo.url) return { ok: false, error: "That photo is gone." };

    const parent = parentFor(business);
    if (!parent) return { ok: false, error: "No Google listing linked." };

    const token: string = await ctx.runAction(internal.google.accessTokenFor, {
      userId,
    });

    const res = await fetch(`${v4Base()}/${parent}/media`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mediaFormat: photo.mediaType === "video" ? "VIDEO" : "PHOTO",
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

export const publishPhoto = paidAction({
  args: { id: v.id("photos") },
  handler: async (ctx, { id }): Promise<{ ok: boolean; error?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in first.");
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
    const business = await activeBusinessFor(ctx, userId);
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
/*
 * Mon, Wed, Fri and Sat.
 *
 * Four a week is where the guidance lands: enough that Google keeps reading
 * the profile as active, slow enough that a shop's library of thirty photos
 * lasts the two months over which recency actually counts. A daily drip
 * burned through the same library in half the time, and bursts are worse
 * still — Google can stop accepting uploads from a profile for a fortnight
 * when a batch looks like spam.
 */
const PHOTO_DAYS = [1, 3, 5, 6];

export const publishDaily = internalAction({
  args: {},
  handler: async (ctx): Promise<{ published: number }> => {
    // The run is 17:00 IST, so the UTC day and the shop's day agree.
    if (!PHOTO_DAYS.includes(new Date().getUTCDay())) {
      return { published: 0 };
    }

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

export const syncFromGoogle = paidAction({
  args: {},
  handler: async (ctx): Promise<{ added: number; total: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in first.");
    return await ctx.runAction(internal.photos.syncForUser, { userId });
  },
});
