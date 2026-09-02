import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { hasActivePlan } from "./access";

/* ---------------------------------------------------------------------------
   The free report.

   A free user connects their Google Business Profile and gets the truth about
   it — nothing else. No onboarding, no agent, nothing published. Everything
   here is read from what we already synced from Google, so it costs nothing
   to produce and cannot be wrong in the shop's favour.

   Deliberately NOT behind the paywall: this is the thing that shows somebody
   why the paywall is worth crossing.
--------------------------------------------------------------------------- */

const DAY = 24 * 60 * 60 * 1000;

/** Google's own guidance and what actually moves the local pack. */
const GOOD_PHOTO_COUNT = 30;
const GOOD_REVIEW_COUNT = 25;

type Severity = "critical" | "warn" | "good";

type Finding = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  /** What footfall does about it once they are on a plan. */
  fix: string;
};

export const report = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // Not connected yet — the UI sends them to /app/connect.
    if (!business) return { connected: false as const };

    const id = business._id;
    const [posts, photos, reviews, keywords, hours, offerings, siteCheck] =
      await Promise.all([
        ctx.db
          .query("posts")
          .withIndex("by_business", (q) => q.eq("businessId", id))
          .collect(),
        ctx.db
          .query("photos")
          .withIndex("by_business", (q) => q.eq("businessId", id))
          .collect(),
        ctx.db
          .query("reviews")
          .withIndex("by_business", (q) => q.eq("businessId", id))
          .collect(),
        ctx.db
          .query("keywords")
          .withIndex("by_business", (q) => q.eq("businessId", id))
          .collect(),
        ctx.db
          .query("businessHours")
          .withIndex("by_business", (q) => q.eq("businessId", id))
          .collect(),
        ctx.db
          .query("offerings")
          .withIndex("by_business", (q) => q.eq("businessId", id))
          .collect(),
        ctx.db
          .query("websiteChecks")
          .withIndex("by_business", (q) => q.eq("businessId", id))
          .order("desc")
          .first(),
      ]);

    const now = Date.now();
    const findings: Finding[] = [];

    /* ------------------------------ posts ------------------------------ */

    const published = posts
      .filter((p) => p.status === "published" && p.publishedAt)
      .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));
    const lastPostAt = published[0]?.publishedAt ?? null;
    const daysSincePost = lastPostAt
      ? Math.floor((now - lastPostAt) / DAY)
      : null;

    if (daysSincePost === null) {
      findings.push({
        id: "posts",
        severity: "critical",
        title: "You have never posted on Google",
        detail:
          "Google gives a listing that posts regularly more room in the local pack. Yours has no posts at all, so it looks dormant next to the shop two streets over.",
        fix: "footfall writes and publishes a post every week, about your real services and your real prices.",
      });
    } else if (daysSincePost > 30) {
      findings.push({
        id: "posts",
        severity: "critical",
        title: `Your last Google post was ${daysSincePost} days ago`,
        detail:
          "A Google post loses most of its weight after about a week. Anything older than a month is doing nothing for you.",
        fix: "footfall keeps a post going up every week, without you remembering.",
      });
    } else {
      findings.push({
        id: "posts",
        severity: "good",
        title: "You are posting on Google",
        detail: `Last post was ${daysSincePost} day${daysSincePost === 1 ? "" : "s"} ago. Keep that rhythm.`,
        fix: "footfall keeps it going every week so it never lapses.",
      });
    }

    /* ----------------------------- reviews ----------------------------- */

    const unanswered = reviews.filter(
      (r) => r.replyStatus !== "published",
    ).length;
    const negativeUnanswered = reviews.filter(
      (r) => r.replyStatus !== "published" && r.rating <= 3,
    ).length;

    if (unanswered > 0) {
      findings.push({
        id: "review-replies",
        severity: negativeUnanswered > 0 ? "critical" : "warn",
        title: `${unanswered} review${unanswered === 1 ? "" : "s"} with no reply`,
        detail:
          negativeUnanswered > 0
            ? `${negativeUnanswered} of them are three stars or lower. An unanswered complaint does more damage than the complaint itself — every future customer reads it and sees nobody cared.`
            : "Replying to reviews is a ranking signal, and it is the cheapest one there is.",
        fix: "footfall drafts a reply in your tone within minutes of a review landing, and publishes it once you approve.",
      });
    } else if (reviews.length > 0) {
      findings.push({
        id: "review-replies",
        severity: "good",
        title: "Every review has a reply",
        detail: "That is rarer than you would think. It counts.",
        fix: "footfall keeps it that way automatically, including at 11 PM.",
      });
    }

    if (reviews.length < GOOD_REVIEW_COUNT) {
      findings.push({
        id: "review-count",
        severity: reviews.length < 10 ? "critical" : "warn",
        title: `Only ${reviews.length} review${reviews.length === 1 ? "" : "s"}`,
        detail: `Shops ranking above you in your area typically carry ${GOOD_REVIEW_COUNT}+. Review count and freshness are among the strongest things Google weighs for "near me" searches.`,
        fix: "footfall gives you a counter QR code and a WhatsApp link, and asks every paying customer while they are still in the shop.",
      });
    }

    /* ------------------------------ photos ----------------------------- */

    if (photos.length < GOOD_PHOTO_COUNT) {
      findings.push({
        id: "photos",
        severity: photos.length < 10 ? "critical" : "warn",
        title:
          photos.length === 0
            ? "No photos on your listing"
            : `Only ${photos.length} photo${photos.length === 1 ? "" : "s"} uploaded`,
        detail: `Listings with ${GOOD_PHOTO_COUNT}+ photos get materially more direction requests and calls. Photos are also the first thing a customer judges you on before they have read a word.`,
        fix: "footfall publishes four photos a week, spaced out so Google does not read it as a dump.",
      });
    } else {
      findings.push({
        id: "photos",
        severity: "good",
        title: `${photos.length} photos on your listing`,
        detail: "That is a healthy library.",
        fix: "footfall keeps adding fresh ones so the listing never goes stale.",
      });
    }

    /* ---------------------------- keywords ----------------------------- */

    const targeted = keywords.filter((k) => k.targeted);
    const ranked = keywords.filter((k) => typeof k.rank === "number");
    const inTopThree = ranked.filter((k) => (k.rank ?? 99) <= 3).length;

    if (keywords.length === 0) {
      findings.push({
        id: "keywords",
        severity: "critical",
        title: "Nobody has worked out what your customers search",
        detail:
          "Your listing is not written around the words people in your area actually type. That is the single biggest reason a good shop stays on page two.",
        fix: "footfall finds the searches you can realistically win in your locality, then rewrites your services and posts around them.",
      });
    } else if (inTopThree === 0) {
      findings.push({
        id: "keywords",
        severity: "critical",
        title: `Not in the top 3 for any of your ${keywords.length} keywords`,
        detail:
          "The top three is the local pack — the box on the Google results page. Almost every call comes from there. Below it, you are effectively invisible.",
        fix: "footfall tracks your position across your whole service area each week and works the listing toward the pack.",
      });
    } else {
      findings.push({
        id: "keywords",
        severity: "warn",
        title: `Top 3 for ${inTopThree} of ${keywords.length} keywords`,
        detail: `${targeted.length} are being targeted. The rest are still open ground.`,
        fix: "footfall widens that, one search at a time, and shows you the map of where you rank.",
      });
    }

    /* --------------------------- the basics ---------------------------- */

    const openDays = hours.filter((h) => !h.closed).length;
    if (hours.length === 0 || openDays === 0) {
      findings.push({
        id: "hours",
        severity: "critical",
        title: "Your opening hours are not set",
        detail:
          "Google hides or demotes listings it cannot confirm are open. Customers searching “open now” will never see you.",
        fix: "footfall sets your real hours, including festival days, and keeps them right.",
      });
    }

    const selected = offerings.filter((o) => o.selected);
    if (selected.length === 0 || !business.servicesPushedAt) {
      findings.push({
        id: "services",
        severity: "warn",
        title: "No services listed on your profile",
        detail:
          "Google reads the services you list to decide which searches you are relevant to. An empty list means it has to guess.",
        fix: "footfall writes out everything you sell and pushes it to your profile.",
      });
    }

    if (!business.additionalCategories?.length) {
      findings.push({
        id: "categories",
        severity: "warn",
        title: "Only one category on your listing",
        detail:
          "Secondary categories are free reach. A dental clinic that also lists as an orthodontist appears in both sets of searches.",
        fix: "footfall picks the extra categories that actually fit what you do.",
      });
    }

    /* ----------------------------- website ----------------------------- */

    if (!business.website) {
      findings.push({
        id: "website",
        severity: "critical",
        title: "You have no website",
        detail:
          "A listing without a website loses to one with a website almost every time, and there is nowhere for a customer to read what you charge before they walk in.",
        fix: "footfall builds you one free, at your own address on footfall.zone — built from your listing, hosted, nothing to maintain.",
      });
    } else if (!siteCheck) {
      findings.push({
        id: "website",
        severity: "warn",
        title: "Your website has not been checked yet",
        detail: `We can look at ${business.website} and tell you what it is missing.`,
        fix: "footfall rewrites the pages that matter around what people search.",
      });
    } else if (!siteCheck.reachable) {
      findings.push({
        id: "website",
        severity: "critical",
        title: "Your website did not load",
        detail: `We could not reach ${siteCheck.url}. ${siteCheck.error ?? ""} A dead link on your listing is worse than none.`,
        fix: "footfall gives you a page that stays up.",
      });
    } else {
      const problems: string[] = [];
      if (!siteCheck.title || siteCheck.title.length < 15)
        problems.push("no usable page title");
      if (!siteCheck.description) problems.push("no meta description");
      if ((siteCheck.wordCount ?? 0) < 300)
        problems.push("almost no text for Google to read");
      if (!siteCheck.namesCity)
        problems.push("never names your city or locality");
      if (!siteCheck.namesPhone) problems.push("does not show your phone number");

      findings.push({
        id: "website",
        severity: problems.length > 1 ? "warn" : "good",
        title:
          problems.length > 0
            ? `Your website has ${problems.length} problem${problems.length === 1 ? "" : "s"}`
            : "Your website covers the basics",
        detail:
          problems.length > 0
            ? `We looked at ${siteCheck.url} and found: ${problems.join(", ")}.`
            : `We looked at ${siteCheck.url} and the fundamentals are in place.`,
        fix: "footfall builds service pages per locality that catch the searches your listing alone cannot reach.",
      });
    }

    const order: Record<Severity, number> = { critical: 0, warn: 1, good: 2 };
    findings.sort((a, b) => order[a.severity] - order[b.severity]);

    return {
      connected: true as const,
      paid: await hasActivePlan(ctx, userId),
      business: {
        name: business.orgName,
        city: business.city ?? null,
        category: business.primaryCategory ?? null,
        website: business.website ?? null,
        mapsUri: business.mapsUri ?? null,
      },
      counts: {
        posts: published.length,
        photos: photos.length,
        reviews: reviews.length,
        unansweredReviews: unanswered,
        keywords: keywords.length,
        inTopThree,
      },
      findings,
      score: Math.round(
        (findings.filter((f) => f.severity === "good").length /
          Math.max(1, findings.length)) *
          100,
      ),
      websiteCheckedAt: siteCheck?.checkedAt ?? null,
      /* Null means we have never read the listing from Google. The UI must
         fetch before it shows any of this, or it will tell a shop with two
         hundred posts that it has never posted. */
      listingSyncedAt: business.listingSyncedAt ?? null,
    };
  },
});

