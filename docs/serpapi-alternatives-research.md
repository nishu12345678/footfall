# Replacing SerpApi — research and implementation decision

> **Implemented:** Footfall no longer calls SerpApi. Google Autocomplete now
> uses the free suggestion feed directly; Maps ranks, competitors, Trends and
> keyword volume use the existing DataForSEO credential. This document records
> the research behind that choice.

You asked for a free (or cheaper) alternative to SerpApi for everything it was
used for in this app, and to consider Firecrawl. Short answer up front:

> **There is no single drop-in free replacement.** SerpApi wraps two very
> different kinds of Google data (autocomplete text, and live Google Maps
> local-pack results), and each needs a different substitute. Firecrawl
> can help with **one** of the four use cases, not all of them. For the
> rank-checking use case — the one that matters most for "did we move up
> in the local pack" — there is no truly free option that is also legal
> and reliable; the realistic move is to a **much cheaper pay-per-call**
> provider instead of a flat-fee-per-search one.

---

## Where SerpApi was used before the migration (4 call sites)

| # | File / function | SerpApi engine | What it answers |
|---|---|---|---|
| 1 | `keywords.ts` → `autocomplete()` | `google_autocomplete` | "What do people actually type?" (keyword discovery) |
| 2 | `keywords.ts` → `relatedQueries()` / `demandFor()` | `google_trends` | "How much interest does this phrase get?" (demand) |
| 3 | `gbp.ts` → `autocomplete()` / `competition()` | `google_autocomplete` + `google_maps` | Setup-time keyword research + competitor density |
| 4 | `performance.ts` → `mapsSearch()` | `google_maps` | **Rank checking** — where does the shop actually sit, per keyword, per point on the map (weekly cron + geo-grid) |

Two of these (`google_autocomplete`) are cheap/easy to replace for free.
Two of these (`google_maps` for competition + rank checking, and
`google_trends` for demand) are the hard ones.

---

## 1. Autocomplete (keyword discovery) — free replacement exists ✅

Google's own autocomplete endpoint is publicly reachable, unauthenticated,
and free. It's the same data SerpApi resells at a markup:

```
GET https://suggestqueries.google.com/complete/search?client=firefox&q=<seed>&gl=in&hl=en
```

I tested it just now and it works out of the box:

```
$ curl -s "https://suggestqueries.google.com/complete/search?client=firefox&q=granite%20shop%20near%20me&gl=in&hl=en"
["granite shop near me",["granite shop near me","granite shop hyderabad","granite shop near me open now", ...]]
```

