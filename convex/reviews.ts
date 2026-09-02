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
import { paidAction, paidMutation } from "./access";

/**
 * Reviews from the Google Business Profile.
 *
 * They matter twice over: they're the strongest thing a small shop can move
 * for ranking, and they're the only trust signal a stranger reads before
 * deciding to visit. Both the app and the generated website need them.
 *
 * Reviews live on the legacy v4 endpoint, like posts and media.
 */

const V4_BASE = "https://mybusiness.googleapis.com/v4";

const STAR_VALUES: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

export const saveReviews = internalMutation({
  args: {
    businessId: v.id("businesses"),
    items: v.array(
      v.object({
        gbpReviewName: v.string(),
        authorName: v.optional(v.string()),
        authorPhoto: v.optional(v.string()),
        rating: v.number(),
        comment: v.optional(v.string()),
        createdAt: v.number(),
        replyText: v.optional(v.string()),
        repliedAt: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { businessId, items }) => {
    const existing = await ctx.db
      .query("reviews")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
    const byName = new Map(
      existing.filter((r) => r.gbpReviewName).map((r) => [r.gbpReviewName, r]),
    );

    let added = 0;
    for (const item of items) {
      const match = byName.get(item.gbpReviewName);

      if (match) {
        // Google is the truth for whether a reply is live. When it has none
        // and we're holding a draft, keep the draft — re-syncing must not
        // throw away work waiting for the owner.
        if (!item.replyText && match.replyStatus === "drafted") {
          const { replyText: _drop, repliedAt: _drop2, ...rest } = item;
          await ctx.db.patch(match._id, rest);
          continue;
        }
        await ctx.db.patch(match._id, {
          ...item,
          replyStatus: item.replyText ? "published" : "none",
          replyNeedsApproval: undefined,
        });
        continue;
      }
      const replyStatus = item.replyText ? "published" : "none";
      await ctx.db.insert("reviews", { businessId, ...item, replyStatus });
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
  ): Promise<{ added: number; total: number; average: number | null }> => {
    const business = await ctx.runQuery(internal.google.businessForUser, {
      userId,
    });
    if (!business?.gbpAccountName || !business.gbpLocationName) {
      throw new Error("No Google listing linked.");
    }

    const token: string = await ctx.runAction(internal.google.accessTokenFor, {
      userId,
    });

    const locationId = business.gbpLocationName.replace(/^locations\//, "");
    const parent = `${business.gbpAccountName}/locations/${locationId}`;

    // Google pages these 50 at a time. A clinic with 300 reviews is exactly
    // the shop that needs them all, so walk the pages rather than taking
    // the first one and calling it the total.
    const raw: any[] = [];
    let pageToken: string | undefined;
    let reported: number | null = null;

    for (let page = 0; page < 12; page++) {
      const url =
        `${V4_BASE}/${parent}/reviews?pageSize=50` +
        (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const text = await res.text();
      if (!res.ok) {
        console.error(`[gbp/reviews] ${res.status} ${text.slice(0, 400)}`);
        if (page > 0) break; // keep what we already have
        throw new Error(
          `Google refused (${res.status}): ${text.slice(0, 200)}`,
        );
      }

      const page_ = JSON.parse(text || "{}");
      if (reported === null && typeof page_.totalReviewCount === "number") {
        reported = page_.totalReviewCount;
      }
      raw.push(...(page_.reviews ?? []));

      pageToken = page_.nextPageToken;
      if (!pageToken) break;
    }

    console.log(
      `[gbp/reviews] pulled ${raw.length}${reported ? ` of ${reported}` : ""}`,
    );

    const data = { reviews: raw };
    const items = (data.reviews ?? [])
      .filter((r: any) => r?.name)
      .map((r: any) => ({
        gbpReviewName: String(r.name),
        authorName: r.reviewer?.displayName
          ? String(r.reviewer.displayName)
          : undefined,
        authorPhoto: r.reviewer?.profilePhotoUrl
          ? String(r.reviewer.profilePhotoUrl)
          : undefined,
        rating: STAR_VALUES[String(r.starRating)] ?? 0,
        comment: r.comment ? String(r.comment) : undefined,
        createdAt: r.createTime ? Date.parse(r.createTime) : Date.now(),
        replyText: r.reviewReply?.comment
          ? String(r.reviewReply.comment)
          : undefined,
        repliedAt: r.reviewReply?.updateTime
          ? Date.parse(r.reviewReply.updateTime)
          : undefined,
      }))
      .filter((r: any) => r.rating > 0);

    const added: number = await ctx.runMutation(internal.reviews.saveReviews, {
      businessId: business._id,
      items,
    });

    const average =
      items.length > 0
        ? Math.round(
            (items.reduce((t: number, r: any) => t + r.rating, 0) /
              items.length) *
              10,
          ) / 10
        : null;

    return { added, total: items.length, average };
  },
});

export const unrepliedFor = internalQuery({
  args: { businessId: v.id("businesses") },
  handler: async (ctx, { businessId }) =>
    await ctx.db
      .query("reviews")
      .withIndex("by_business_reply", (q) =>
        q.eq("businessId", businessId).eq("replyStatus", "none"),
      )
      .collect(),
});

/** What the owner presses, and what the page calls on open. */
export const syncFromGoogle = paidAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{ added: number; total: number; average: number | null }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    return await ctx.runAction(internal.reviews.syncForUser, { userId });
  },
});

/**
 * Pulls every connected shop's reviews overnight.
 *
 * A review that arrives on Tuesday and is first seen on Friday is three
 * days of silence the customer can read. Google's own guidance is to reply
 * quickly, so we need them without waiting for the owner to open the app.
 */
export const syncAllReviews = internalAction({
  args: {},
  handler: async (ctx): Promise<{ businesses: number; added: number }> => {
    const businesses: { userId: Id<"users">; name: string }[] =
      await ctx.runQuery(internal.performance.connectedBusinesses, {});

    let added = 0;
    for (const b of businesses) {
      try {
        const r = await ctx.runAction(internal.reviews.syncForUser, {
          userId: b.userId,
        });
        added += r.added;

        // Answer straight away rather than on the next pass — the whole
        // point of syncing every four hours is replying inside the day.
        await ctx.runAction(internal.reviews.answerNewReviews, {
          userId: b.userId,
        });
      } catch (error) {
        console.error(`[agent] review sync failed for ${b.name}`, error);
      }
    }
    return { businesses: businesses.length, added };
  },
});

/* ------------------------------ ai replies ------------------------------
   Replying is the cheapest ranking work a small shop can do. Businesses
   answering three quarters of their reviews sit around two positions higher
   in the local pack than those answering almost none, and answering inside
   a day is worth about another position and a half over answering in a
   week. Google lists it in its own ranking tips.

   The catch is that people can tell. Templated replies cost trust, so every
   reply here is written against the actual review, and the shop's last few
   replies go into the prompt so no two open the same way.

   Praise is answered automatically. A complaint is drafted and held: a
   wrong word under a business's own name is a public liability, and for a
   clinic more so.                                                         */

/** Anything the shop hasn't answered, plus what it needs to answer well. */
export const replyContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business) return null;

    const [reviews, offerings] = await Promise.all([
      ctx.db
        .query("reviews")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
      ctx.db
        .query("offerings")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
    ]);

    // The shop's own recent replies, so the next one doesn't echo them.
    const recentReplies = reviews
      .filter((r) => r.replyText)
      .sort((a, b) => (b.repliedAt ?? 0) - (a.repliedAt ?? 0))
      .slice(0, 5)
      .map((r) => r.replyText as string);

    return {
      business,
      offerings: offerings.filter((o) => o.selected).map((o) => o.label),
      recentReplies,
      pending: reviews
        .filter((r) => r.replyStatus === "none" && r.gbpReviewName)
        .sort((a, b) => b.createdAt - a.createdAt),
    };
  },
});

