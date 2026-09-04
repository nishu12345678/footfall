/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterAll, beforeEach, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import {
  MOCK_ACCOUNT,
  MOCK_LOCATION,
  handleGoogleMock,
  resetGoogleMock,
} from "../lib/google-mock";

/**
 * The fake Google, driven by the real Convex code.
 *
 * Every function here that talks to Google is run against
 * lib/google-mock.ts with `fetch` routed straight into the handler. If a
 * shape the mock returns drifts from what the parsers expect, this is
 * where it shows — and it doubles as the only end-to-end run of connect,
 * sync, publish, reply and token refresh that exists without a listing.
 */

const MOCK_BASE = "http://google.mock/api/mock/google";

// The hosts module reads this when it is first loaded, which convex-test
// does lazily, after this line has run.
vi.stubEnv("GOOGLE_API_MOCK_URL", MOCK_BASE);
afterAll(() => vi.unstubAllEnvs());

const modules = import.meta.glob("./**/*.ts");
type T = ReturnType<typeof convexTest<typeof schema.tables>>;

/** A fetch that answers from the mock, and refuses anything else. */
function routeFetchToMock() {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      if (!url.startsWith(MOCK_BASE)) {
        throw new Error(`unexpected network call: ${url}`);
      }
      const u = new URL(url);
      const path = u.pathname.slice(new URL(MOCK_BASE).pathname.length);
      const headers = new Headers(init?.headers);
      const method = init?.method ?? "GET";

      let body: unknown = null;
      if (typeof init?.body === "string") {
        body = headers
          .get("content-type")
          ?.includes("application/x-www-form-urlencoded")
          ? Object.fromEntries(new URLSearchParams(init.body))
          : JSON.parse(init.body);
      } else if (init?.body instanceof URLSearchParams) {
        body = Object.fromEntries(init.body);
      }

      const res = handleGoogleMock({
        method,
        path,
        query: u.searchParams,
        body,
        bearer: headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null,
        origin: MOCK_BASE,
      });
      return new Response(JSON.stringify(res.body), {
        status: res.status,
        headers: { "content-type": "application/json" },
      });
    }),
  );
  return calls;
}

let t: T;
let userId: Id<"users">;
let calls: string[];

beforeEach(async () => {
  resetGoogleMock();
  calls = routeFetchToMock();
  t = convexTest(schema, modules);
  userId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("users", { name: "Owner" });
    await ctx.db.insert("googleAccounts", {
      userId: id,
      accessToken: "seed-token",
      refreshToken: "seed-refresh",
      expiresAt: Date.now() + 3_600_000,
      scope: "https://www.googleapis.com/auth/business.manage",
    });
    return id;
  });
});

const me = () => t.withIdentity({ subject: `${userId}|session` });

/**
 * Connect, the way the processing page does it. Linking schedules a read
 * of the whole listing; waiting for it here means every test starts from
 * the state a real owner sees after connecting.
 */
async function connect() {
  const found = await me().action(api.google.listLocations, {});
  await me().action(api.google.linkLocation, { location: found[0] });
  await t.finishAllScheduledFunctions(() => {});
  return found;
}

const business = () =>
  t.run(async (ctx) =>
    ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first(),
  );

const count = (table: "reviews" | "photos" | "posts" | "metrics") =>
  t.run(async (ctx) => (await ctx.db.query(table).collect()).length);

test("connect: the listing is found, linked and read in full", async () => {
  const found = await connect();
  expect(found).toHaveLength(1);
  expect(found[0].title).toBe("Glow Salon");
  expect(found[0].city).toBe("Thane");
  expect(found[0].categoryId).toBe("gcid:beauty_salon");

  const b = await business();
  expect(b?.gbpAccountName).toBe(MOCK_ACCOUNT);
  expect(b?.gbpLocationName).toBe(MOCK_LOCATION);
  expect(b?.lat).toBeCloseTo(19.2183);

  // The scheduled listing sync has run: the report is built on real rows.
  expect(b?.listingSyncedAt).toBeGreaterThan(0);
  expect(await count("reviews")).toBe(8);
  expect(await count("photos")).toBe(6);
  expect(await count("posts")).toBe(2);
  expect(await count("metrics")).toBeGreaterThanOrEqual(30);
});

