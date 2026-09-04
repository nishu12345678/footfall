/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

/**
 * Two shops, two owners, both paying. Every client-callable function that
 * takes a row id must refuse the other shop's id — and must refuse it the
 * same way whether the row is someone else's or does not exist at all, so
 * the API never confirms which ids are real.
 *
 * The actions that talk to Google or OpenAI are checked with `fetch`
 * stubbed: a refused call must make no network request at all.
 */

const modules = import.meta.glob("./**/*.ts");

const DAY = 24 * 60 * 60 * 1000;
const REFUSED = /not found/i;

type Shop = {
  userId: Id<"users">;
  businessId: Id<"businesses">;
  postId: Id<"posts">;
  photoId: Id<"photos">;
  reviewId: Id<"reviews">;
  keywordId: Id<"keywords">;
  areaId: Id<"serviceAreas">;
  offeringId: Id<"offerings">;
};

type T = ReturnType<typeof convexTest<typeof schema.tables>>;

async function seedShop(t: T, label: string): Promise<Shop> {
  return await t.run(async (ctx) => {
    const now = Date.now();
    const userId = await ctx.db.insert("users", { name: label });
    const businessId = await ctx.db.insert("businesses", {
      userId,
      orgName: `${label} shop`,
      city: "Thane",
      gbpAccountName: `accounts/${label}`,
      gbpLocationName: `locations/${label}`,
      onboardingStep: 5,
      onboardingComplete: true,
      agentActive: true,
    });
    await ctx.db.insert("subscriptions", {
      userId,
      plan: "monthly",
      amountPaise: 199_900,
      currency: "INR",
      razorpayOrderId: `order_${label}`,
      status: "paid",
      paidAt: now,
      startsAt: now,
      expiresAt: now + 30 * DAY,
    });
    await ctx.db.insert("googleAccounts", {
      userId,
      businessId,
      accessToken: `token-${label}`,
      refreshToken: `refresh-${label}`,
      expiresAt: now + DAY,
      scope: "https://www.googleapis.com/auth/business.manage",
    });
    const postId = await ctx.db.insert("posts", {
      businessId,
      body: `${label} post`,
      status: "draft",
      generatedBy: "user",
    });
    const photoId = await ctx.db.insert("photos", {
      businessId,
      url: `https://example.com/${label}.jpg`,
      mediaType: "photo",
      status: "bucket",
    });
    const reviewId = await ctx.db.insert("reviews", {
      businessId,
      gbpReviewName: `accounts/${label}/locations/${label}/reviews/1`,
      authorName: "Priya",
      rating: 5,
      comment: "Lovely service.",
      createdAt: now,
      replyText: `${label} draft reply`,
      replyStatus: "drafted",
    });
    const keywordId = await ctx.db.insert("keywords", {
      businessId,
      term: `${label} keyword`,
      targeted: true,
    });
    const areaId = await ctx.db.insert("serviceAreas", {
      businessId,
      name: `${label} area`,
    });
    const offeringId = await ctx.db.insert("offerings", {
      businessId,
      label: `${label} offering`,
      source: "user",
      selected: true,
    });
    return {
      userId,
      businessId,
      postId,
      photoId,
      reviewId,
      keywordId,
      areaId,
      offeringId,
    };
  });
}

/** Convex Auth encodes the session subject as `<userId>|<sessionId>`. */
function signedInAs(t: T, shop: Shop) {
  return t.withIdentity({ subject: `${shop.userId}|session` });
}