export const reviewById = internalQuery({
  args: { id: v.id("reviews") },
  handler: async (ctx, { id }) => await ctx.db.get(id),
});

export const saveDraft = internalMutation({
  args: {
    id: v.id("reviews"),
    replyText: v.string(),
    needsApproval: v.boolean(),
  },
  handler: async (ctx, { id, replyText, needsApproval }) => {
    await ctx.db.patch(id, {
      replyText,
      replyStatus: "drafted",
      replyNeedsApproval: needsApproval,
      replyDraftedAt: Date.now(),
      replyError: undefined,
    });
  },
});

export const markReplied = internalMutation({
  args: {
    id: v.id("reviews"),
    replyText: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { id, replyText, error }) => {
    const review = await ctx.db.get(id);
    if (!review) return;

    if (error) {
      await ctx.db.patch(id, { replyStatus: "failed", replyError: error });
      return;
    }

    await ctx.db.patch(id, {
      replyStatus: "published",
      repliedAt: Date.now(),
      replyNeedsApproval: undefined,
      replyError: undefined,
      ...(replyText ? { replyText } : {}),
    });

    await ctx.db.insert("agentActions", {
      businessId: review.businessId,
      type: "review_reply",
      title: `Replied to ${review.authorName ?? "a customer"}`,
      detail: (replyText ?? review.replyText ?? "").slice(0, 160),
      createdAt: Date.now(),
    });
  },
});

