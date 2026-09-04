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
import {
  ownedRow,
  ownedRowFor,
  paidAction,
  paidMutation,
  type Owned,
} from "./access";
import { V4_BASE } from "./googleHosts";

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
      // Photos only. The same bucket now holds videos the owner uploaded,
      // and a post image has to be a still: Google wants a JPG or PNG, and
      // the headline is drawn onto it.
      photos: photos
        .filter((p) => p.mediaType !== "video")
        .map((p) => p.url)
        .filter(Boolean) as string[],
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

/** A post, only if it belongs to this user's business. */
export const ownedPost = internalQuery({
  args: { userId: v.id("users"), id: v.id("posts") },
  handler: async (ctx, { userId, id }) => await ownedRowFor(ctx, userId, id),
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

export const updateDraft = paidMutation({
  args: { id: v.id("posts"), body: v.string() },
  handler: async (ctx, { id, body }) => {
    const { row: post } = await ownedRow(ctx, id);
    if (post.status === "published") {
      throw new Error("Published posts can't be edited here.");
    }
    await ctx.db.patch(post._id, { body: body.slice(0, 1500) });
  },
});

export const removePost = paidMutation({
  args: { id: v.id("posts") },
  handler: async (ctx, { id }) => {
    const { row: post } = await ownedRow(ctx, id);
    await ctx.db.delete(post._id);
  },
});

/* -------------------------------- writing ------------------------------- */

/**
 * Google's published specification for a post image:
 *   recommended 1200 x 900, 4:3      (720 x 720 is the safe minimum)
 *   JPG or PNG only, 10 KB to 5 MB
 *   keep the subject in the central square, because Google crops
 *   differently across Search and Maps
 *
 * Google's own CDN will do the crop for us: "=w1200-h900-c" returns exactly
 * 1200x900, centre-cropped. Without it we were sending whatever shape the
 * original happened to be.
 */
const POST_IMAGE_W = 1200;
const POST_IMAGE_H = 900;

function toPostImage(url: string): string {
  if (!url.includes("googleusercontent.com")) return url;
  const base = url.replace(/=[a-z0-9-]+$/i, "");
  return `${base}=w${POST_IMAGE_W}-h${POST_IMAGE_H}-c`;
}

/** The media Google will accept, or nothing. */
async function usableMedia(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) return null;

    const type = res.headers.get("content-type") ?? "";
    if (!/image\/(jpe?g|png)/i.test(type)) return null;

    const length = Number(res.headers.get("content-length") ?? 0);
    // Google rejects anything under 10 KB or over 5 MB.
    if (length && (length < 10_240 || length > 5 * 1024 * 1024)) return null;

    return url;
  } catch {
    return null;
  }
}

/**
 * What a search phrase is actually about, without the proximity words.
 *
 * "root canal treatment near me" is a proximity search: Google answers it
 * from where the searcher is standing and how close the shop is, not from
 * whether the page says "near me". Writing the phrase into a post reads as
 * nonsense to the customer and does nothing for the ranking. So we take the
 * subject — root canal treatment — and write about that.
 */
