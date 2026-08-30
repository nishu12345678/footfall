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
 * Writing and publishing Google Business Profile posts.
 *
 * Local posts live on the legacy v4 endpoint, not the newer Business
 * Information API — that split is the single most common reason a Business
 * Profile integration fails after OAuth works fine.
 *
 * The same two steps serve the owner pressing a button and the agent doing
 * it unattended: draftBody writes, pushToGoogle publishes.
 */

const V4_BASE = "https://mybusiness.googleapis.com/v4";

/* ------------------------------- context -------------------------------- */

export const postContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business) return null;

    const [offerings, specialties, keywords, areas, recent] = await Promise.all([
      ctx.db
        .query("offerings")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
      ctx.db
        .query("specialties")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
      ctx.db
        .query("keywords")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
      ctx.db
        .query("serviceAreas")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
      ctx.db
        .query("posts")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .order("desc")
        .take(6),
    ]);

    return {
      business,
      offerings: offerings.map((r) => r.label),
      specialties: specialties.map((r) => r.label),
      keywords: keywords.map((r) => r.term),
      areas: areas.map((r) => r.name),
      recent: recent.map((p) => p.body),
    };
  },
});

export const publishedRecently = internalQuery({
  args: { businessId: v.id("businesses"), withinHours: v.number() },
  handler: async (ctx, { businessId, withinHours }) => {
    const rows = await ctx.db
      .query("posts")
      .withIndex("by_business_status", (q) =>
        q.eq("businessId", businessId).eq("status", "published"),
      )
      .collect();
    const cutoff = Date.now() - withinHours * 3600_000;
    return rows.some((r) => (r.publishedAt ?? 0) > cutoff);
  },
});

export const postById = internalQuery({
  args: { id: v.id("posts") },
  handler: async (ctx, { id }) => await ctx.db.get(id),
});

/* -------------------------------- storage ------------------------------- */

export const saveDraft = internalMutation({
  args: {
    businessId: v.id("businesses"),
    body: v.string(),
    title: v.optional(v.string()),
    generatedBy: v.string(),
  },
  handler: async (ctx, args) =>
    await ctx.db.insert("posts", { ...args, status: "draft" }),
});

export const markPublished = internalMutation({
  args: {
    id: v.id("posts"),
    gbpPostName: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { id, gbpPostName, error }) => {
    const post = await ctx.db.get(id);
    if (!post) return;

    if (error) {
      await ctx.db.patch(id, { status: "failed", error });
      return;
    }

    await ctx.db.patch(id, {
      status: "published",
      publishedAt: Date.now(),
      gbpPostName,
      error: undefined,
    });

    await ctx.db.insert("agentActions", {
      businessId: post.businessId,
      type: "post",
      title: "New post published",
      detail: post.body.slice(0, 120),
      createdAt: Date.now(),
    });
  },
});

export const updateDraft = mutation({
  args: { id: v.id("posts"), body: v.string() },
  handler: async (ctx, { id, body }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    const post = await ctx.db.get(id);
    if (!post) throw new Error("That post is gone.");
    if (post.status === "published") {
      throw new Error("Published posts can't be edited here.");
    }
    await ctx.db.patch(id, { body: body.slice(0, 1500) });
  },
});

export const removePost = mutation({
  args: { id: v.id("posts") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    await ctx.db.delete(id);
  },
});

/* -------------------------------- writing ------------------------------- */

/** The angles a local SEO specialist rotates through, so posts don't repeat. */
const ANGLES = [
  "what you sell, plainly, with the locality named",
  "one specific product or service and who it suits",
  "a reason to come in this week",
  "what makes this shop different from the others nearby",
  "the areas you serve and how easy you are to reach",
  "an invitation to call or visit with a simple next step",
];

export const draftBody = internalAction({
  args: { userId: v.id("users"), brief: v.optional(v.string()) },
  handler: async (ctx, { userId, brief }): Promise<string | null> => {
    const c = await ctx.runQuery(internal.posts.postContext, { userId });
    if (!c) return null;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");

    const angle = ANGLES[Math.floor(Math.random() * ANGLES.length)];

    const prompt = [
      `Business: ${c.business.orgName}`,
      c.business.primaryCategory ? `Category: ${c.business.primaryCategory}` : "",
      c.business.city ? `City: ${c.business.city}` : "",
      c.areas.length ? `Serves: ${c.areas.slice(0, 6).join(", ")}` : "",
      c.offerings.length ? `Sells: ${c.offerings.join(", ")}` : "",
      c.specialties.length ? `Known for: ${c.specialties.join(", ")}` : "",
      c.keywords.length
        ? `Search phrases to work in naturally: ${c.keywords.slice(0, 6).join(", ")}`
        : "",
      c.recent.length
        ? `\nRecent posts — write something clearly different:\n- ${c.recent.join("\n- ")}`
        : "",
      brief ? `\nThe owner asked for: ${brief}` : `\nToday's angle: ${angle}`,
      "",
      "Write one Google Business Profile post for this shop.",
      "Rules:",
      "- 60 to 90 words. Under 1500 characters.",
      "- Plain Indian English a shop owner would actually say. No corporate voice.",
      "- Mention the locality naturally — this post is for people searching nearby.",
      "- One concrete reason to visit.",
      "- End with a simple invitation to visit or call.",
      "- No hashtags. No emoji.",
      "- Do NOT invent prices, discounts, opening hours, menu items, brands, or awards.",
      'Reply as JSON only: {"body":"..."}',
    ]
      .filter(Boolean)
      .join("\n");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.85,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You write short Google Business Profile posts for Indian neighbourhood shops. Concrete, warm, never salesy. You never invent facts about a business.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      console.error(`[openai] ${res.status} ${(await res.text()).slice(0, 300)}`);
      return null;
    }

    const data = await res.json();
    try {
      const body = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}").body;
      const text = String(body ?? "").trim();
      return text ? text.slice(0, 1500) : null;
    } catch {
      return null;
    }
  },
});