/** Writes one reply. Returns null rather than guessing when it can't. */
export const draftReply = internalAction({
  args: { reviewId: v.id("reviews"), userId: v.id("users") },
  handler: async (ctx, { reviewId, userId }): Promise<string | null> => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    const review = await ctx.runQuery(internal.reviews.reviewById, {
      id: reviewId,
    });
    const c = await ctx.runQuery(internal.reviews.replyContext, { userId });
    if (!review || !c) return null;

    // Google hands names back however the customer typed them — "rahul",
    // "SHEKHAR". Addressing someone in their own miscasing reads as sloppy.
    const rawFirst = (review.authorName ?? "").trim().split(/\s+/)[0] ?? "";
    const firstName = rawFirst
      ? rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase()
      : "";
    const happy = review.rating >= 4;

    // A four or five star review can still carry a complaint. Answering it
    // as pure praise reads as not having read it.
    const grumble =
      happy &&
      Boolean(review.comment) &&
      /but |however|only issue|one problem|wish |waited|delay|expensive|costly|slow|late|rude|dirty/i.test(
        review.comment ?? "",
      );
    const medical = /dent|clinic|doctor|hospital|medical|physio|diagnost/i.test(
      c.business.primaryCategory ?? c.business.orgName,
    );

    const prompt = [
      `Business: ${c.business.orgName}`,
      c.business.primaryCategory
        ? `Category: ${c.business.primaryCategory}`
        : "",
      c.business.city ? `Locality: ${c.business.city}` : "",
      c.offerings.length ? `What they do: ${c.offerings.join(", ")}` : "",
      "",
      `A customer left ${review.rating} out of 5${firstName ? `, name: ${firstName}` : ""}.`,
      review.comment
        ? `They wrote: "${review.comment}"`
        : "They left a rating with no words.",
      c.recentReplies.length
        ? `\nThe shop's last replies — open differently and do not reuse their phrasing:\n- ${c.recentReplies
            .map((r) => r.slice(0, 160))
            .join("\n- ")}`
        : "",
      "",
      "Write the owner's public reply to this review.",
      "",
      "Rules:",
      "- Plain Indian English, warm, in the owner's own voice. Never corporate.",
      firstName ? `- Open by name: ${firstName}.` : "- Do not invent a name.",
      review.comment
        ? "- Repeat back the specific thing they praised or raised, in your own words. The next customer reads this reply, so their point is worth amplifying. Do not summarise the whole review."
        : "- They wrote nothing, so keep it to two short lines. There is nothing to personalise, and padding an empty rating into a paragraph reads as fake.",
      "- If they named a member of staff, name that person too and pass the thanks on.",
      review.comment
        ? happy
          ? "- 50 to 75 words. Long enough to say something real, never padded."
          : "- One paragraph, under 90 words. A short, calm reply reads as confident; an essay reads as defensive."
        : "- 20 to 35 words.",
      `- Name the business once, naturally. ${c.business.city ? `You may name ${c.business.city} once if it fits.` : ""}`,
      "- Never repeat a search phrase or stuff in service names. The reader is the next customer, not a search engine.",
      "- Do not invent prices, offers, timings, results, or anything you were not told.",
      medical
        ? "- IMPORTANT: this is a public page. Never introduce, confirm or add any clinical detail — a treatment, a condition, a procedure, an outcome — that the customer did not already write themselves. You may echo their own words back. You may not add to them."
        : "",
      grumble
        ? "- They rated you well but raised something that fell short. Thank them for the rating AND answer the point they raised. Do not skip past it."
        : "",
      happy
        ? "- Thank them properly and invite them back once, briefly."
        : [
            "- This is a complaint. Never argue, never make excuses, never blame the customer.",
            "- Acknowledge their experience, say plainly that you're sorry it fell short,",
            "  and offer to put it right by talking directly. Do not promise a refund",
            "  or any specific remedy.",
            "- No marketing of any kind.",
          ].join("\n"),
      "- No hashtags, no emoji, no exclamation marks, no ALL CAPS.",
      "- Google already labels this 'Response from the owner', so do not sign it or introduce yourself. Write as 'we'.",
      "- Reply with the message only. No greeting labels, no sign-off block.",
      "",
      'Reply with JSON: {"reply": "..."}',
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.7,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        console.error(`[reviews] draft ${res.status}`);
        return null;
      }

      const body = await res.json();
      const text = String(
        JSON.parse(body.choices?.[0]?.message?.content ?? "{}").reply ?? "",
      ).trim();
      // Google caps a reply at 4096 characters; we are nowhere near, but a
      // runaway generation shouldn't reach the API at all.
      return text ? text.slice(0, 1500) : null;
    } catch (error) {
      console.error("[reviews] draft failed", error);
      return null;
    }
  },
});