function searchSubject(term: string): string {
  return term
    .replace(/\b(near me|nearby|near by|around me|closest|nearest)\b/gi, "")
    .replace(/\bin\s+[a-z\s]+$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** The distinct subjects behind a set of search phrases. */
function subjectsOf(terms: string[], limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const term of terms) {
    const subject = searchSubject(term);
    if (!subject || seen.has(subject.toLowerCase())) continue;
    seen.add(subject.toLowerCase());
    out.push(subject);
    if (out.length === limit) break;
  }
  return out;
}

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
function pickImage(
  photos: string[],
  recentImages: string[],
): string | undefined {
  // Never a profile picture, wherever it came from.
  photos = photos.filter((p) => !/googleusercontent\.com\/a[-/]/.test(p));
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

    // What people are searching for, with the proximity words stripped.
    // The post is written about the subject; being close is Google's job.
    const subjects = subjectsOf(c.keywords, 6);

    const prompt = [
      `Business: ${c.business.orgName}`,
      c.business.primaryCategory
        ? `Category: ${c.business.primaryCategory}`
        : "",
      c.business.city ? `City: ${c.business.city}` : "",
      c.business.streetAddress ? `Address: ${c.business.streetAddress}` : "",
      c.areas.length ? `Serves: ${c.areas.slice(0, 6).join(", ")}` : "",
      c.offerings.length ? `Sells: ${c.offerings.join(", ")}` : "",
      c.specialties.length ? `Known for: ${c.specialties.join(", ")}` : "",
      subjects.length
        ? `What customers are searching for — write about these in the shop's own words: ${subjects.join(", ")}`
        : "",
      c.recent.length
        ? `\nRecent posts — write something clearly different:\n- ${c.recent.map((r: string) => r.slice(0, 120)).join("\n- ")}`
        : "",
      brief ? `\nThe owner asked for: ${brief}` : `\nToday's angle: ${angle}`,
      "",
      "Write one Google Business Profile post for this shop, in this exact shape:",
      "",
      "1. An opening line of 45 to 68 characters — a complete thought that stands",
      "   on its own. Google cuts the text off around there on a phone, and this",
      "   same line is printed onto the post's picture, so it must not run past",
      "   its own ending. Count the characters. No greeting, no preamble, no",
      "   'we are pleased to'. Say the useful thing first.",
      "2. A blank line, then one short paragraph of 30-45 words naming the locality and",
      "   what someone searching nearby is actually trying to find.",
      "3. A blank line, then 4 lines each starting with the ✔️ character and a space.",
      "   Each is one concrete thing the shop offers, 12-22 words.",
      "4. A blank line, then one closing line inviting them to visit.",
      "",
      "Rules:",
      "- Plain Indian English. Warm and factual. Never corporate, never breathless.",
      "- 600 to 900 characters in total. Never exceed 1000. Shorter reads better here.",
      "- NEVER put a phone number in the text. Google rejects posts containing them,",
      "  and the profile already carries a call button.",
      "- Cover AT MOST TWO of those subjects, in the shop's own plain words.",
      "- NEVER write 'near me', 'nearby', or 'near you' anywhere. Customers type",
      "  it, shops don't say it, and Google decides who is near without being told.",
      "- Do NOT invent prices, discounts, opening hours, offers, menu items, brands, awards,",
      "  years in business, or customer numbers. Only describe what you were told above.",
      "- No ALL CAPS, no exclamation marks, no hashtags, no emoji besides the ✔️ bullets.",
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
      console.error(
        `[openai] ${res.status} ${(await res.text()).slice(0, 300)}`,
      );
      return null;
    }

    const data = await res.json();
    try {
      const body = JSON.parse(
        data?.choices?.[0]?.message?.content ?? "{}",
      ).body;
      const text = String(body ?? "").trim();
      return text ? text.slice(0, 1000) : null;
    } catch {
      return null;
    }
  },
});