test("sync: a second pass parses everything and adds nothing", async () => {
  await connect();

  const reviews = await t.action(internal.reviews.syncForUser, { userId });
  expect(reviews).toMatchObject({ added: 0, total: 8 });
  expect(reviews.average).toBeGreaterThan(3);
  const unreplied = await t.run(async (ctx) =>
    (await ctx.db.query("reviews").collect()).filter(
      (r) => r.replyStatus === "none",
    ),
  );
  expect(unreplied).toHaveLength(4);

  const photos = await t.action(internal.photos.syncForUser, { userId });
  expect(photos).toMatchObject({ added: 0, total: 6 });
  const firstPhoto = await t.run(async (ctx) =>
    ctx.db.query("photos").first(),
  );
  expect(firstPhoto?.url).toMatch(/\/img\/glow-[a-z]+=w1600$/);

  const posts = await t.action(internal.posts.syncFromGoogleForUser, {
    userId,
  });
  expect(posts).toMatchObject({ added: 0, total: 2 });

  const perf = await t.action(internal.performance.syncMetricsForUser, {
    userId,
    days: 30,
  });
  expect(perf.days).toBeGreaterThanOrEqual(30);
  expect(perf.views).toBeGreaterThan(0);
  expect(perf.calls).toBeGreaterThan(0);
});

test("publish: a post goes up and comes back in the next sync", async () => {
  await connect();
  const b = await business();
  const postId = await t.run(async (ctx) =>
    ctx.db.insert("posts", {
      businessId: b!._id,
      body: "Festive offer: 20% off all hair spa bookings this week.",
      status: "draft",
      generatedBy: "user",
    }),
  );

  const result = await t.action(internal.posts.pushToGoogle, {
    postId,
    userId,
  });
  expect(result.ok).toBe(true);
  expect(result.name).toMatch(/localPosts\/p3$/);
  expect((await t.run(async (ctx) => ctx.db.get(postId)))?.status).toBe(
    "published",
  );

  // Google now lists three; ours is already known by its Google name.
  const synced = await t.action(internal.posts.syncFromGoogleForUser, {
    userId,
  });
  expect(synced).toMatchObject({ added: 0, total: 3 });
});

test("reply: a reply lands on the review on Google's side", async () => {
  await connect();
  const target = await t.run(async (ctx) =>
    (await ctx.db.query("reviews").collect()).find(
      (r) => r.authorName === "Priya Sharma",
    ),
  );
  expect(target?.replyStatus).toBe("none");

  const result = await t.action(internal.reviews.pushReply, {
    reviewId: target!._id,
    userId,
    text: "Thank you Priya, Sunita will be thrilled to hear this.",
  });
  expect(result.ok).toBe(true);

  // Google is the truth for replies; a re-sync must agree with what we sent.
  await t.action(internal.reviews.syncForUser, { userId });
  const after = await t.run(async (ctx) => ctx.db.get(target!._id));
  expect(after?.replyStatus).toBe("published");
  expect(after?.replyText).toContain("Thank you Priya");
});

test("token: an expired access token is refreshed through the mock", async () => {
  await t.run(async (ctx) => {
    const account = await ctx.db
      .query("googleAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    await ctx.db.patch(account!._id, { expiresAt: Date.now() - 1000 });
  });

  const token = await t.action(internal.google.accessTokenFor, { userId });
  expect(token).toBe("mock-access-1");
  expect(calls.some((u) => u.endsWith("/oauth2/token"))).toBe(true);

  const stored = await t.run(async (ctx) =>
    ctx.db
      .query("googleAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first(),
  );
  expect(stored?.accessToken).toBe("mock-access-1");
  expect(stored?.expiresAt).toBeGreaterThan(Date.now());
});

test("revoked: calls get 401 and refresh fails like invalid_grant", async () => {
  await connect();
  handleGoogleMock({
    method: "POST",
    path: "_control/revoke",
    query: new URLSearchParams(),
    body: null,
    bearer: null,
    origin: MOCK_BASE,
  });

  await expect(
    t.action(internal.reviews.syncForUser, { userId }),
  ).rejects.toThrow(/401/);

  await t.run(async (ctx) => {
    const account = await ctx.db
      .query("googleAccounts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    await ctx.db.patch(account!._id, { expiresAt: Date.now() - 1000 });
  });
  await expect(
    t.action(internal.google.accessTokenFor, { userId }),
  ).rejects.toThrow(/reconnect/i);
});
