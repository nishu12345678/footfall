import { v } from "convex/values";
import { action, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Keyword research for a local business.
 *
 * The pipeline, and what each stage is actually measuring:
 *
 *   1 DISCOVER   Google Trends related queries + Google Autocomplete, seeded
 *                from what the shop sells. Both are records of real searches.
 *   2 FILTER     Keep buying intent, drop how-to questions and other cities.
 *   3 DEMAND     Google Trends compares terms head to head in this state and
 *                returns relative interest — the closest thing to volume that
 *                a free source gives.
 *   4 WINNABLE   Optional: read the map results and see how strong the current
 *                top three are.
 *   5 SCORE      demand x intent x winnability, with the reasoning shown.
 *
 * Trends returns RELATIVE interest, not searches per month. Nothing here
 * prints an absolute volume, because no source we pay for provides one.
 */

const STATE_CODES: Record<string, string> = {
  "andhra pradesh": "IN-AP",
  assam: "IN-AS",
  bihar: "IN-BR",
  chhattisgarh: "IN-CT",
  delhi: "IN-DL",
  goa: "IN-GA",
  gujarat: "IN-GJ",
  haryana: "IN-HR",
  "himachal pradesh": "IN-HP",
  jharkhand: "IN-JH",
  karnataka: "IN-KA",
  kerala: "IN-KL",
  "madhya pradesh": "IN-MP",
  maharashtra: "IN-MH",
  odisha: "IN-OR",
  punjab: "IN-PB",
  rajasthan: "IN-RJ",
  "tamil nadu": "IN-TN",
  telangana: "IN-TG",
  "uttar pradesh": "IN-UP",
  uttarakhand: "IN-UT",
  "west bengal": "IN-WB",
};

const OTHER_CITIES = [
  "delhi", "mumbai", "chennai", "kolkata", "bangalore", "bengaluru",
  "hyderabad", "pune", "noida", "gurgaon", "gurugram", "lucknow", "jaipur",
  "ahmedabad", "kannur", "kochi", "surat", "indore", "nagpur", "bhopal",
  "patna", "ludhiana", "coimbatore", "vizag", "thane", "nashik",
];

/** Searches that mean "I want to buy", not "I want to read". */
const INTENT_WORDS = [
  "shop", "shops", "store", "showroom", "dealer", "dealers", "supplier",
  "suppliers", "near me", "nearby", "price", "rate", "rates", "cost",
  "buy", "sale", "wholesale", "best", "top", "service", "services",
];

/** Searches that bring readers, not walk-ins. */
const INFORMATIONAL = [
  "how to", "what is", "why", "diy", "clean", "cleaning", "remove",
  "repair guide", "meaning", "difference between", "vs", "images",
  "photo", "wallpaper", "drawing", "hs code", "full form",
];

function serpUrl(params: Record<string, string>) {
  const url = new URL("https://serpapi.com/search");
  for (const [k, val] of Object.entries(params)) url.searchParams.set(k, val);
  url.searchParams.set("api_key", process.env.SERPAPI_KEY ?? "");
  return url.toString();
}

async function serp(params: Record<string, string>): Promise<any> {
  if (!process.env.SERPAPI_KEY) throw new Error("SERPAPI_KEY is not set.");
  const res = await fetch(serpUrl(params));
  const data = await res.json();
  if (data.error) {
    console.log(`[serpapi] ${params.engine}: ${data.error}`);
    return null;
  }
  return data;
}

/* ------------------------------ 1 discover ------------------------------ */

async function relatedQueries(seed: string, geo: string) {
  const data = await serp({
    engine: "google_trends",
    q: seed,
    geo,
    date: "today 12-m",
    data_type: "RELATED_QUERIES",
  });
  const rq = data?.related_queries ?? {};
  const out: { term: string; source: string }[] = [];
  for (const row of rq.top ?? []) {
    if (row?.query) out.push({ term: String(row.query).toLowerCase(), source: "trending" });
  }
  for (const row of rq.rising ?? []) {
    if (row?.query) out.push({ term: String(row.query).toLowerCase(), source: "rising" });
  }
  return out;
}

async function autocomplete(seed: string) {
  const data = await serp({
    engine: "google_autocomplete",
    q: seed,
    gl: "in",
    hl: "en",
  });
  return (data?.suggestions ?? [])
    .map((s: { value?: string }) => (s.value ?? "").toLowerCase().trim())
    .filter(Boolean)
    .map((term: string) => ({ term, source: "autocomplete" }));
}

/* ------------------------------- 3 demand ------------------------------- */

/** Google Trends compares up to five terms at once. */
async function demandFor(terms: string[], geo: string) {
  const scores = new Map<string, number>();

  for (let i = 0; i < terms.length; i += 5) {
    const batch = terms.slice(i, i + 5);
    const data = await serp({
      engine: "google_trends",
      q: batch.join(","),
      geo,
      date: "today 12-m",
      data_type: "TIMESERIES",
    });

    const timeline = data?.interest_over_time?.timeline_data ?? [];
    if (timeline.length === 0) {
      batch.forEach((t) => scores.set(t, 0));
      continue;
    }

    batch.forEach((term, index) => {
      const total = timeline.reduce(
        (sum: number, point: any) =>
          sum + (point.values?.[index]?.extracted_value ?? 0),
        0,
      );
      scores.set(term, Math.round((total / timeline.length) * 10) / 10);
    });
  }

  return scores;
}

/* --------------------------- 3b real volume ------------------------------
   DataForSEO reads Google Ads' own numbers, so it gives an actual monthly
   search volume for a city — including long-tail phrases that Google Trends
   is far too coarse to measure. When it answers we use it and stop guessing;
   when it doesn't, we fall back to Trends.                                */

export type Volume = {
  volume: number | null;
  competition: string | null;
  cpc: number | null;
};

async function dataForSeoVolume(
  terms: string[],
  locationName: string,
): Promise<Map<string, Volume>> {
  const out = new Map<string, Volume>();
  const auth = process.env.DATAFORSEO_AUTH;
  if (!auth || terms.length === 0) return out;

  const attempt = async (location: string) => {
    const res = await fetch(
      "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            keywords: terms.slice(0, 700),
            location_name: location,
            language_code: "en",
          },
        ]),
      },
    );
    const data = await res.json();
    if (data?.status_code !== 20000) {
      console.log(`[dataforseo] ${data?.status_code} ${data?.status_message}`);
      return null;
    }
    return data?.tasks?.[0]?.result ?? [];
  };

  // City first — a shop cares about demand in its own city, not the country.
  let rows = await attempt(locationName);
  if (rows === null || rows.length === 0) rows = await attempt("India");
  if (!rows) return out;

  for (const row of rows) {
    if (!row?.keyword) continue;
    out.set(String(row.keyword).toLowerCase(), {
      volume: row.search_volume ?? null,
      competition: row.competition ?? null,
      cpc: row.cpc ?? null,
    });
  }
  return out;
}