export const writePost = action({
  args: { brief: v.optional(v.string()) },
  handler: async (
    ctx,
    { brief },
  ): Promise<{ id: Id<"posts">; body: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const c = await ctx.runQuery(internal.posts.postContext, { userId });
    if (!c) throw new Error("Connect your Google profile first.");

    const body = await ctx.runAction(internal.posts.draftBody, { userId, brief });
    if (!body) throw new Error("Couldn't write a post just now. Try again.");

    const id: Id<"posts"> = await ctx.runMutation(internal.posts.saveDraft, {
      businessId: c.business._id,
      body,
      generatedBy: "ai",
    });

    return { id, body };
  },
});

/* ------------------------------ publishing ------------------------------ */

export const pushToGoogle = internalAction({
  args: { postId: v.id("posts"), userId: v.id("users") },
  handler: async (
    ctx,
    { postId, userId },
  ): Promise<{ ok: boolean; name?: string; error?: string }> => {
    const post = await ctx.runQuery(internal.posts.postById, { id: postId });
    if (!post) return { ok: false, error: "That post is gone." };

    const business = await ctx.runQuery(internal.google.businessForUser, {
      userId,
    });
    if (!business?.gbpAccountName || !business.gbpLocationName) {
      return { ok: false, error: "No Google listing linked." };
    }

    const token: string = await ctx.runAction(internal.google.accessTokenFor, {
      userId,
    });

    // v4 wants accounts/{id}/locations/{id}; we store the two halves apart.
    const locationId = business.gbpLocationName.replace(/^locations\//, "");
    const parent = `${business.gbpAccountName}/locations/${locationId}`;

    const callToAction = business.phone
      ? { actionType: "CALL" }
      : business.website
        ? { actionType: "LEARN_MORE", url: business.website }
        : undefined;

    const payload: Record<string, unknown> = {
      languageCode: "en-IN",
      summary: post.body.slice(0, 1500),
      topicType: "STANDARD",
    };
    if (callToAction) payload.callToAction = callToAction;
    if (post.imageUrl) {
      payload.media = [{ mediaFormat: "PHOTO", sourceUrl: post.imageUrl }];
    }

    const url = `${V4_BASE}/${parent}/localPosts`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`[gbp] POST ${url} -> ${res.status} ${text.slice(0, 500)}`);
      const message = `Google refused (${res.status}): ${text.slice(0, 220)}`;
      await ctx.runMutation(internal.posts.markPublished, {
        id: postId,
        error: message,
      });
      return { ok: false, error: message };
    }

    const created = JSON.parse(text || "{}");
    await ctx.runMutation(internal.posts.markPublished, {
      id: postId,
      gbpPostName: created.name,
    });

    console.log(`[gbp] published ${created.name}`);
    return { ok: true, name: created.name };
  },
});

export const publishPost = action({
  args: { id: v.id("posts") },
  handler: async (
    ctx,
    { id },
  ): Promise<{ ok: boolean; name?: string; error?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    return await ctx.runAction(internal.posts.pushToGoogle, {
      postId: id,
      userId,
    });
  },
});

/* ------------------------------ the agent ------------------------------- */

/**
 * Writes a post and puts it on the listing with no one watching.
 * This is the whole promise: the profile stays alive without the owner
 * remembering to do anything.
 */
export const writeAndPublish = internalAction({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    { userId },
  ): Promise<{ ok: boolean; reason?: string }> => {
    const c = await ctx.runQuery(internal.posts.postContext, { userId });
    if (!c) return { ok: false, reason: "no business" };
    if (!c.business.agentActive) return { ok: false, reason: "agent paused" };
    if (!c.business.gbpAccountName || !c.business.gbpLocationName) {
      return { ok: false, reason: "not connected" };
    }

    // 20 hours rather than 24, so a daily run never skips itself by minutes.
    const already = await ctx.runQuery(internal.posts.publishedRecently, {
      businessId: c.business._id,
      withinHours: 20,
    });
    if (already) return { ok: false, reason: "already posted today" };

    const body = await ctx.runAction(internal.posts.draftBody, { userId });
    if (!body) return { ok: false, reason: "could not write" };

    const id: Id<"posts"> = await ctx.runMutation(internal.posts.saveDraft, {
      businessId: c.business._id,
      body,
      generatedBy: "ai",
    });

    const result = await ctx.runAction(internal.posts.pushToGoogle, {
      postId: id,
      userId,
    });
    return { ok: result.ok, reason: result.error };
  },
});

export const postDaily = internalAction({
  args: {},
  handler: async (ctx): Promise<{ attempted: number; published: number }> => {
    const businesses: { userId: Id<"users">; name: string }[] =
      await ctx.runQuery(internal.performance.connectedBusinesses, {});

    let published = 0;
    for (const b of businesses) {
      try {
        const r = await ctx.runAction(internal.posts.writeAndPublish, {
          userId: b.userId,
        });
        if (r.ok) published += 1;
        else console.log(`[agent] ${b.name}: ${r.reason}`);
      } catch (error) {
        console.error(`[agent] ${b.name} failed`, error);
      }
    }
    return { attempted: businesses.length, published };
  },
});