export const writePost = paidAction({
  args: { brief: v.optional(v.string()) },
  handler: async (
    ctx,
    { brief },
  ): Promise<{ id: Id<"posts">; body: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const c = await ctx.runQuery(internal.posts.postContext, { userId });
    if (!c) throw new Error("Connect your Google profile first.");

    const body = await ctx.runAction(internal.posts.draftBody, {
      userId,
      brief,
    });
    if (!body) throw new Error("Couldn't write a post just now. Try again.");

    const image = pickImage(c.photos, c.recentImages);
    const id: Id<"posts"> = await ctx.runMutation(internal.posts.saveDraft, {
      businessId: c.business._id,
      body,
      imageUrl: image,
      generatedBy: "ai",
    });

    let picture = image;
    if (!image) {
      picture =
        (await ctx.runAction(internal.posts.generatePostImage, {
          postId: id,
          topic:
            brief ?? `${c.business.orgName} in ${c.business.city ?? "India"}`,
          category: c.business.primaryCategory,
          orgName: c.business.orgName,
          city: c.business.city,
          offerings: c.offerings,
        })) ?? undefined;
    }

    // Same as the planned posts: the headline goes on the picture, which is
    // the largest measured difference between a post that gets clicked and
    // one that doesn't.
    if (picture) {
      await ctx.runAction(internal.postimage.addHeadline, {
        postId: id,
        imageUrl: picture,
        headline: headlineFor(body),
        businessName: c.business.orgName,
      });
    }

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
    // The post has to belong to the business whose Google credentials are
    // about to be used. Checked here, at the point of the Google call, so
    // the owner's button and the crons are covered by the same line.
    const { row: post, business }: Owned<"posts"> = await ctx.runQuery(
      internal.posts.ownedPost,
      { userId, id: postId },
    );
    if (!business.gbpAccountName || !business.gbpLocationName) {
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

    // 1200x900 as Google recommends, and only if it meets their size and
    // format rules — a rejected image fails the whole post.
    if (post.imageUrl) {
      const media = await usableMedia(toPostImage(post.imageUrl));
      if (media) {
        payload.media = [{ mediaFormat: "PHOTO", sourceUrl: media }];
      } else {
        console.log(`[gbp] skipping unusable image ${post.imageUrl}`);
      }
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

export const publishPost = paidAction({
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
const POST_HOUR_UTC = 5; // 10:30 IST — inside shop hours, when people plan

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
  if (cursor.getTime() <= Date.now())
    cursor.setUTCDate(cursor.getUTCDate() + 1);

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
    imageSource: v.optional(v.string()),
    imageNote: v.optional(v.string()),
  },
  handler: async (ctx, args) =>
    await ctx.db.insert("posts", {
      ...args,
      status: "scheduled",
      generatedBy: "ai",
    }),
});

/** Researches what to post about, then writes and schedules each one. */
export const planForUser = internalAction({
  args: { userId: v.id("users"), count: v.optional(v.number()) },
  handler: async (
    ctx,
    { userId, count = 6 },
  ): Promise<{ planned: number; topics: string[] }> => {
    let c = await ctx.runQuery(internal.posts.postContext, { userId });
    if (!c) throw new Error("Connect your Google profile first.");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");

    const now = new Date();
    const month = now.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });
    const season = indianSeason(now.getMonth());
    const subjects = subjectsOf(c.keywords, 8);

    const brief = [
      `Business: ${c.business.orgName}`,
      c.business.primaryCategory
        ? `Category: ${c.business.primaryCategory}`
        : "",
      c.business.city ? `City: ${c.business.city}` : "",
      c.areas.length ? `Serves: ${c.areas.slice(0, 6).join(", ")}` : "",
      c.offerings.length ? `Sells: ${c.offerings.join(", ")}` : "",
      c.specialties.length ? `Known for: ${c.specialties.join(", ")}` : "",
      subjects.length
        ? `Subjects customers search for — spread these across the plan: ${subjects.join(", ")}`
        : "",
      c.recent.length
        ? `\nAlready posted about:\n- ${c.recent.map((r: string) => r.slice(0, 100)).join("\n- ")}`
        : "",
      `\nIt is ${month}.`,
      "",
      `Plan ${count} Google Business Profile posts, three a week on weekdays over the next fortnight.`,
      "Google posts lose prominence after about seven days, so each one has to stand on its own.",
      "Favour what someone decides on: what you stock, what a visit involves, what to bring,",
      "how to reach you — not brand awareness.",
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
        JSON.parse(payload?.choices?.[0]?.message?.content ?? "{}").topics ??
        [];
    } catch {
      throw new Error("The planner returned something we couldn't read.");
    }
    topics = topics.filter((t) => t?.topic).slice(0, count);
    if (topics.length === 0) throw new Error("No topics came back. Try again.");

    // The shop's own photos are the most relevant picture there is, so make
    // sure we have them before falling back to a generated one.
    if (c.photos.length === 0) {
      try {
        await ctx.runAction(internal.photos.syncForUser, { userId });
        const refreshed = await ctx.runQuery(internal.posts.postContext, {
          userId,
        });
        if (refreshed) c = refreshed;
      } catch (error) {
        console.log("[plan] could not pull photos from Google", error);
      }
    }

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

      const postId = await ctx.runMutation(internal.posts.saveScheduled, {
        businessId: c.business._id,
        body,
        title: topics[i].topic,
        imageUrl: image,
        scheduledFor: slots[i],
        imageSource: image ? "listing" : undefined,
        imageNote: image
          ? "One of your own photos, already on your Google listing."
          : undefined,
      });

      // No photo of their own to use, so make one that suits the trade.
      let picture = image;
      if (!image) {
        picture =
          (await ctx.runAction(internal.posts.generatePostImage, {
            postId,
            topic: topics[i].topic,
            category: c.business.primaryCategory,
            orgName: c.business.orgName,
            city: c.business.city,
            offerings: c.offerings,
          })) ?? undefined;
      }

      // A post whose picture carries text draws better than three times the
      // clicks of one whose picture doesn't. This is the largest single
      // effect measured on Google Posts, so every post gets it.
      if (picture) {
        await ctx.runAction(internal.postimage.addHeadline, {
          postId,
          imageUrl: picture,
          headline: headlineFor(body),
          businessName: c.business.orgName,
        });
      }
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

/* ------------------------------ post images ------------------------------
   Every post gets a picture, because a Google Business post with an image
   takes several times the space of a text-only one in the feed.

   The shop's own photos come first when it has them — a real picture of a
   real shop always beats a generated one. When it has none, we generate
   something that suits the trade and the topic, and we keep it generic:
   an illustration of the kind of work, never a fake photograph of their
   premises or their staff.                                                */

/** What a picture for this trade should actually show. */
function subjectFor(category: string | undefined, orgName: string): string {
  const c = (category ?? orgName).toLowerCase();
  const has = (...words: string[]) => words.some((w) => c.includes(w));

  if (has("dent", "clinic", "doctor", "hospital", "medical", "physio"))
    return "a friendly Indian person smiling naturally, relaxed and at ease, with a clean modern clinic softly blurred behind them";
  if (has("salon", "parlour", "parlor", "spa", "barber", "beauty"))
    return "an Indian person with freshly styled hair, calm and happy, in a bright modern salon";
  if (has("cafe", "coffee", "restaurant", "food", "bakery", "sweet", "dhaba"))
    return "freshly made food and drink arranged on a clean table, warm light, a welcoming cafe interior behind";
  if (
    has(
      "tile",
      "marble",
      "granite",
      "stone",
      "sanitary",
      "hardware",
      "building",
      "cement",
      "paint",
    )
  )
    return "a bright showroom interior with tiles and stone samples displayed neatly in rows, a customer considering a sample";
  if (has("gym", "fitness", "yoga"))
    return "an Indian person mid-workout in a clean, well-lit gym";
  if (has("cloth", "boutique", "fashion", "tailor", "garment"))
    return "neatly arranged clothing on rails in a bright boutique interior";
  if (has("mattress", "furniture", "home", "interior"))
    return "a warm, well-styled room interior with the furniture as the focus";
  if (has("school", "coaching", "academy", "tuition"))
    return "Indian students working attentively in a bright, tidy classroom";
  return "a welcoming Indian shop interior with products displayed neatly and a member of staff ready to help";
}

export const savePostImage = internalMutation({
  args: {
    postId: v.id("posts"),
    storageId: v.id("_storage"),
    note: v.optional(v.string()),
  },
  handler: async (ctx, { postId, storageId, note }) => {
    const url = await ctx.storage.getUrl(storageId);
    if (url) {
      await ctx.db.patch(postId, {
        imageUrl: url,
        imageSource: "made",
        imageNote: note,
      });
    }
    return url;
  },
});

/**
 * Makes a picture for one post and attaches it.
 *
 * Deliberately generic: no text in the image, no signage, no logos. Image
 * models render text badly, and putting a fabricated shopfront or a
 * made-up sign on a real business's listing would be a lie.
 */
export const generatePostImage = internalAction({
  args: {
    postId: v.id("posts"),
    topic: v.string(),
    category: v.optional(v.string()),
    orgName: v.string(),
    city: v.optional(v.string()),
    offerings: v.optional(v.array(v.string())),
  },
  handler: async (
    ctx,
    { postId, topic, category, orgName, city, offerings },
  ): Promise<string | null> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const subject = subjectFor(category, orgName);
    const prompt = [
      `Editorial photograph for a ${category ?? "local business"}${city ? ` in ${city}, India` : " in India"}.`,
      `Show ${subject}.`,
      `The picture must be about this specific subject: "${topic}".`,
      offerings?.length
        ? `This business offers: ${offerings.slice(0, 8).join(", ")}. The scene should show work of that kind, not something generic.`
        : "",
      "Indian setting and Indian people. Natural daylight, warm and inviting,",
      "shallow depth of field, realistic and unstaged, like a photograph the shop took itself.",
      "Absolutely no text, no words, no letters, no numbers, no signage, no logos, no watermarks.",
    ]
      .filter(Boolean)
      .join(" ");

    try {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt,
          // Landscape, closest of the supported sizes to Google's 4:3.
          // JPEG because Google takes JPG or PNG and a compressed JPEG
          // comfortably clears their 5 MB ceiling.
          size: "1536x1024",
          quality: "medium",
          output_format: "jpeg",
          output_compression: 85,
          n: 1,
        }),
      });

      if (!res.ok) {
        console.error(
          `[image] ${res.status} ${(await res.text()).slice(0, 200)}`,
        );
        return null;
      }

      const data = await res.json();
      const b64: string | undefined = data?.data?.[0]?.b64_json;
      if (!b64) return null;

      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

      const storageId = await ctx.storage.store(
        new Blob([bytes], { type: "image/jpeg" }),
      );
      return await ctx.runMutation(internal.posts.savePostImage, {
        postId,
        storageId,
        // Say what the picture is, so the owner isn't guessing why it's there.
        note: `Made for this post: ${subject}.`,
      });
    } catch (error) {
      console.error("[image] generation failed", error);
      return null;
    }
  },
});