/* ----------------------------- 4 winnability ---------------------------- */

async function topThreeReviews(term: string, lat: number, lng: number) {
  const data = await serp({
    engine: "google_maps",
    q: term,
    ll: `@${lat},${lng},14z`,
    type: "search",
  });
  const results = data?.local_results ?? [];
  const top3 = results.slice(0, 3);
  if (top3.length === 0) return { reviews: 0, rivals: 0 };
  return {
    reviews: Math.round(
      top3.reduce((t: number, r: any) => t + (r.reviews ?? 0), 0) / top3.length,
    ),
    rivals: results.length,
  };
}

/* ------------------------- 2.5 relevance + heads -------------------------
   Rule filters can't tell that "nissan granite price" is a car, or that
   "tile shop thrissur" is 2,000km away. A model holding the business
   context can. It also names each phrase's head term — the product noun —
   because a long-tail local phrase never registers in Trends, but the head
   term it belongs to does.                                                */

async function refine(
  candidates: string[],
  business: {
    name: string;
    category?: string;
    city?: string;
    state?: string;
    offerings: string[];
  },
): Promise<{ term: string; head: string }[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set.");

  const prompt = [
    `Business: ${business.name}`,
    business.category ? `Category: ${business.category}` : "",
    business.city ? `City: ${business.city}, ${business.state ?? "India"}` : "",
    business.offerings.length ? `Sells: ${business.offerings.join(", ")}` : "",
    "",
    "Here are search phrases harvested from Google:",
    ...candidates.map((c) => `- ${c}`),
    "",
    "Keep only the phrases where someone searching it could realistically walk into THIS shop and buy something.",
    "Drop:",
    "- phrases about a different product that merely shares a word (car models, brands this shop doesn't sell)",
    "- phrases naming a city or area far from this business",
    "- phrases where the searcher wants information, not a shop",
    "",
    "For each phrase you keep, also give its head term: the 1-2 word product noun at its core.",
    'Example: {"term":"granite shop near me","head":"granite"}',
    "",
    'Reply as JSON only: {"items":[{"term":"...","head":"..."}]}',
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
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You do local SEO for Indian neighbourhood businesses. You are strict about relevance and never keep a phrase that would bring the wrong customer.",
        },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    console.error(`[openai] ${res.status} ${(await res.text()).slice(0, 200)}`);
    return candidates.map((term) => ({ term, head: term.split(" ")[0] }));
  }

  const data = await res.json();
  try {
    const items = JSON.parse(data?.choices?.[0]?.message?.content ?? "{}").items;
    return (Array.isArray(items) ? items : [])
      .filter((i: any) => i?.term && i?.head)
      .map((i: any) => ({
        term: String(i.term).toLowerCase(),
        head: String(i.head).toLowerCase(),
      }));
  } catch {
    return [];
  }
}