/** Puts a reply on the review itself, on Google. */
export const pushReply = internalAction({
  args: {
    reviewId: v.id("reviews"),
    userId: v.id("users"),
    text: v.string(),
  },
  handler: async (
    ctx,
    { reviewId, userId, text },
  ): Promise<{ ok: boolean; error?: string }> => {
    const review = await ctx.runQuery(internal.reviews.reviewById, {
      id: reviewId,
    });
    if (!review?.gbpReviewName) {
      return { ok: false, error: "That review is no longer on Google." };
    }

    const token: string = await ctx.runAction(internal.google.accessTokenFor, {
      userId,
    });

    const res = await fetch(`${V4_BASE}/${review.gbpReviewName}/reply`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ comment: text }),
    });

    const body = await res.text();
    if (!res.ok) {
      console.error(`[reviews/reply] ${res.status} ${body.slice(0, 400)}`);
      const message = `Google refused (${res.status}): ${body.slice(0, 200)}`;
      await ctx.runMutation(internal.reviews.markReplied, {
        id: reviewId,
        error: message,
      });
      return { ok: false, error: message };
    }

    await ctx.runMutation(internal.reviews.markReplied, {
      id: reviewId,
      replyText: text,
    });
    return { ok: true };
  },
});

/**
 * Answers what has come in since the last run.
 *
 * Capped per run on purpose. Fifteen replies appearing in the same minute
 * reads as a machine to anyone scrolling the listing, which is the one
 * thing this is meant to avoid.
 */
const REPLIES_PER_RUN = 5;

export const answerNewReviews = internalAction({
  args: { userId: v.id("users") },
  handler: async (
    ctx,
    { userId },
  ): Promise<{ published: number; held: number }> => {
    const c = await ctx.runQuery(internal.reviews.replyContext, { userId });
    if (!c || !c.business.agentActive) return { published: 0, held: 0 };

    let published = 0;
    let held = 0;

    for (const review of c.pending.slice(0, REPLIES_PER_RUN)) {
      const text: string | null = await ctx.runAction(
        internal.reviews.draftReply,
        { reviewId: review._id, userId },
      );
      if (!text) continue;

      // Four stars and up goes out on its own; speed is where the value is.
      // Anything lower waits for a person.
      const needsApproval = review.rating <= 3;
      await ctx.runMutation(internal.reviews.saveDraft, {
        id: review._id,
        replyText: text,
        needsApproval,
      });

      if (needsApproval) {
        held += 1;
        continue;
      }

      const r = await ctx.runAction(internal.reviews.pushReply, {
        reviewId: review._id,
        userId,
        text,
      });
      if (r.ok) published += 1;
    }

    if (held > 0) {
      await ctx.runMutation(internal.reviews.noteHeld, {
        businessId: c.business._id,
        held,
      });
    }

    return { published, held };
  },
});

export const noteHeld = internalMutation({
  args: { businessId: v.id("businesses"), held: v.number() },
  handler: async (ctx, { businessId, held }) => {
    await ctx.db.insert("agentActions", {
      businessId,
      type: "review_reply",
      title: `${held} review${held === 1 ? "" : "s"} need${held === 1 ? "s" : ""} your eyes`,
      detail:
        "We've written a reply, but a low rating goes out under your name only when you say so.",
      createdAt: Date.now(),
    });
  },
});

/* ---------------------------- what the owner does ----------------------- */

/** Sends a held reply, with any edits the owner made. */
export const approveReply = paidAction({
  args: { id: v.id("reviews"), text: v.optional(v.string()) },
  handler: async (
    ctx,
    { id, text },
  ): Promise<{ ok: boolean; error?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const review = await ctx.runQuery(internal.reviews.reviewById, { id });
    const body = (text ?? review?.replyText ?? "").trim();
    if (!body) return { ok: false, error: "There's nothing to send." };

    return await ctx.runAction(internal.reviews.pushReply, {
      reviewId: id,
      userId,
      text: body,
    });
  },
});

/** Writes a different draft for the same review. */
export const rewriteReply = paidAction({
  args: { id: v.id("reviews") },
  handler: async (ctx, { id }): Promise<string | null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const text: string | null = await ctx.runAction(
      internal.reviews.draftReply,
      { reviewId: id, userId },
    );
    if (!text) return null;

    const review = await ctx.runQuery(internal.reviews.reviewById, { id });
    await ctx.runMutation(internal.reviews.saveDraft, {
      id,
      replyText: text,
      needsApproval: (review?.rating ?? 5) <= 3,
    });
    return text;
  },
});

/** Puts a review back to unanswered, so nothing goes out. */
export const discardDraft = paidMutation({
  args: { id: v.id("reviews") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    await ctx.db.patch(id, {
      replyText: undefined,
      replyStatus: "none",
      replyNeedsApproval: undefined,
      replyDraftedAt: undefined,
    });
  },
});

/** The owner pressing "reply to everything waiting". */
export const answerNow = paidAction({
  args: {},
  handler: async (ctx): Promise<{ published: number; held: number }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    return await ctx.runAction(internal.reviews.answerNewReviews, { userId });
  },
});