export const planPosts = paidAction({
  args: { count: v.optional(v.number()) },
  handler: async (
    ctx,
    { count },
  ): Promise<{ planned: number; topics: string[] }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    return await ctx.runAction(internal.posts.planForUser, { userId, count });
  },
});

/**
 * Keeps every shop's plan topped up without anyone asking.
 *
 * Google posts lose prominence after roughly seven days, so a listing that
 * goes quiet for a fortnight looks abandoned. This runs weekly and refills
 * any plan that has dropped below a week's worth.
 */
export const topUpPlans = internalAction({
  args: {},
  handler: async (ctx): Promise<{ businesses: number; planned: number }> => {
    const businesses: { userId: Id<"users">; name: string }[] =
      await ctx.runQuery(internal.performance.connectedBusinesses, {});

    let planned = 0;
    for (const b of businesses) {
      try {
        const c = await ctx.runQuery(internal.posts.postContext, {
          userId: b.userId,
        });
        if (!c || !c.business.agentActive) continue;

        const pending: number[] = await ctx.runQuery(
          internal.posts.scheduledFor,
          { businessId: c.business._id },
        );
        // Fewer than four ahead means under a fortnight of runway.
        if (pending.length >= 4) continue;

        const result = await ctx.runAction(internal.posts.planForUser, {
          userId: b.userId,
          count: 6 - pending.length,
        });
        planned += result.planned;

        // Keep the listing's services in step with what the owner sells.
        // Google names services as a relevance signal, and this is the one
        // place we already hold the answer.
        try {
          await ctx.runAction(internal.google.pushServicesForUser, {
            userId: b.userId,
          });
        } catch (error) {
          console.log(`[agent] service push failed for ${b.name}`, error);
        }
      } catch (error) {
        console.error(`[agent] planning failed for ${b.name}`, error);
      }
    }
    return { businesses: businesses.length, planned };
  },
});

