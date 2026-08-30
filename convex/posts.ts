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

    const [offerings, specialties, keywords, areas, recent, photos] =
      await Promise.all([
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
      ctx.db
        .query("photos")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
    ]);

    return {
      business,
      offerings: offerings.map((r) => r.label),
      specialties: specialties.map((r) => r.label),
      keywords: keywords.map((r) => r.term),
      areas: areas.map((r) => r.name),
      recent: recent.map((p) => p.body),
      recentImages: recent.map((p) => p.imageUrl).filter(Boolean) as string[],
      photos: photos.map((p) => p.url).filter(Boolean) as string[],
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
    imageUrl: v.optional(v.string()),
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
      imageUrl: post.imageUrl,
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

/**
 * A picture for the post, preferring one we haven't used recently.
 * A Google Business post with an image takes far more space in the feed
 * than a text-only one.
 */
function pickImage(photos: string[], recentImages: string[]): string | undefined {
  if (photos.length === 0) return undefined;
  const unused = photos.filter((p) => !recentImages.includes(p));
  const pool = unused.length > 0 ? unused : photos;
  return pool[Math.floor(Math.random() * pool.length)];
}

export const draftBody = internalAction({
  args: { userId: v.id("users"), brief: v.optional(v.string()) },
  handler: async (ctx, { userId, brief }): Promise<string | null> => {
    const c = await ctx.runQuery(internal.posts.postContext, { userId });
    if (!c) return null;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");

    const angle = ANGLES[Math.floor(Math.random() * ANGLES.length)];

    // The near-me phrases are the point of the whole post. They go in the
    // body naturally, the way a shop owner would list what they stock.
    const nearMe = c.keywords
      .filter((k: string) => k.includes("near me") || k.includes("nearby"))
      .slice(0, 6);
    const cityTerms = c.keywords
      .filter((k: string) => !k.includes("near me") && !k.includes("nearby"))
      .slice(0, 3);

    const prompt = [
      `Business: ${c.business.orgName}`,
      c.business.primaryCategory ? `Category: ${c.business.primaryCategory}` : "",
      c.business.city ? `City: ${c.business.city}` : "",
      c.business.streetAddress ? `Address: ${c.business.streetAddress}` : "",
      c.areas.length ? `Serves: ${c.areas.slice(0, 6).join(", ")}` : "",
      c.offerings.length ? `Sells: ${c.offerings.join(", ")}` : "",
      c.specialties.length ? `Known for: ${c.specialties.join(", ")}` : "",
      nearMe.length
        ? `Search phrases customers type — work these into the body naturally: ${nearMe.join(", ")}`
        : "",
      cityTerms.length ? `Also relevant: ${cityTerms.join(", ")}` : "",
      c.recent.length
        ? `\nRecent posts — write something clearly different:\n- ${c.recent.map((r: string) => r.slice(0, 120)).join("\n- ")}`
        : "",
      brief ? `\nThe owner asked for: ${brief}` : `\nToday's angle: ${angle}`,
      "",
      "Write one Google Business Profile post for this shop, in this exact shape:",
      "",
      "1. A headline line: what this post is about, naming the business. No label, no markdown.",
      "2. A blank line, then one opening paragraph of 40-60 words that names the locality and",
      "   what someone searching nearby would be looking for.",
      "3. A blank line, then 5 or 6 lines each starting with the ✔️ character and a space.",
      "   Each line is one concrete thing the shop offers, 15-30 words, and between them they",
      "   should work in the search phrases above the way a person would actually say them.",
      "4. A blank line, then one closing line inviting the reader to visit or call.",
      "",
      "Rules:",
      "- Plain Indian English. Warm and factual. Never corporate, never breathless.",
      "- 900 to 1300 characters in total. Never exceed 1450.",
      "- Fit the search phrases into real sentences. Never list them, never repeat one twice,",
      "  and never write something like 'visit our shop near me', which reads as nonsense.",
      "- Do NOT invent prices, discounts, opening hours, offers, menu items, brands, awards,",
      "  years in business, or customer numbers. Only describe what you were told above.",
      "- No hashtags. No emoji other than the ✔️ bullets.",
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
      return text ? text.slice(0, 1450) : null;
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
      imageUrl: pickImage(c.photos, c.recentImages),
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
      imageUrl: pickImage(c.photos, c.recentImages),
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

/* ---------------------------- the content plan ---------------------------
   Three posts a week, planned in advance and visible before they go out.

   Daily posting on a small local listing reads as automated, and a run of
   near-identical posts is worse than no posts at all. So the agent
   researches a fortnight of distinct topics up front — services, the
   season, the locality, the questions customers actually ask — and
   schedules them for Monday, Wednesday and Friday.                       */

const POST_DAYS = [1, 3, 5]; // Mon, Wed, Fri
const POST_HOUR_UTC = 4; // 09:30 IST

/**
 * What time of year it actually is in India, so the planner doesn't reach
 * for "spring" during the monsoon. Only a hint — the prompt still says to
 * use it only where it genuinely applies to the trade.
 */
function indianSeason(month: number): string {
  if (month >= 5 && month <= 8) return "the monsoon";
  if (month === 9 || month === 10) return "the festival season";
  if (month === 11 || month <= 1) return "winter, and the wedding season";
  return "summer";
}

/** The next N posting slots that aren't already taken. */
function nextSlots(count: number, taken: number[]): number[] {
  const slots: number[] = [];
  const cursor = new Date();
  cursor.setUTCHours(POST_HOUR_UTC, 0, 0, 0);
  if (cursor.getTime() <= Date.now()) cursor.setUTCDate(cursor.getUTCDate() + 1);

  for (let i = 0; i < 40 && slots.length < count; i++) {
    if (POST_DAYS.includes(cursor.getUTCDay())) {
      const time = cursor.getTime();
      const clash = taken.some((t) => Math.abs(t - time) < 12 * 3600_000);
      if (!clash) slots.push(time);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return slots;
}

export const scheduledFor = internalQuery({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, { businessId }) => {
    const rows = await ctx.db
      .query("posts")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
    return rows
      .filter((r) => r.status === "scheduled" && r.scheduledFor)
      .map((r) => r.scheduledFor as number);
  },
});

export const saveScheduled = internalMutation({
  args: {
    businessId: v.id("businesses"),
    body: v.string(),
    title: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    scheduledFor: v.number(),
  },
  handler: async (ctx, args) =>
    await ctx.db.insert("posts", {
      ...args,
      status: "scheduled",
      generatedBy: "ai",
    }),
});

/** Researches what to post about, then writes and schedules each one. */
export const planPosts = action({
  args: { count: v.optional(v.number()) },
  handler: async (
    ctx,
    { count = 6 },
  ): Promise<{ planned: number; topics: string[] }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const c = await ctx.runQuery(internal.posts.postContext, { userId });
    if (!c) throw new Error("Connect your Google profile first.");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");

    const now = new Date();
    const month = now.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
    const season = indianSeason(now.getMonth());
    const nearMe = c.keywords.filter(
      (k: string) => k.includes("near me") || k.includes("nearby"),
    );

    const brief = [
      `Business: ${c.business.orgName}`,
      c.business.primaryCategory ? `Category: ${c.business.primaryCategory}` : "",
      c.business.city ? `City: ${c.business.city}` : "",
      c.areas.length ? `Serves: ${c.areas.slice(0, 6).join(", ")}` : "",
      c.offerings.length ? `Sells: ${c.offerings.join(", ")}` : "",
      c.specialties.length ? `Known for: ${c.specialties.join(", ")}` : "",
      nearMe.length
        ? `Searches to target across the plan: ${nearMe.join(", ")}`
        : "",
      c.recent.length
        ? `\nAlready posted about:\n- ${c.recent.map((r: string) => r.slice(0, 100)).join("\n- ")}`
        : "",
      `\nIt is ${month}.`,
      "",
      `Plan ${count} Google Business Profile posts, three a week over the next fortnight.`,
      "Each needs a distinct reason to exist. Draw on different angles:",
      "- one specific product or service in depth",
      "- a question customers actually ask before buying",
      `- what suits ${season}, but ONLY if it genuinely affects this trade`,
      "- never reference a season, festival or event that is not happening now",
      "- the localities served and how easy the shop is to reach",
      "- what makes this shop a different choice from the ones nearby",
      "- practical guidance a customer would find useful",
      "",
      "Rules:",
      "- No two topics may overlap. If you cannot find enough distinct angles, return fewer.",
      "- Do not invent offers, discounts, events or prices.",
      "",
      'Reply as JSON only: {"topics":[{"topic":"...","targets":"..."}]}',
      "topic = a one-line brief for the post. targets = which search phrase it leans on.",
    ]
      .filter(Boolean)
      .join("\n");

    const research = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.9,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You plan Google Business Profile content for Indian neighbourhood businesses. You think like a local SEO specialist: every post must earn its place, and no two may cover the same ground.",
          },
          { role: "user", content: brief },
        ],
      }),
    });

    if (!research.ok) {
      console.error(`[openai] plan ${research.status}`);
      throw new Error("Couldn't plan the posts just now. Try again.");
    }

    const payload = await research.json();
    let topics: { topic: string; targets?: string }[] = [];
    try {
      topics =
        JSON.parse(payload?.choices?.[0]?.message?.content ?? "{}").topics ?? [];
    } catch {
      throw new Error("The planner returned something we couldn't read.");
    }
    topics = topics.filter((t) => t?.topic).slice(0, count);
    if (topics.length === 0) throw new Error("No topics came back. Try again.");

    const taken: number[] = await ctx.runQuery(internal.posts.scheduledFor, {
      businessId: c.business._id,
    });
    const slots = nextSlots(topics.length, taken);

    const usedImages = [...c.recentImages];
    let planned = 0;

    for (let i = 0; i < topics.length && i < slots.length; i++) {
      const topicBrief = topics[i].targets
        ? `${topics[i].topic} (lean on the search phrase: ${topics[i].targets})`
        : topics[i].topic;

      const body = await ctx.runAction(internal.posts.draftBody, {
        userId,
        brief: topicBrief,
      });
      if (!body) continue;

      const image = pickImage(c.photos, usedImages);
      if (image) usedImages.push(image);

      await ctx.runMutation(internal.posts.saveScheduled, {
        businessId: c.business._id,
        body,
        title: topics[i].topic,
        imageUrl: image,
        scheduledFor: slots[i],
      });
      planned += 1;
    }

    return { planned, topics: topics.map((t) => t.topic) };
  },
});

export const dueNow = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("posts")
      .filter((q) => q.eq(q.field("status"), "scheduled"))
      .collect();
    const now = Date.now();
    return rows
      .filter((r) => (r.scheduledFor ?? 0) <= now)
      .map((r) => ({ id: r._id, businessId: r.businessId }));
  },
});

export const ownerOf = internalQuery({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, { businessId }) => {
    const business = await ctx.db.get(businessId);
    return business?.userId ?? null;
  },
});

/** Publishes whatever the plan says is due. Runs every morning. */
export const publishDue = internalAction({
  args: {},
  handler: async (ctx): Promise<{ published: number }> => {
    const due = await ctx.runQuery(internal.posts.dueNow, {});
    let published = 0;

    for (const item of due) {
      try {
        const userId = await ctx.runQuery(internal.posts.ownerOf, {
          businessId: item.businessId,
        });
        if (!userId) continue;
        const r = await ctx.runAction(internal.posts.pushToGoogle, {
          postId: item.id,
          userId,
        });
        if (r.ok) published += 1;
      } catch (error) {
        console.error("[agent] scheduled post failed", error);
      }
    }
    return { published };
  },
});