/* ---------------------------- the website check --------------------------- */

export const businessForUser = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return business ? { id: business._id, website: business.website ?? null } : null;
  },
});

export const saveWebsiteCheck = internalMutation({
  args: {
    businessId: v.id("businesses"),
    url: v.string(),
    reachable: v.boolean(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    wordCount: v.optional(v.number()),
    namesCity: v.optional(v.boolean()),
    namesPhone: v.optional(v.boolean()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("websiteChecks", { ...args, checkedAt: Date.now() });
  },
});

/**
 * Reads the shop's own website through Firecrawl.
 *
 * Free, because it is part of the report that earns the subscription. It is
 * one external call, cached in websiteChecks, so hammering the button costs
 * nothing after the first run.
 */
export const checkWebsite = action({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean; reason?: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const business: { id: string; website: string | null } | null =
      await ctx.runQuery(internal.audit.businessForUser, {});
    if (!business) return { ok: false, reason: "not connected" };
    if (!business.website) return { ok: false, reason: "no website" };

    const key = process.env.FIRECRAWL_API_KEY;
    if (!key) return { ok: false, reason: "Website checks are not configured." };

    const url = business.website;
    const save = (extra: Record<string, unknown>) =>
      ctx.runMutation(internal.audit.saveWebsiteCheck, {
        businessId: business.id as never,
        url,
        ...extra,
      } as never);

    // v2 is current; older keys still answer on v1, so fall back rather than
    // telling the owner their site is broken when it is our endpoint.
    let response: Response | null = null;
    for (const endpoint of [
      "https://api.firecrawl.dev/v2/scrape",
      "https://api.firecrawl.dev/v1/scrape",
    ]) {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      });
      if (response.status !== 404) break;
    }

    if (!response || !response.ok) {
      const detail = response ? await response.text() : "no response";
      console.error("[audit] firecrawl failed", response?.status, detail);
      await save({ reachable: false, error: "We could not load the page." });
      return { ok: false, reason: "unreachable" };
    }

    const payload = (await response.json()) as {
      data?: {
        markdown?: unknown;
        metadata?: { title?: unknown; description?: unknown };
      };
    };

    const markdown =
      typeof payload.data?.markdown === "string" ? payload.data.markdown : "";
    const title =
      typeof payload.data?.metadata?.title === "string"
        ? payload.data.metadata.title
        : undefined;
    const description =
      typeof payload.data?.metadata?.description === "string"
        ? payload.data.metadata.description
        : undefined;

    const haystack = `${markdown} ${title ?? ""} ${description ?? ""}`.toLowerCase();
    const full: {
      city?: string | null;
      phone?: string | null;
    } = await ctx.runQuery(internal.audit.napForUser, {});

    const city = (full.city ?? "").toLowerCase();
    const digits = (full.phone ?? "").replace(/[^0-9]/g, "").slice(-10);

    await save({
      reachable: true,
      title,
      description,
      wordCount: markdown.split(/\s+/).filter(Boolean).length,
      namesCity: city.length > 2 ? haystack.includes(city) : false,
      namesPhone:
        digits.length === 10
          ? haystack.replace(/[^0-9a-z ]/g, "").includes(digits)
          : false,
    });

    return { ok: true };
  },
});