/**
 * Makes sure a fortnight of posts is always sitting there, written and
 * illustrated, before the owner opens the screen.
 *
 * The point of the product is that nothing needs pressing. A screen that
 * says "plan the next two weeks" is a screen that has not done its job, so
 * this runs on open and tops the plan back up to a week's worth.
 */
export const ensurePlan = paidAction({
  args: { want: v.optional(v.number()) },
  handler: async (
    ctx,
    { want = 7 },
  ): Promise<{ planned: number; pending: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const c = await ctx.runQuery(internal.posts.postContext, { userId });
    if (!c) throw new Error("Connect your Google profile first.");

    const pending: number[] = await ctx.runQuery(internal.posts.scheduledFor, {
      businessId: c.business._id,
    });
    if (pending.length >= want) return { planned: 0, pending: pending.length };

    const result = await ctx.runAction(internal.posts.planForUser, {
      userId,
      count: want - pending.length,
    });
    return {
      planned: result.planned,
      pending: pending.length + result.planned,
    };
  },
});

/** Swaps in the version of the picture that carries the headline. */
export const attachHeadlineImage = internalMutation({
  args: { postId: v.id("posts"), storageId: v.id("_storage") },
  handler: async (ctx, { postId, storageId }) => {
    const url = await ctx.storage.getUrl(storageId);
    if (!url) return null;
    const post = await ctx.db.get(postId);
    await ctx.db.patch(postId, {
      imageUrl: url,
      imageNote:
        post?.imageSource === "listing"
          ? "Your own photo from the listing, with the headline over it."
          : "Made for this post, with the headline over it.",
    });
    return url;
  },
});

/**
 * The line that goes on the picture.
 *
 * The post's own opening line is written to land in under 90 characters,
 * which is already the shape a headline needs, so we take it rather than
 * asking the model twice.
 */
