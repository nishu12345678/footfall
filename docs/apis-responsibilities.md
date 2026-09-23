# Search-data API responsibilities

## Free Google Autocomplete

Footfall calls Google's lightweight suggestion feed directly:

`https://suggestqueries.google.com/complete/search`

It is used only for keyword discovery: finding the phrases Google suggests
while a customer types, such as:

- `dentist near me`
- `dentist in agra`
- `dentist near me open now`

This endpoint requires no API key. It is undocumented, so failures are treated
as optional: built local phrases still keep keyword research useful.

---

## DataForSEO

One DataForSEO credential powers all paid search-data features. The Convex
variable is:

`DATAFORSEO_AUTH=base64(api-login:api-password)`

### 1. Google Maps ranking

The live Google Maps SERP API searches a keyword from the business's exact
latitude, longitude and zoom. Footfall uses the returned Maps order to measure:

- the listing's position for each tracked keyword;
- coverage across five points around the business;
- the manual 3×3 geo-grid;
- weekly movement in ranking.

### 2. Competitor strength

The same Maps response provides the businesses currently ranking nearby,
including:

- position;
- rating;
- review count;
- primary category.

Footfall uses this to record the top competitors and estimate whether a
keyword is realistically winnable.

### 3. Google Trends related queries

DataForSEO's Google Trends endpoint returns top and rising searches related to
a business offering. These expand the keyword pool beyond Autocomplete.

### 4. Google Trends demand

The Trends graph compares up to five terms at once and returns relative search
interest over the last 12 months. This is a relative 0–100 signal, not monthly
search volume.

### 5. Monthly keyword metrics

DataForSEO's Google Ads keyword-data endpoint provides, when available:

- estimated monthly search volume;
- Google Ads competition;
- approximate cost per click (CPC).

Google Ads data is used only as a data source. Footfall does not create or run
ad campaigns and does not spend money on Google Ads.

---

## Firecrawl

Firecrawl reads websites, not Google Maps rankings. Footfall uses it to:

- inspect the business's existing website for the free audit;
- give the AI real website context when suggesting offerings;
- find logo candidates.

It is not used for Autocomplete, Trends, rank checking or geo-grids.

---

## Simple difference

| Tool | Purpose |
|---|---|
| **Google Autocomplete** | Free, keyless keyword suggestions |
| **DataForSEO** | Maps ranks, competitors, Trends and keyword metrics |
| **Firecrawl** | Reads the business's own website |
| **Google Ads** | Underlying keyword-volume/CPC data only; no ad campaigns |

SerpApi is no longer used by the application.