**Recommendation:** replace `autocomplete()` in both `keywords.ts` and
`gbp.ts` with a direct call to this endpoint. It's what several
"free AnswerThePublic alternative" writeups document as the standard
approach ([apiserpent.com](https://apiserpent.com/blog/scrape-google-autocomplete-free), [tsecurity.de](https://tsecurity.de/de/3644546/it+programmierung/google+autocomplete+is+a+free+keyword+research+api/)).

**Caveats (small, worth knowing):**
- It's an undocumented Google endpoint, not a public API — Google could
  rate-limit or change it without notice. In practice it's stable and
  widely relied on. Footfall treats failures as optional: built local
  phrases keep keyword research useful without restoring SerpApi.
- No official SLA/ToS coverage, so don't hammer it — the app's current
  usage pattern (a handful of seed calls per keyword-research run) is
  well within safe, low-volume, human-triggered use.

---

## 2. Demand / "how popular is this phrase" (Google Trends) — mostly replaceable, with care

`relatedQueries()` and `demandFor()` call SerpApi's `google_trends` engine.
Google Trends itself has an internal (unofficial) JSON API that tools like
`pytrends` scrape directly — no key needed. I tried it directly and it is
**rate-limited hard** (got an immediate 429 on a single test call), which
matches widespread reports: Trends actively throttles/blocks scripted
access, especially from shared/cloud IPs. Libraries like `pytrends` work
but need backoff, retries, and sometimes rotating requests — brittle for a
production cron that already covers many shops.

**Options, in order of what I'd actually do:**

1. **Keep using the free Autocomplete signal you already have** (item 1
   above) as the *only* demand proxy — you're already doing that in
   `gbp.ts`'s `researchKeywords` ("how early Google suggests it" as demand),
   and the code comment in `gbp.ts` already says this is deliberate because
   nothing free gives real volume. This costs nothing and needs no new code.
2. **Where you truly want a number** (not just a rough popularity proxy),
   you already have **DataForSEO** wired in as the paid, accurate source
   (`keywords.ts` → `dataForSeoVolume`, real India monthly search volume
   from Google Ads' own data). DataForSEO also has a **Google Trends API**
   endpoint if you want trend shape instead of the unofficial scrape —
   cheap (roughly **$0.0006–$0.002 per request**, i.e. a few paise, not
   dollars) and legally sourced, vs. SerpApi's flat per-search pricing.
   ([DataForSEO SERP pricing](https://dataforseo.com/help-center/serp-api-cost-explained))
3. Don't self-scrape Trends for a production cron — it's free in theory
   but unreliable at your scale (many shops × weekly checks), and you'd
   spend engineering time fighting 429s for a signal you're already
   getting a better version of from DataForSEO.

**Recommendation:** no urgent change needed here — the current design
(autocomplete=free demand signal, DataForSEO=paid real volume when you
want it) is already close to optimal. If you want to fully retire SerpApi,
swap `relatedQueries`/`demandFor` to DataForSEO's Trends/related-queries
endpoints (cheap, same provider you already pay), rather than to a free
scrape.

---

## 3. Competitor density at setup time (`gbp.ts` → `competition()`)

This calls `google_maps` on SerpApi to count rivals and average their
review counts for a candidate keyword. Same underlying data need as #4
below — see that section for the real options. Practically: this one call
happens once per keyword during setup, so it's low-volume; the cheaper
per-call option in #4 covers it too.

---

## 4. Rank checking — the hard one (weekly cron + on-demand geo-grid)

This is `performance.ts` → `mapsSearch()`: real, live Google Maps local-pack
results, searched from real lat/lng coordinates, to find the shop's
position among rivals. This is also the **highest-value** use case — it's
the actual "did we move up" proof the whole product sells.

### Why there is no truly free option here

- **Firecrawl does not cover this.** I checked Firecrawl's `/search`
  endpoint directly — it returns generic **web / news / image** results
  ([Firecrawl search docs](https://docs.firecrawl.dev/features/search)),
  not Google Maps local-pack listings with position, rating, and review
  count per pin. Firecrawl is a *scrape/crawl* tool for reading pages
  (which this app already uses well, for `checkWebsite` in `audit.ts`),
  not a search-results API — it has no Maps/local-pack mode. It cannot
  replace `mapsSearch()`.
- **Google's own Places API (New)** looks tempting (Google data, official,
  has a free monthly quota — 10,000–70,000 free calls/month depending on
  SKU and India pricing) — but it **cannot be used for rank tracking**.
  Text Search / Nearby Search return results **re-ranked per-call by
  relevance/distance to your query**, not "this is position #4 in what a
  real searcher standing at this point would see." Google's own docs and
  developer community are explicit that Places API results don't mirror
  the consumer Search/Maps ranking, and Google's Terms of Service track
  and restrict this kind of "create a database of business rankings" use.
  It answers a different question than "where do I rank," so it doesn't
  substitute for SerpApi here even though it's partly free.
- **Scraping Google Maps directly** (no API) works technically but breaks
  Google's ToS, needs proxies/CAPTCHA-handling at any real volume, and is
  the thing SerpApi/DataForSEO/Apify exist specifically to absorb the risk
  and maintenance of. Not something to hand-roll into a cron that runs
  weekly across every paying customer.

### The realistic fix: switch providers, not categories

SerpApi's own pricing is the actual problem — it's a **flat monthly
search-count plan** ($25/mo for 1,000 searches, i.e. **2.5¢ per search**
minimum — [serpapi.com/pricing](https://serpapi.com/pricing.md)). Every
other serious provider charges **per call**, which is dramatically cheaper
at this app's volume (a handful of keywords × a few points × weekly, per
shop):

| Provider | Price per Maps search | Notes |
|---|---|---|
| **SerpApi** (former) | ~$0.025/search (cheapest plan) | Flat monthly tiers; removed from Footfall |
| **DataForSEO Google Maps SERP API** | **$0.0006 – $0.002/search** | Same provider you already integrate for keyword volume; one Basic auth header; ~10–40x cheaper than SerpApi. [Pricing](https://dataforseo.com/pricing/google-serp/google-maps-serp-api) |
| **Litescrape `/google/maps` & `/google/local`** (found via `monid discover`) | **$0.00015/call** | Pay-per-call, no subscription; returns `local_results` with `position`, `title`, `rating`, `reviews`, `place_id` — same shape you already parse from SerpApi. ~150x cheaper than SerpApi per call. Marked "degraded" health at time of research — verify uptime before relying on it for the weekly cron. |
| Apify Google Maps scrapers | ~$0.0045/result | Middle ground; more mature/maintained than a raw scraper, still far cheaper than SerpApi |

**Recommendation:** Since you already have a DataForSEO account
(`DATAFORSEO_AUTH` is already wired in `keywords.ts`), the lowest-effort,
lowest-risk move is:

> **Replace `mapsSearch()` in `performance.ts` (and `competition()` in
> `gbp.ts`) with DataForSEO's Google Maps SERP API**, using the same
> `DATAFORSEO_AUTH` credential you already have. It returns the same kind
> of `local_results` array (position, title, rating, review count) that
> `findRank()` already parses, so the change is mostly swapping the
> request/response shape in one function, not a redesign. Cost drops from
> ~2.5¢/search to ~0.1¢/search — for the weekly cron (5 points × up to 6
   "near me" keywords + city keywords, times however many shops), that's
  roughly a **90%+ reduction in this line item.**

If you want to go even cheaper and are comfortable adding a second
provider, **Litescrape** (surfaced by `monid discover`, not something I'd
heard of before searching) is ~15x cheaper again ($0.00015/call) and
returns the same fields — but check its live health/uptime first since it
showed as "degraded" during this research; keep DataForSEO as a fallback if
you adopt it.

---

## What was implemented

1. **Autocomplete → free.** Both `autocomplete()` functions (`keywords.ts`,
   `gbp.ts`) now use `suggestqueries.google.com`. Zero cost and no new vendor.
2. **Rank checking + competition → DataForSEO.** `mapsSearch()`
   (`performance.ts`) and `competition()` (`gbp.ts`) now use DataForSEO's
   live Google Maps SERP API with exact coordinates.
3. **Trends/demand → DataForSEO.** Related queries and five-term demand
   comparisons now use DataForSEO's Google Trends endpoint. Direct Trends
   scraping was rejected because it returned HTTP 429 in testing.
4. **Firecrawl stays exactly where it already is** — reading a shop's own
   website (`checkWebsite`, `about.suggest`, `branding.ts` logo lookup).
   It's the right tool for that job and was never a fit for search-results
   or Maps-ranking data; don't try to stretch it into #2 or #3.

**Net effect:** `SERPAPI_KEY` can be retired entirely, cutting cost on the
autocomplete calls to zero and cutting cost on the maps/rank-check calls
by roughly an order of magnitude, by routing everything through the
DataForSEO account this app already has plus one free unauthenticated
Google endpoint — no new vendor relationship required.

## Sources

- [Firecrawl Search docs](https://docs.firecrawl.dev/features/search) — confirms search result types are `web`/`news`/`images` only, no Maps/local-pack mode.
- [SerpApi pricing](https://serpapi.com/pricing.md) — $25/mo minimum paid tier, 1,000 searches.
- [DataForSEO Google Maps SERP API pricing](https://dataforseo.com/pricing/google-serp/google-maps-serp-api) — $0.0006–$0.002 per SERP page depending on priority.
- [DataForSEO SERP API cost explainer](https://dataforseo.com/help-center/serp-api-cost-explained)
- `monid discover` results for Litescrape `/google/maps`, `/google/local` — $0.00015/call, live-inspected schema returning `local_results` with `position`/`rating`/`reviews`.
- [Google Maps Platform March 2025 pricing changes](https://developers.google.com/maps/billing-and-pricing/march-2025) — confirms Places API (New) free-tier structure and why it's not a rank-tracking substitute (relevance-ranked, not position-of-truth).
- Free Google Autocomplete endpoint verified live in this session: `suggestqueries.google.com/complete/search`.
- [Scrape Google Autocomplete free — apiserpent.com](https://apiserpent.com/blog/scrape-google-autocomplete-free)
- Google Trends unofficial endpoint tested live — returned HTTP 429 on first call, corroborating known throttling behavior.
