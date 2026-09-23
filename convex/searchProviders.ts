import { ConvexError } from "convex/values";

/** The small, stable shape the rest of the app needs from a Maps SERP. */
export type LocalSearchResult = {
  position: number;
  title: string;
  rating?: number;
  reviews?: number;
  type?: string;
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/**
 * Google Search's lightweight suggestion feed.
 *
 * It needs no API key. This is intentionally isolated here because it is an
 * undocumented endpoint: callers get an empty list if Google changes or
 * throttles it, while the built keyword patterns still keep research useful.
 */
export async function googleAutocomplete(seed: string): Promise<string[]> {
  const url = new URL("https://suggestqueries.google.com/complete/search");
  url.searchParams.set("client", "firefox");
  url.searchParams.set("q", seed);
  url.searchParams.set("gl", "in");
  url.searchParams.set("hl", "en");

  try {
    const response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      console.warn(`[autocomplete] Google returned ${response.status}`);
      return [];
    }

    const payload: unknown = await response.json();
    const suggestions = Array.isArray(payload) ? payload[1] : null;
    return asArray(suggestions)
      .map(asString)
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase().trim())
      .filter(Boolean);
  } catch (error) {
    console.warn("[autocomplete] request failed", error);
    return [];
  }
}

function dataForSeoAuth(required: boolean): string | null {
  const auth = process.env.DATAFORSEO_AUTH?.trim();
  if (auth) return auth;
  if (required) {
    throw new ConvexError(
      "Rank checks aren't set up on this server yet. Add DATAFORSEO_AUTH.",
    );
  }
  return null;
}

type DataForSeoTask = {
  status_code?: number;
  status_message?: string;
  result?: unknown[];
};

type DataForSeoResponse = {
  status_code?: number;
  status_message?: string;
  tasks?: DataForSeoTask[];
};