export function headlineFor(body: string): string {
  const first =
    body
      .split("\n")
      .map((l) => l.trim())
      .find(Boolean) ?? "";
  const line = first.replace(/\s+/g, " ");
  if (line.length <= 70) return line;

  // Cut at a word, not through one — "how to reach us easil" was the first
  // one that went out — then drop any trailing word that leaves the phrase
  // hanging, so it doesn't end on "for all your".
  const cut = line.slice(0, 70);
  const lastSpace = cut.lastIndexOf(" ");
  let out = lastSpace > 36 ? cut.slice(0, lastSpace) : cut;

  const dangling =
    /\s+(a|an|the|and|or|for|to|of|with|in|on|at|your|our|all|that|is|are)$/i;
  while (dangling.test(out)) out = out.replace(dangling, "");

  return out.replace(/[,;:\-–—]$/, "").trim();
}

/* --------------------------- reading Google back -------------------------
   Everything above writes posts to Google. Nothing read them back, so the
   posts table only ever held what footfall itself published — and a shop
   that had been posting from the Google app for years looked, to us, like
   a shop that had never posted at all. That made the free report wrong in
   the one direction a report must never be wrong: alarming and false. */

type GooglePost = {
  name?: unknown;
  summary?: unknown;
  createTime?: unknown;
  state?: unknown;
  media?: unknown;
};

export const saveGooglePosts = internalMutation({
  args: {
    businessId: v.id("businesses"),
    posts: v.array(
      v.object({
        gbpPostName: v.string(),
        body: v.string(),
        publishedAt: v.number(),
        imageUrl: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, { businessId, posts }) => {
    const existing = await ctx.db
      .query("posts")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
    const known = new Set(
      existing.map((p) => p.gbpPostName).filter(Boolean) as string[],
    );

    let added = 0;
    for (const post of posts) {
      if (known.has(post.gbpPostName)) continue;
      await ctx.db.insert("posts", {
        businessId,
        body: post.body,
        imageUrl: post.imageUrl,
        status: "published",
        publishedAt: post.publishedAt,
        gbpPostName: post.gbpPostName,
        // Theirs, not ours. Worth keeping straight when we report on it.
        generatedBy: "google",
      });
      added += 1;
    }
    return { added, total: existing.length + added };
  },
});

/** Pulls the posts already on the listing, so the report counts reality. */
export const syncFromGoogleForUser = internalAction({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    { userId },
  ): Promise<{ added: number; total: number }> => {
    const business = await ctx.runQuery(internal.google.businessForUser, {
      userId,
    });
    if (!business?.gbpAccountName || !business.gbpLocationName) {
      return { added: 0, total: 0 };
    }

    const token: string = await ctx.runAction(internal.google.accessTokenFor, {
      userId,
    });
    const locationId = business.gbpLocationName.replace(/^locations\//, "");
    const parent = `${business.gbpAccountName}/locations/${locationId}`;

    const collected: GooglePost[] = [];
    let pageToken: string | undefined;

    // A long-running shop can have hundreds. Three pages is plenty to judge
    // whether the listing is alive.
    for (let page = 0; page < 3; page++) {
      const url = new URL(`${V4_BASE}/${parent}/localPosts`);
      url.searchParams.set("pageSize", "100");
      if (pageToken) url.searchParams.set("pageToken", pageToken);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        console.error(
          `[gbp] GET localPosts -> ${res.status} ${(await res.text()).slice(0, 300)}`,
        );
        break;
      }

      const json = (await res.json()) as {
        localPosts?: GooglePost[];
        nextPageToken?: unknown;
      };
      collected.push(...(json.localPosts ?? []));
      pageToken =
        typeof json.nextPageToken === "string" ? json.nextPageToken : undefined;
      if (!pageToken) break;
    }

    const rows = collected.flatMap((p) => {
      const name = typeof p.name === "string" ? p.name : null;
      const created =
        typeof p.createTime === "string" ? Date.parse(p.createTime) : NaN;
      if (!name || Number.isNaN(created)) return [];

      // A rejected post is not a published one.
      if (typeof p.state === "string" && p.state === "REJECTED") return [];

      const media = Array.isArray(p.media) ? p.media : [];
      const first = media[0] as { googleUrl?: unknown } | undefined;

      return [
        {
          gbpPostName: name,
          body: typeof p.summary === "string" ? p.summary : "",
          publishedAt: created,
          imageUrl:
            typeof first?.googleUrl === "string" ? first.googleUrl : undefined,
        },
      ];
    });

    return await ctx.runMutation(internal.posts.saveGooglePosts, {
      businessId: business._id,
      posts: rows,
    });
  },
});
