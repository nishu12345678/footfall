import { ConvexError, v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";
import type { Id } from "./_generated/dataModel";
import {
  ownedBusiness,
  ownedRow,
  paidAction,
  paidMutation,
  paidQuery,
} from "./access";

/**
 * Step 4 — the parts of the listing that decide whether anyone finds it:
 * where you serve, what people search, when you're open, what you offer.
 */

export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** A small, category-agnostic set. Real Google attributes are per-category. */
export const ATTRIBUTE_CHOICES = [
  { key: "home_delivery", label: "Home delivery" },
  { key: "card_payments", label: "Card payments accepted" },
  { key: "upi", label: "UPI accepted" },
  { key: "parking", label: "Free parking" },
  { key: "wheelchair", label: "Wheelchair accessible entrance" },
  { key: "appointments", label: "Appointments available" },
  { key: "installation", label: "Installation service" },
  { key: "gst_invoice", label: "GST invoice provided" },
];

/* -------------------------------- read ---------------------------------- */

export const list = paidQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business) return null;

    // Queried one by one on purpose: a shared helper with a variable table
    // name collapses the four row types into a union.
    const [serviceAreas, keywords, hours, attributes] = await Promise.all([
      ctx.db
        .query("serviceAreas")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
      ctx.db
        .query("keywords")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
      ctx.db
        .query("businessHours")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
      ctx.db
        .query("attributes")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
    ]);

    return {
      business,
      serviceAreas,
      keywords,
      hours: hours.sort((a, b) => a.day - b.day),
      attributes,
      attributeChoices: ATTRIBUTE_CHOICES,
    };
  },
});

/* --------------------------- service areas ------------------------------ */

export const addServiceArea = paidMutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const business = await ownedBusiness(ctx);
    const trimmed = name.trim();
    if (!trimmed) return;

    const existing = await ctx.db
      .query("serviceAreas")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    if (existing.some((r) => r.name.toLowerCase() === trimmed.toLowerCase())) {
      return;
    }
    await ctx.db.insert("serviceAreas", {
      businessId: business._id,
      name: trimmed,
    });
  },
});

export const removeServiceArea = paidMutation({
  args: { id: v.id("serviceAreas") },
  handler: async (ctx, { id }) => {
    const { row } = await ownedRow(ctx, id);
    await ctx.db.delete(row._id);
  },
});

/* ------------------------------ keywords -------------------------------- */

export const addKeyword = paidMutation({
  args: { term: v.string() },
  handler: async (ctx, { term }) => {
    const business = await ownedBusiness(ctx);
    const trimmed = term.trim().toLowerCase();
    if (!trimmed) return;

    const existing = await ctx.db
      .query("keywords")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    if (existing.some((r) => r.term.toLowerCase() === trimmed)) return;

    await ctx.db.insert("keywords", {
      businessId: business._id,
      term: trimmed,
      targeted: true,
      nearMe: trimmed.includes("near me") || trimmed.includes("nearby"),
    });
  },
});

export const removeKeyword = paidMutation({
  args: { id: v.id("keywords") },
  handler: async (ctx, { id }) => {
    const { row } = await ownedRow(ctx, id);
    await ctx.db.delete(row._id);
  },
});

export const keywordContext = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const business = await ctx.db
      .query("businesses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    if (!business) return null;

    const [offerings, specialties, areas, keywords] = await Promise.all([
      ctx.db
        .query("offerings")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
      ctx.db
        .query("specialties")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
      ctx.db
        .query("serviceAreas")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
      ctx.db
        .query("keywords")
        .withIndex("by_business", (q) => q.eq("businessId", business._id))
        .collect(),
    ]);

    return {
      name: business.orgName,
      category: business.primaryCategory,
      city: business.city,
      offerings: offerings.map((r) => r.label),
      specialties: specialties.map((r) => r.label),
      areas: areas.map((r) => r.name),
      have: keywords.map((r) => r.term),
    };
  },
});

