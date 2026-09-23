import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  dataForSeoMapsSearch,
  dataForSeoRelatedQueries,
  dataForSeoTrendDemand,
  googleAutocomplete,
} from "./searchProviders";

const originalAuth = process.env.DATAFORSEO_AUTH;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function successfulTask(items: unknown[]) {
  return {
    status_code: 20000,
    tasks: [
      {
        status_code: 20000,
        result: [{ items }],
      },
    ],
  };
}

describe("search providers", () => {
  beforeEach(() => {
    process.env.DATAFORSEO_AUTH = "base64-login-password";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalAuth === undefined) delete process.env.DATAFORSEO_AUTH;
    else process.env.DATAFORSEO_AUTH = originalAuth;
  });

  test("reads Google's free autocomplete response", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse([
        "dentist",
        ["Dentist near me", "dentist in Agra", ""],
      ]),
    );

    await expect(googleAutocomplete("dentist")).resolves.toEqual([
      "dentist near me",
      "dentist in agra",
    ]);

    const url = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(url.hostname).toBe("suggestqueries.google.com");
    expect(url.searchParams.get("client")).toBe("firefox");
    expect(url.searchParams.get("gl")).toBe("in");
  });

  test("normalises DataForSEO Maps results to the app shape", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        successfulTask([
          {
            type: "maps_search",
            rank_group: 3,
            rank_absolute: 4,
            title: "Agra Dental Care",
            rating: { value: 4.7, votes_count: 128 },
            category: "Dentist",
          },
          { type: "maps_paid_item", rank_group: 1, title: "Ad" },
        ]),
      ),
    );

    await expect(
      dataForSeoMapsSearch("dentist near me", 27.1767, 78.0081),
    ).resolves.toEqual([
      {
        position: 3,
        title: "Agra Dental Care",
        rating: 4.7,
        reviews: 128,
        type: "Dentist",
      },
    ]);

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.headers).toMatchObject({
      Authorization: "Basic base64-login-password",
    });
    expect(JSON.parse(String(init?.body))).toEqual([
      expect.objectContaining({
        keyword: "dentist near me",
        location_coordinate: "27.1767000,78.0081000,14z",
        search_places: false,
      }),
    ]);
  });

  test("reads related and rising queries from DataForSEO Trends", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        successfulTask([
          {
            type: "google_trends_queries_list",
            data: {
              top: [{ query: "Dentist near me", value: "100" }],
              rising: [{ query: "Emergency dentist", value: "350" }],
            },
          },
        ]),
      ),
    );

    await expect(
      dataForSeoRelatedQueries("dentist", "Uttar Pradesh"),
    ).resolves.toEqual({
      top: ["dentist near me"],
      rising: ["emergency dentist"],
    });
  });

  test("batches five Trends keywords and uses returned averages", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse(
        successfulTask([
          {
            type: "google_trends_graph",
            averages: [10, 20, 30, 40, 50],
            data: [],
          },
        ]),
      ),
    );

    const terms = ["one", "two", "three", "four", "five"];
    const scores = await dataForSeoTrendDemand(terms, "Delhi");
    expect([...scores.entries()]).toEqual([
      ["one", 10],
      ["two", 20],
      ["three", 30],
      ["four", 40],
      ["five", 50],
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