/** The name, area and number we check the website actually mentions. */
export const napForUser = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { city: null, phone: null };
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return {
      city: business?.city ?? null,
      phone: business?.phone ?? null,
    };
  },
});


/* ------------------------------ reading Google ---------------------------
   The report is free, but it has to be true. That means reading the live
   listing rather than reporting on whatever happens to be in our tables:
   posts the owner made themselves, photos they uploaded, reviews left this
   morning. A free report that invents problems is worse than no report. */

export const stampSynced = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (business) {
      await ctx.db.patch(business._id, { listingSyncedAt: Date.now() });
    }
  },
});

/**
 * Pulls posts, photos, reviews and performance from Google in one go.
 *
 * allSettled rather than all: a shop with no performance data yet should
 * still get its posts and reviews read. One failing call must not cost the
 * owner the whole report.
 */
export const syncListing = internalAction({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }): Promise<{ ok: boolean }> => {
    const results = await Promise.allSettled([
      ctx.runAction(internal.posts.syncFromGoogleForUser, { userId }),
      ctx.runAction(internal.photos.syncForUser, { userId }),
      ctx.runAction(internal.reviews.syncForUser, { userId }),
      ctx.runAction(internal.performance.syncMetricsForUser, {
        userId,
        days: 30,
      }),
    ]);

    for (const r of results) {
      if (r.status === "rejected") {
        console.error("[audit] a listing sync step failed", r.reason);
      }
    }

    await ctx.runMutation(internal.audit.stampSynced, { userId });
    return { ok: results.some((r) => r.status === "fulfilled") };
  },
});

/** The free "read my listing" button. Free, because the report is free. */
export const refresh = action({
  args: {},
  handler: async (ctx): Promise<{ ok: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");
    return await ctx.runAction(internal.audit.syncListing, { userId });
  },
});