/* ------------------------------- context -------------------------------- */

export const context = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business) return null;

    const [offerings, keywords, areas] = await Promise.all([
      ctx.db
        .query("offerings")
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
    ]);

    return {
      name: business.orgName,
      category: business.primaryCategory,
      city: business.city,
      state: business.state,
      lat: business.lat,
      lng: business.lng,
      offerings: offerings.map((r) => r.label),
      areas: areas.map((r) => r.name),
      have: keywords.map((r) => r.term.toLowerCase()),
    };
  },
});

/* -------------------------------- research ------------------------------ */

export type Researched = {
  term: string;
  demand: number;
  volume?: number | null;
  competition?: string | null;
  reviews?: number;
  score: number;
  source: string;
  why: string;
  measured: string;
};

export const research = action({
  args: { deep: v.optional(v.boolean()) },
  handler: async (ctx, { deep = false }): Promise<Researched[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Sign in first.");

    const c = await ctx.runQuery(internal.keywords.context, { userId });
    if (!c) throw new Error("Connect your Google profile first.");
    if (c.offerings.length === 0 && !c.category) {
      throw new Error("Add what you sell first — that's what we search from.");
    }

    const geo = STATE_CODES[(c.state ?? "").toLowerCase()] ?? "IN";
    const city = (c.city ?? "").toLowerCase();
    const already = new Set(c.have);

    // 1 · discover, seeded from what the shop actually sells
    const seeds = [
      ...(c.category ? [c.category.toLowerCase()] : []),
      ...c.offerings.slice(0, 3).map((o) => o.toLowerCase()),
    ].slice(0, 4);

    const pool = new Map<string, string>();
    for (const seed of seeds) {
      for (const { term, source } of await relatedQueries(seed, geo)) {
        if (!pool.has(term)) pool.set(term, source);
      }
      for (const { term, source } of await autocomplete(seed)) {
        if (!pool.has(term)) pool.set(term, source);
      }
    }

    // 2 · filter to local buying intent
    const candidates = [...pool.entries()]
      .filter(([term]) => !already.has(term))
      .filter(([term]) => {
        const words = term.split(" ").length;
        return words >= 2 && words <= 6;
      })
      .filter(([term]) => !INFORMATIONAL.some((w) => term.includes(w)))
      .filter(
        ([term]) => !OTHER_CITIES.filter((x) => x !== city).some((w) => term.includes(w)),
      )
      .filter(
        ([term]) =>
          INTENT_WORDS.some((w) => term.includes(w)) ||
          (city && term.includes(city)),
      )
      .slice(0, deep ? 12 : 20);

    if (candidates.length === 0) {
      throw new Error(
        "Nothing with local buying intent came back. Add more specific offerings and try again.",
      );
    }

    // 2.5 · drop what a rule can't judge, and name each phrase's head term
    const refined = await refine(
      candidates.map(([term]) => term),
      {
        name: c.name,
        category: c.category,
        city: c.city,
        state: c.state,
        offerings: c.offerings,
      },
    );
    if (refined.length === 0) {
      throw new Error("Nothing relevant to your shop came back. Try again.");
    }

    // 3 · demand. Real monthly volume for this city if DataForSEO answers,
    //     otherwise relative Trends interest on the head terms.
    const locationName = [c.city, c.state, "India"].filter(Boolean).join(",");
    const volumes = await dataForSeoVolume(
      refined.map((r) => r.term),
      locationName,
    );
    const usingVolume = [...volumes.values()].some((v) => v.volume !== null);

    const demand = usingVolume
      ? new Map<string, number>()
      : await demandFor(
          [...new Set(refined.map((r) => r.head))].slice(0, 15),
          geo,
        );

    const peakVolume = Math.max(
      1,
      ...[...volumes.values()].map((v) => v.volume ?? 0),
    );
    const peak = Math.max(1, ...[...demand.values()]);

    const out: Researched[] = [];

    for (const { term, head } of refined) {
      const source = candidates.find(([t]) => t === term)?.[1] ?? "trending";
      const measurement = volumes.get(term);
      const raw = usingVolume
        ? (measurement?.volume ?? 0)
        : (demand.get(head) ?? 0);
      const demandScore = usingVolume
        ? (raw / peakVolume) * 10
        : (raw / peak) * 10;
      const measured = usingVolume ? "volume" : "trends";
      const demandWhy = usingVolume
        ? raw > 0
          ? `${raw.toLocaleString("en-IN")} searches a month in ${c.city ?? "India"}`
          : `No measurable search volume in ${c.city ?? "India"}`
        : raw > 0
          ? `"${head}" scores ${raw} on Trends in ${c.state ?? "India"}`
          : `"${head}" is too niche for Trends to measure`;
      const local = term.includes("near me") || (city && term.includes(city));
      const intentBonus = local ? 1.5 : 0;

      if (!deep) {
        out.push({
          term,
          demand: raw,
          volume: measurement?.volume ?? null,
          competition: measurement?.competition ?? null,
          measured,
          source,
          score: Math.round((demandScore + intentBonus) * 10) / 10,
          why: `${demandWhy}${local ? ". Local search." : "."}`,
        });
        continue;
      }

      const { reviews } = await topThreeReviews(term, c.lat!, c.lng!);
      const winnable =
        reviews === 0 ? 5 : Math.max(0, 10 - Math.log10(reviews + 1) * 3.5);
      const score =
        Math.round((demandScore * 0.5 + winnable * 0.35 + intentBonus) * 10) / 10;

      out.push({
        term,
        demand: raw,
        volume: measurement?.volume ?? null,
        competition: measurement?.competition ?? null,
        measured,
        reviews,
        source,
        score,
        why:
          `${demandWhy}. Top 3 average ${reviews} reviews — ` +
          (reviews < 50 ? "beatable." : reviews < 200 ? "competitive." : "hard."),
      });
    }

    return out.sort((a, b) => b.score - a.score).slice(0, 15);
  },
});