async function dataForSeoPost(
  endpoint: string,
  task: JsonObject,
  required: boolean,
): Promise<unknown[] | null> {
  const auth = dataForSeoAuth(required);
  if (!auth) return null;

  let response: Response;
  try {
    response = await fetch(`https://api.dataforseo.com/v3/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([task]),
    });
  } catch (error) {
    console.error(`[dataforseo] ${endpoint} request failed`, error);
    if (required) {
      throw new ConvexError(
        "The search provider couldn't answer just now. Try again in a moment.",
      );
    }
    return null;
  }

  let payload: DataForSeoResponse;
  try {
    payload = (await response.json()) as DataForSeoResponse;
  } catch {
    payload = {};
  }

  const taskResult = payload.tasks?.[0];
  const ok =
    response.ok &&
    payload.status_code === 20000 &&
    taskResult?.status_code === 20000;

  if (!ok) {
    console.error(
      `[dataforseo] ${endpoint}: HTTP ${response.status}; ` +
        `${payload.status_code ?? "?"} ${payload.status_message ?? ""}; ` +
        `${taskResult?.status_code ?? "?"} ${taskResult?.status_message ?? ""}`,
    );
    if (required) {
      throw new ConvexError(
        "The search provider couldn't answer just now. Try again in a moment.",
      );
    }
    return null;
  }

  return taskResult.result ?? [];
}

/** Live Google Maps results at one exact viewport, through DataForSEO. */
export async function dataForSeoMapsSearch(
  keyword: string,
  lat: number,
  lng: number,
  zoom = 14,
): Promise<LocalSearchResult[]> {
  const results = await dataForSeoPost(
    "serp/google/maps/live/advanced",
    {
      keyword,
      language_code: "en",
      location_coordinate: `${lat.toFixed(7)},${lng.toFixed(7)},${zoom}z`,
      search_this_area: true,
      // Local-intent queries must respect the supplied viewport rather than
      // letting Google's place interpretation move the search elsewhere.
      search_places: false,
      depth: 100,
    },
    true,
  );

  const first = results?.[0];
  const items = isObject(first) ? asArray(first.items) : [];
  const out: LocalSearchResult[] = [];

  for (const raw of items) {
    if (!isObject(raw) || raw.type !== "maps_search") continue;
    const position = asNumber(raw.rank_group) ?? asNumber(raw.rank_absolute);
    const title = asString(raw.title);
    if (position === undefined || !title) continue;

    const rating = isObject(raw.rating) ? raw.rating : null;
    out.push({
      position,
      title,
      rating: rating ? asNumber(rating.value) : undefined,
      reviews: rating ? asNumber(rating.votes_count) : undefined,
      type: asString(raw.category),
    });
  }

  return out;
}

function trendsLocation(state?: string): string {
  return state?.trim() ? `${state.trim()},India` : "India";
}

async function trendsExplore(
  task: JsonObject,
  state?: string,
): Promise<JsonObject[]> {
  const request = {
    ...task,
    location_name: trendsLocation(state),
    language_code: "en",
    type: "web",
    time_range: "past_12_months",
  };

  let results = await dataForSeoPost(
    "keywords_data/google_trends/explore/live",
    request,
    false,
  );

  // A state spelling that is not in DataForSEO's location catalogue should
  // not sink keyword research. Country-level Trends is still a real signal.
  if (results === null && state?.trim()) {
    results = await dataForSeoPost(
      "keywords_data/google_trends/explore/live",
      { ...request, location_name: "India" },
      false,
    );
  }

  const first = results?.[0];
  const items = isObject(first) ? asArray(first.items) : [];
  return items.filter(isObject);
}

/** Related and rising Google Trends queries for one seed. */
export async function dataForSeoRelatedQueries(
  seed: string,
  state?: string,
): Promise<{ top: string[]; rising: string[] }> {
  const items = await trendsExplore(
    {
      keywords: [seed],
      item_types: ["google_trends_queries_list"],
    },
    state,
  );
  const item = items.find(
    (candidate) => candidate.type === "google_trends_queries_list",
  );
  const data = item && isObject(item.data) ? item.data : null;

  const readQueries = (value: unknown) =>
    asArray(value)
      .map((row) => (isObject(row) ? asString(row.query) : undefined))
      .filter((query): query is string => Boolean(query))
      .map((query) => query.toLowerCase().trim())
      .filter(Boolean);

  return {
    top: readQueries(data?.top),
    rising: readQueries(data?.rising),
  };
}

/** Relative Google Trends demand, batched at DataForSEO's five-keyword cap. */
export async function dataForSeoTrendDemand(
  terms: string[],
  state?: string,
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();

  for (let index = 0; index < terms.length; index += 5) {
    const batch = terms.slice(index, index + 5);
    const items = await trendsExplore(
      { keywords: batch, item_types: ["google_trends_graph"] },
      state,
    );
    const graph = items.find(
      (candidate) => candidate.type === "google_trends_graph",
    );

    const averages = graph ? asArray(graph.averages) : [];
    if (averages.length === batch.length) {
      batch.forEach((term, termIndex) => {
        scores.set(term, asNumber(averages[termIndex]) ?? 0);
      });
      continue;
    }

    // Be defensive about older response shapes: derive the average from each
    // timeline row's values array when the top-level averages are absent.
    const totals = batch.map(() => 0);
    const counts = batch.map(() => 0);
    for (const rawPoint of graph ? asArray(graph.data) : []) {
      if (!isObject(rawPoint)) continue;
      asArray(rawPoint.values).forEach((rawValue, termIndex) => {
        const value = asNumber(rawValue);
        if (value === undefined || termIndex >= batch.length) return;
        totals[termIndex] += value;
        counts[termIndex] += 1;
      });
    }
    batch.forEach((term, termIndex) => {
      const count = counts[termIndex];
      const average = count > 0 ? totals[termIndex] / count : 0;
      scores.set(term, Math.round(average * 10) / 10);
    });
  }

  return scores;
}