/**
 * The keywords a neighbour would actually type. Not "salon near me" but
 * "hair spa thane west" — trade plus locality, which is what a local
 * business can realistically win.
 */
export const suggestKeywords = paidAction({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in first.");

    const c = await ctx.runQuery(internal.gbp.keywordContext, { userId });
    if (!c) throw new ConvexError("Connect your Google profile first.");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new ConvexError("The writing assistant isn't set up on this server yet.");

    const prompt = [
      `Business: ${c.name}`,
      c.category ? `Category: ${c.category}` : "",
      c.city ? `City: ${c.city}` : "",
      c.areas.length ? `Serves: ${c.areas.join(", ")}` : "",
      c.offerings.length ? `Sells: ${c.offerings.join(", ")}` : "",
      c.specialties.length ? `Known for: ${c.specialties.join(", ")}` : "",
      c.have.length
        ? `Already targeting (skip these): ${c.have.join(", ")}`
        : "",
      "",
      "List 12 search phrases a nearby customer would actually type into Google before visiting a shop like this.",
      "Rules: lowercase. 2-5 words. Mix 'near me' phrases with ones naming the city or locality.",
      "Favour buying intent over browsing. No brand names the shop doesn't sell.",
      'Reply as JSON only: {"items":["...","..."]}',
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
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You do local SEO for Indian neighbourhood businesses. You know how people actually type searches on a phone.",
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[openai] ${res.status} ${body.slice(0, 300)}`);
      throw new ConvexError("Couldn't get keyword ideas just now. Try again in a moment.");
    }

    const data = await res.json();
    let items: string[] = [];
    try {
      items =
        JSON.parse(data?.choices?.[0]?.message?.content ?? "{}").items ?? [];
    } catch {
      console.error("[openai] unparseable keyword reply");
    }

    const seen = new Set(c.have.map((h: string) => h.toLowerCase()));
    return items
      .filter((i) => typeof i === "string" && i.trim())
      .map((i) => i.trim().toLowerCase())
      .filter((i) => !seen.has(i))
      .slice(0, 12);
  },
});

/* -------------------------------- hours --------------------------------- */

export const setHours = paidMutation({
  args: {
    hours: v.array(
      v.object({
        day: v.number(),
        open: v.optional(v.string()),
        close: v.optional(v.string()),
        closed: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, { hours }) => {
    const business = await ownedBusiness(ctx);

    const existing = await ctx.db
      .query("businessHours")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    for (const row of existing) await ctx.db.delete(row._id);

    for (const row of hours) {
      await ctx.db.insert("businessHours", {
        businessId: business._id,
        ...row,
      });
    }
  },
});

export const saveSyncedHours = internalMutation({
  args: {
    businessId: v.id("businesses"),
    hours: v.array(
      v.object({
        day: v.number(),
        open: v.optional(v.string()),
        close: v.optional(v.string()),
        closed: v.boolean(),
      }),
    ),
  },
  handler: async (ctx, { businessId, hours }) => {
    const existing = await ctx.db
      .query("businessHours")
      .withIndex("by_business", (q) => q.eq("businessId", businessId))
      .collect();
    if (existing.length > 0) return;

    for (const row of hours) {
      await ctx.db.insert("businessHours", { businessId, ...row });
    }
  },
});

/* ------------------------------ attributes ------------------------------ */

export const toggleAttribute = paidMutation({
  args: { key: v.string(), label: v.string(), enabled: v.boolean() },
  handler: async (ctx, { key, label, enabled }) => {
    const business = await ownedBusiness(ctx);

    const existing = await ctx.db
      .query("attributes")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    const match = existing.find((r) => r.key === key);

    if (match) {
      await ctx.db.patch(match._id, { enabled });
      return;
    }
    await ctx.db.insert("attributes", {
      businessId: business._id,
      key,
      label,
      enabled,
    });
  },
});

/* ------------------------------- complete ------------------------------- */

export const complete = paidMutation({
  args: {},
  handler: async (ctx) => {
    const business = await ownedBusiness(ctx);
    await ctx.db.patch(business._id as Id<"businesses">, {
      onboardingStep: Math.max(business.onboardingStep, 5),
    });
  },
});

/* --------------------------- keyword research ----------------------------
   Real signals, not invented volume numbers.

   demand      Google Autocomplete. If Google suggests a phrase, people type
               it; how early it appears is a rough popularity proxy.
   winnability The map results for that phrase. Three rivals with 500 reviews
               each is a wall; three with 15 reviews is an opening.

   Nothing here claims a monthly search volume, because no source we have
   provides one. DataForSEO or Google Ads would, and both cost money.      */

type Researched = {
  term: string;
  suggestedAt?: number;
  topReviews?: number;
  rivals?: number;
  score: number;
  why: string;
};

async function autocomplete(seed: string): Promise<string[]> {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new ConvexError("Rank checks aren't set up on this server yet.");

  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google_autocomplete");
  url.searchParams.set("q", seed);
  url.searchParams.set("gl", "in");
  url.searchParams.set("hl", "en");
  url.searchParams.set("api_key", key);

  const res = await fetch(url.toString());
  const data = await res.json();
  if (data.error) {
    console.log(`[serpapi/autocomplete] ${data.error}`);
    return [];
  }
  return (data.suggestions ?? [])
    .map((s: { value?: string }) => (s.value ?? "").toLowerCase().trim())
    .filter(Boolean);
}

async function competition(
  term: string,
  lat: number,
  lng: number,
): Promise<{ topReviews: number; rivals: number }> {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new ConvexError("Rank checks aren't set up on this server yet.");

  const url = new URL("https://serpapi.com/search");
  url.searchParams.set("engine", "google_maps");
  url.searchParams.set("q", term);
  url.searchParams.set("ll", `@${lat},${lng},14z`);
  url.searchParams.set("type", "search");
  url.searchParams.set("api_key", key);

  const res = await fetch(url.toString());
  const data = await res.json();
  const results = data.local_results ?? [];
  const top3 = results.slice(0, 3);
  const topReviews =
    top3.length === 0
      ? 0
      : Math.round(
          top3.reduce((t: number, r: any) => t + (r.reviews ?? 0), 0) /
            top3.length,
        );
  return { topReviews, rivals: results.length };
}

export const researchKeywords = paidAction({
  args: { deep: v.optional(v.boolean()) },
  handler: async (ctx, { deep = false }): Promise<Researched[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in first.");

    const c = await ctx.runQuery(internal.gbp.keywordContext, { userId });
    if (!c) throw new ConvexError("Connect your Google profile first.");

    const business = await ctx.runQuery(internal.google.businessForUser, {
      userId,
    });
    if (!business?.lat || !business?.lng) {
      throw new ConvexError("We don't have coordinates for your shop yet.");
    }

    // Seeds come from what the shop actually sells, plus its category.
    const seeds = [
      ...(c.category ? [c.category.toLowerCase()] : []),
      ...c.offerings.slice(0, 4).map((o: string) => o.toLowerCase()),
    ].slice(0, 5);

    if (seeds.length === 0) throw new ConvexError("Add some offerings first.");

    const pool = new Map<string, number>();
    for (const seed of seeds) {
      const suggestions = await autocomplete(seed);
      suggestions.forEach((term, i) => {
        if (!pool.has(term) || (pool.get(term) ?? 99) > i) pool.set(term, i);
      });
    }

    const city = (c.city ?? "").toLowerCase();
    const already = new Set(c.have.map((h: string) => h.toLowerCase()));

    // Keep phrases that are local in intent and not already targeted:
    // "near me", or naming this city — not Delhi, Chennai, Noida.
    const otherCityWords = [
      "delhi",
      "mumbai",
      "chennai",
      "kolkata",
      "bangalore",
      "bengaluru",
      "hyderabad",
      "pune",
      "noida",
      "gurgaon",
      "lucknow",
      "jaipur",
      "ahmedabad",
      "kannur",
      "kochi",
      "surat",
      "indore",
      "nagpur",
    ].filter((w) => w !== city);

    const candidates = [...pool.entries()]
      .filter(([term]) => !already.has(term))
      .filter(([term]) => term.split(" ").length >= 2)
      .filter(([term]) => !otherCityWords.some((w) => term.includes(w)))
      .filter(
        ([term]) => term.includes("near me") || !city || term.includes(city),
      )
      .sort((a, b) => a[1] - b[1])
      .slice(0, deep ? 10 : 14);

    const out: Researched[] = [];

    for (const [term, suggestedAt] of candidates) {
      // Demand: how early Google suggested it. 0 is the top suggestion.
      const demand = Math.max(0, 10 - suggestedAt);

      if (!deep) {
        out.push({
          term,
          suggestedAt,
          score: demand,
          why: `Google suggests this at position ${suggestedAt + 1}`,
        });
        continue;
      }

      const { topReviews, rivals } = await competition(
        term,
        business.lat,
        business.lng,
      );
      // Winnability: the fewer reviews the current top three have, the more
      // realistic it is to displace them.
      const winnable =
        topReviews === 0
          ? 5
          : Math.max(0, 10 - Math.log10(topReviews + 1) * 3.5);
      const score = Math.round((demand * 0.6 + winnable * 0.4) * 10) / 10;

      out.push({
        term,
        suggestedAt,
        topReviews,
        rivals,
        score,
        why:
          `Suggested at position ${suggestedAt + 1}. ` +
          `Top 3 average ${topReviews} reviews — ` +
          (topReviews < 50
            ? "beatable."
            : topReviews < 200
              ? "competitive."
              : "hard to crack."),
      });
    }

    return out.sort((a, b) => b.score - a.score);
  },
});

/* ---------------------------- service areas ------------------------------
   A shop's service area is not a blank box. We know its city and street
   address from Google, so those go in by themselves, and the localities
   around it are offered as suggestions to confirm.                        */

export const seedServiceAreas = paidMutation({
  args: {},
  handler: async (ctx): Promise<string[]> => {
    const business = await ownedBusiness(ctx);

    const existing = await ctx.db
      .query("serviceAreas")
      .withIndex("by_business", (q) => q.eq("businessId", business._id))
      .collect();
    if (existing.length > 0) return existing.map((r) => r.name);

    // Only the city, which Google gives us as a clean field. Slicing a
    // locality out of the address line produced junk like
    // "agra Uttar Pradesh 282001" — the surrounding localities come from
    // the map instead, where they're real places with real distances.
    const seeds: string[] = [];
    if (business.city) seeds.push(business.city);

    for (const name of [...new Set(seeds)]) {
      await ctx.db.insert("serviceAreas", {
        businessId: business._id,
        name,
      });
    }
    return seeds;
  },
});

/**
 * Real localities around the shop, from OpenStreetMap, with real distances.
 *
 * A shop doesn't serve one colony — it serves everyone willing to travel to
 * it. So this works on a radius the owner picks, and every name is a place
 * that actually exists on the map rather than something a model recalled.
 */
export const setServiceRadius = paidMutation({
  args: { radiusKm: v.number() },
  handler: async (ctx, { radiusKm }) => {
    const business = await ownedBusiness(ctx);
    await ctx.db.patch(business._id, {
      serviceRadiusKm: Math.min(Math.max(radiusKm, 2), 50),
    });
  },
});

type NearbyArea = {
  name: string;
  km: number;
  kind: string;
  lat: number;
  lng: number;
};

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/**
 * Free first: OpenStreetMap Overpass. Individual mirrors drop connections
 * or time out often enough that one endpoint isn't reliable, so a couple
 * are tried in turn before giving up on Overpass entirely.
 *
 * Worldwide mirrors only. overpass.osm.ch used to sit in this list and it
 * is the *Swiss* instance: it answers 200 with a perfectly valid, perfectly
 * empty result for any Indian coordinate, which the screen then reported
 * as "no areas near you".
 */
async function overpassNearby(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<NearbyArea[] | null> {
  const radius = Math.round(radiusKm * 1000);
  const query =
    `[out:json][timeout:25];` +
    `(node["place"~"^(suburb|neighbourhood|quarter|town|village)$"]` +
    `(around:${radius},${lat},${lng}););out body 80;`;

  const MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  // Ask mirrors concurrently and cap the whole free-provider attempt. This
  // avoids making the owner wait through two consecutive 25-second timeouts.
  const attempts = await Promise.all(
    MIRRORS.map(async (mirror) => {
      try {
        const res = await fetch(mirror, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "footfall/1.0 (local business listing tool)",
            Accept: "application/json",
          },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(12_000),
        });
        if (!res.ok) return { error: `${mirror} -> ${res.status}` };
        const body = await res.json();
        // A busy Overpass answers 200 with a "remark" (usually a timeout)
        // and no elements. That is a failure, not an empty map.
        if (body?.remark && !(body.elements ?? []).length) {
          return {
            error: `${mirror} -> remark: ${String(body.remark).slice(0, 120)}`,
          };
        }
        return { body };
      } catch (error) {
        return {
          error: `${mirror} -> ${error instanceof Error ? error.message : String(error)}`,
        };
      }
    }),
  );

  // Prefer any non-empty response. A valid empty response is believable only
  // when no mirror returned data, but remains distinct from total failure.
  const usable = attempts.find((a) => (a.body?.elements ?? []).length > 0);
  const empty = attempts.find((a) => a.body);
  const data = usable?.body ?? empty?.body ?? null;
  if (!data) {
    console.error(
      `[overpass] all mirrors failed. ${attempts.map((a) => a.error).filter(Boolean).join("; ")}`,
    );
    return null;
  }
  console.log(
    `[overpass] ${(data.elements ?? []).length} places within ${radiusKm}km of ${lat},${lng}`,
  );

  const seen = new Set<string>();
  return (data.elements ?? [])
    .filter((e: any) => e?.tags?.name && e.lat && e.lon)
    .map((e: any) => ({
      name: String(e.tags.name),
      kind: String(e.tags.place),
      km: Math.round(haversineKm(lat, lng, e.lat, e.lon) * 10) / 10,
      lat: e.lat as number,
      lng: e.lon as number,
    }))
    .filter((e: { name: string }) => {
      const key = e.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a: { km: number }, b: { km: number }) => a.km - b.km)
    .slice(0, 30);
}

/**
 * Paid fallback: Google Geocoding. Places Nearby Search deliberately rejects
 * locality concepts such as `neighborhood` and `sublocality` as filters — it
 * is for establishments, not for enumerating administrative areas. Reverse
 * geocoding points around the chosen radius returns exactly those structured
 * address components instead.
 *
 * This is reached only when every free Overpass mirror fails. Thirteen small
 * requests (the centre plus two six-point rings) run concurrently, so the
 * fallback remains quick and its paid usage stays bounded.
 */
async function googleGeocodingNearby(
  lat: number,
  lng: number,
  radiusKm: number,
): Promise<NearbyArea[] | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const AREA_TYPES = new Set([
    "neighborhood",
    "sublocality",
    "sublocality_level_1",
    "sublocality_level_2",
    "sublocality_level_3",
    "locality",
    "administrative_area_level_3",
    "administrative_area_level_4",
  ]);

  // Sample the shop itself and two rings. At each point Google returns the
  // containing neighbourhood/locality; deduplication below turns those into
  // a compact list of real nearby areas.
  const samples: { lat: number; lng: number }[] = [{ lat, lng }];
  for (const fraction of [0.45, 0.9]) {
    const ringKm = radiusKm * fraction;
    for (let i = 0; i < 6; i += 1) {
      const angle = (i * Math.PI * 2) / 6;
      samples.push({
        lat: lat + (ringKm * Math.cos(angle)) / 111.32,
        lng:
          lng +
          (ringKm * Math.sin(angle)) /
            (111.32 * Math.max(0.2, Math.cos((lat * Math.PI) / 180))),
      });
    }
  }

  const attempts = await Promise.all(
    samples.map(async (sample) => {
      try {
        const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
        url.searchParams.set("latlng", `${sample.lat},${sample.lng}`);
        url.searchParams.set("key", apiKey);
        url.searchParams.set("language", "en");
        const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
        if (!res.ok) return { error: `HTTP ${res.status}`, results: [] };
        const body = await res.json();
        if (body?.status !== "OK" && body?.status !== "ZERO_RESULTS") {
          return {
            error: `${body?.status ?? "unknown"}: ${body?.error_message ?? "request failed"}`,
            results: [],
          };
        }
        return {
          results: Array.isArray(body?.results) ? body.results : [],
          error: "",
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : String(error),
          results: [],
        };
      }
    }),
  );

  const successful = attempts.filter((a) => !a.error);
  if (successful.length === 0) {
    console.error(
      `[google-geocoding] all requests failed. ${attempts
        .map((a) => a.error)
        .filter(Boolean)
        .slice(0, 3)
        .join("; ")}`,
    );
    return null;
  }

  const seen = new Set<string>();
  const out: NearbyArea[] = [];
  for (const attempt of successful) {
    for (const result of attempt.results) {
      const rlat = result?.geometry?.location?.lat;
      const rlng = result?.geometry?.location?.lng;
      if (typeof rlat !== "number" || typeof rlng !== "number") continue;

      for (const component of result?.address_components ?? []) {
        const types: string[] = Array.isArray(component?.types)
          ? component.types
          : [];
        const kind = types.find((type) => AREA_TYPES.has(type));
        const name: string | undefined = component?.long_name;
        if (!kind || !name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({
          name,
          kind,
          km: Math.round(haversineKm(lat, lng, rlat, rlng) * 10) / 10,
          lat: rlat,
          lng: rlng,
        });
      }
    }
  }

  console.log(
    `[google-geocoding] ${out.length} areas from ${successful.length}/${samples.length} samples within ${radiusKm}km of ${lat},${lng}`,
  );
  return out.sort((a, b) => a.km - b.km).slice(0, 30);
}

export const nearbyAreas = paidAction({
  args: { radiusKm: v.optional(v.number()) },
  handler: async (ctx, { radiusKm = 20 }): Promise<NearbyArea[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in first.");

    let business = await ctx.runQuery(internal.google.businessForUser, {
      userId,
    });

    // Google leaves coordinates off plenty of listings; look them up from
    // the address rather than telling the owner we can't help.
    if (!business?.lat || !business?.lng) {
      await ctx.runAction(internal.google.ensureCoordinates, { userId });
      business = await ctx.runQuery(internal.google.businessForUser, {
        userId,
      });
    }
    if (!business?.lat || !business?.lng) {
      throw new ConvexError(
        "We couldn't work out where your shop is. Check the address in step 2.",
      );
    }

    const clampedRadius = Math.min(Math.max(radiusKm, 2), 50);
    const lat = business.lat;
    const lng = business.lng;

    const fromOverpass = await overpassNearby(lat, lng, clampedRadius);
    if (fromOverpass && fromOverpass.length > 0) return fromOverpass;

    const fromGoogle = await googleGeocodingNearby(lat, lng, clampedRadius);
    if (fromGoogle && fromGoogle.length > 0) return fromGoogle;

    // Overpass answering with a believable empty result (no other mirror
    // disagreed) is not an error — some rural coordinates genuinely have
    // nothing named around them at this radius.
    if (fromOverpass) return fromOverpass;

    console.error("[nearbyAreas] overpass and google places both failed");
    throw new ConvexError(
      "Couldn't reach the map service just now. Add your areas by hand, or try again in a minute.",
    );
  },
});
