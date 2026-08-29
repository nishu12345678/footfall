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
 * Information API — that split is the single most common reason a
 * Business Profile integration fails after OAuth works fine.
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
        .take(5),
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

/* ------------------------------- writing -------------------------------- */

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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");

    const prompt = [
      `Business: ${c.business.orgName}`,
      c.business.primaryCategory ? `Category: ${c.business.primaryCategory}` : "",
      c.business.city ? `City: ${c.business.city}` : "",
      c.areas.length ? `Serves: ${c.areas.join(", ")}` : "",
      c.offerings.length ? `Sells: ${c.offerings.join(", ")}` : "",
      c.specialties.length ? `Known for: ${c.specialties.join(", ")}` : "",
      c.keywords.length
        ? `Search phrases to work in naturally: ${c.keywords.slice(0, 6).join(", ")}`
        : "",
      c.recent.length
        ? `\nRecent posts (write something different):\n- ${c.recent.join("\n- ")}`
        : "",
      brief ? `\nThe owner asked for: ${brief}` : "",
      "",
      "Write one Google Business Profile post for this shop.",
      "Rules:",
      "- 60 to 90 words. Under 1500 characters.",
      "- Plain Indian English a shop owner would actually say. No corporate marketing voice.",
      "- Mention the locality naturally, because this post is for people searching nearby.",
      "- One concrete reason to visit: a service, a range, an offer, timing.",
      "- End with a simple invitation to visit or call.",
      "- No hashtags. No emoji. Do not invent prices, discounts or claims you were not given.",
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
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You write short Google Business Profile posts for Indian neighbourhood shops. Concrete, warm, never salesy. You never invent facts.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[openai] ${res.status} ${text.slice(0, 300)}`);
      throw new Error(`Could not write the post (${res.status}).`);
    }

    const data = await res.json();
    let body = "";
    try {
      body = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}").body ?? "";
    } catch {
      throw new Error("The model returned something we couldn't read.");
    }
    if (!body.trim()) throw new Error("The model returned an empty post.");

    const id: Id<"posts"> = await ctx.runMutation(internal.posts.saveDraft, {
      businessId: c.business._id,
      body: body.trim().slice(0, 1500),
      generatedBy: "ai",
    });

    return { id, body: body.trim() };
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

/* ------------------------------ publishing ------------------------------ */

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

export const postById = internalQuery({
  args: { id: v.id("posts") },
  handler: async (ctx, { id }) => await ctx.db.get(id),
});

export const publishPost = action({
  args: { id: v.id("posts") },
  handler: async (
    ctx,
    { id },
  ): Promise<{ ok: boolean; name?: string; error?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const post = await ctx.runQuery(internal.posts.postById, { id });
    if (!post) throw new Error("That post is gone.");

    const business = await ctx.runQuery(internal.google.businessForUser, {
      userId,
    });
    if (!business?.gbpAccountName || !business.gbpLocationName) {
      throw new Error("No Google listing linked.");
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
      await ctx.runMutation(internal.posts.markPublished, { id, error: message });
      return { ok: false, error: message };
    }

    const created = JSON.parse(text || "{}");
    await ctx.runMutation(internal.posts.markPublished, {
      id,
      gbpPostName: created.name,
    });

    console.log(`[gbp] published ${created.name}`);
    return { ok: true, name: created.name };
  },
});

/**
 * Writes and publishes in one go — what the weekly agent run will call.
 */
export const writeAndPublish = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<{ ok: boolean }> => {
    const c = await ctx.runQuery(internal.posts.postContext, { userId });
    if (!c) return { ok: false };
    return { ok: true };
  },
});