/** A fetch that answers like Google and OpenAI would, and remembers calls. */
function stubFetch() {
  const calls: string[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    let body: unknown = {};
    if (url.includes("/localPosts")) {
      body = { name: "accounts/x/locations/x/localPosts/1" };
    } else if (url.includes("openai.com")) {
      body = {
        choices: [
          { message: { content: JSON.stringify({ reply: "Thank you." }) } },
        ],
      };
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

let t: T;
let a: Shop;
let b: Shop;
let calls: string[];

beforeEach(async () => {
  t = convexTest(schema, modules);
  a = await seedShop(t, "A");
  b = await seedShop(t, "B");
  calls = stubFetch();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const get = <Tbl extends "posts" | "photos" | "reviews" | "keywords" | "serviceAreas" | "offerings">(
  id: Id<Tbl>,
) => t.run(async (ctx) => await ctx.db.get(id));

/* ------------------------------ mutations ------------------------------- */

describe("mutations refuse another shop's row", () => {
  test("posts.updateDraft", async () => {
    await expect(
      signedInAs(t, a).mutation(api.posts.updateDraft, {
        id: b.postId,
        body: "rewritten by A",
      }),
    ).rejects.toThrow(REFUSED);
    expect((await get(b.postId))?.body).toBe("B post");
  });

  test("posts.removePost", async () => {
    await expect(
      signedInAs(t, a).mutation(api.posts.removePost, { id: b.postId }),
    ).rejects.toThrow(REFUSED);
    expect(await get(b.postId)).not.toBeNull();
  });

  test("photos.removePhoto", async () => {
    await expect(
      signedInAs(t, a).mutation(api.photos.removePhoto, { id: b.photoId }),
    ).rejects.toThrow(REFUSED);
    expect(await get(b.photoId)).not.toBeNull();
  });

  test("reviews.discardDraft", async () => {
    await expect(
      signedInAs(t, a).mutation(api.reviews.discardDraft, { id: b.reviewId }),
    ).rejects.toThrow(REFUSED);
    const review = await get(b.reviewId);
    expect(review?.replyStatus).toBe("drafted");
    expect(review?.replyText).toBe("B draft reply");
  });

  test("gbp.removeKeyword", async () => {
    await expect(
      signedInAs(t, a).mutation(api.gbp.removeKeyword, { id: b.keywordId }),
    ).rejects.toThrow(REFUSED);
    expect(await get(b.keywordId)).not.toBeNull();
  });

  test("gbp.removeServiceArea", async () => {
    await expect(
      signedInAs(t, a).mutation(api.gbp.removeServiceArea, { id: b.areaId }),
    ).rejects.toThrow(REFUSED);
    expect(await get(b.areaId)).not.toBeNull();
  });

  test("about.remove", async () => {
    await expect(
      signedInAs(t, a).mutation(api.about.remove, {
        kind: "offerings",
        id: b.offeringId,
      }),
    ).rejects.toThrow(REFUSED);
    expect(await get(b.offeringId)).not.toBeNull();
  });
});

describe("a missing row is refused the same way as someone else's", () => {
  test("posts.removePost on a deleted id", async () => {
    await t.run(async (ctx) => await ctx.db.delete(a.postId));
    await expect(
      signedInAs(t, a).mutation(api.posts.removePost, { id: a.postId }),
    ).rejects.toThrow(REFUSED);
  });

  test("about.remove on a malformed id", async () => {
    await expect(
      signedInAs(t, a).mutation(api.about.remove, {
        kind: "offerings",
        id: "not-an-id",
      }),
    ).rejects.toThrow(REFUSED);
  });
});

/* ------------------------------- actions -------------------------------- */

describe("actions refuse another shop's row before touching the network", () => {
  test("posts.publishPost", async () => {
    await expect(
      signedInAs(t, a).action(api.posts.publishPost, { id: b.postId }),
    ).rejects.toThrow(REFUSED);
    expect(calls).toEqual([]);
    expect((await get(b.postId))?.status).toBe("draft");
  });

  test("photos.publishPhoto", async () => {
    await expect(
      signedInAs(t, a).action(api.photos.publishPhoto, { id: b.photoId }),
    ).rejects.toThrow(REFUSED);
    expect(calls).toEqual([]);
    expect((await get(b.photoId))?.status).toBe("bucket");
  });

  test("reviews.approveReply", async () => {
    await expect(
      signedInAs(t, a).action(api.reviews.approveReply, {
        id: b.reviewId,
        text: "A speaking for B",
      }),
    ).rejects.toThrow(REFUSED);
    expect(calls).toEqual([]);
    expect((await get(b.reviewId))?.replyStatus).toBe("drafted");
  });

  test("reviews.rewriteReply", async () => {
    await expect(
      signedInAs(t, a).action(api.reviews.rewriteReply, { id: b.reviewId }),
    ).rejects.toThrow(REFUSED);
    expect(calls).toEqual([]);
    expect((await get(b.reviewId))?.replyText).toBe("B draft reply");
  });
});

/* ------------------------------ the owner ------------------------------- */

describe("the owner's own path is unchanged", () => {
  test("mutations act on the owner's rows", async () => {
    const me = signedInAs(t, a);

    await me.mutation(api.posts.updateDraft, { id: a.postId, body: "edited" });
    expect((await get(a.postId))?.body).toBe("edited");

    await me.mutation(api.reviews.discardDraft, { id: a.reviewId });
    expect((await get(a.reviewId))?.replyStatus).toBe("none");

    await me.mutation(api.posts.removePost, { id: a.postId });
    await me.mutation(api.photos.removePhoto, { id: a.photoId });
    await me.mutation(api.gbp.removeKeyword, { id: a.keywordId });
    await me.mutation(api.gbp.removeServiceArea, { id: a.areaId });
    await me.mutation(api.about.remove, { kind: "offerings", id: a.offeringId });

    expect(await get(a.postId)).toBeNull();
    expect(await get(a.photoId)).toBeNull();
    expect(await get(a.keywordId)).toBeNull();
    expect(await get(a.areaId)).toBeNull();
    expect(await get(a.offeringId)).toBeNull();

    // B is untouched by any of it.
    expect(await get(b.postId)).not.toBeNull();
    expect(await get(b.offeringId)).not.toBeNull();
  });

  test("posts.publishPost sends the owner's post to the owner's listing", async () => {
    const result = await signedInAs(t, a).action(api.posts.publishPost, {
      id: a.postId,
    });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("accounts/A/locations/A/localPosts");
    expect((await get(a.postId))?.status).toBe("published");
  });

  test("photos.publishPhoto sends the owner's photo to the owner's listing", async () => {
    const result = await signedInAs(t, a).action(api.photos.publishPhoto, {
      id: a.photoId,
    });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("accounts/A/locations/A/media");
    expect((await get(a.photoId))?.status).toBe("published");
  });

  test("reviews.approveReply replies on the owner's review", async () => {
    const result = await signedInAs(t, a).action(api.reviews.approveReply, {
      id: a.reviewId,
    });
    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("accounts/A/locations/A/reviews/1/reply");
    expect((await get(a.reviewId))?.replyStatus).toBe("published");
  });

  test("reviews.rewriteReply drafts for the owner's review", async () => {
    const text = await signedInAs(t, a).action(api.reviews.rewriteReply, {
      id: a.reviewId,
    });
    expect(text).toBe("Thank you.");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("openai.com");
    expect((await get(a.reviewId))?.replyText).toBe("Thank you.");
  });
});
