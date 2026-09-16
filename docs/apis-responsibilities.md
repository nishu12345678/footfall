# SerpApi and DataForSEO Usage

## SerpApi

SerpApi is used for reading Google search-related data.

### 1. Google Autocomplete Suggestions

Gets search suggestions based on what users type into Google.

**Example:**

When a user types:

`dentist`

Google may suggest:

- `dentist near me`
- `dentist in agra`
- `dentist near me open now`

### 2. Google Trends Related Queries

Finds search queries related to the business offering.

This helps identify what people are searching for around a particular service or business category.

### 3. Google Trends Demand

Provides relative search interest for keywords over time.

> **Note:** Google Trends provides relative interest, not exact monthly search volume.

### 4. Google Maps Rankings

Searches Google Maps for a keyword near the business location.

**Example:**

For a dentist, we can search:

`dentist`

and determine where the business appears among the local Google Maps results.

### 5. Competitor Strength

Looks at the top Google Maps results for a keyword and evaluates competitor strength using factors such as:

- Ranking position
- Review count
- Presence among top local results

---

## DataForSEO

DataForSEO is used for keyword metrics and search-volume data.

### 1. Monthly Search Volume

Provides estimated monthly search volume for keywords.

**Example:**

`dentist near me` → estimated searches per month

### 2. Keyword Competition

Provides an estimate of how competitive a keyword is based on Google Ads data.

### 3. CPC

Provides the approximate **Cost Per Click (CPC)** for a keyword.

CPC represents the approximate amount advertisers pay when someone clicks on an ad for that keyword.

### 4. Keyword Metrics

DataForSEO helps replace guesswork with actual keyword metrics when available, such as:

- Monthly search volume
- Keyword competition
- CPC

---

## Google Ads

Google Ads is **not used for running advertising campaigns or spending money on ads**.

Google Ads data is used **only as a data source through DataForSEO** for keyword metrics such as:

- CPC
- Keyword competition

We are **not running Google Ads campaigns**.

---

## Simple Difference

| Tool | Purpose |
|---|---|
| **SerpApi** | Reads Google Autocomplete, Google Trends, Google Search, and Google Maps results |
| **DataForSEO** | Provides keyword metrics such as monthly search volume, competition, and CPC |
| **Google Ads** | Only provides underlying advertising data used by DataForSEO; we do not run ads |

### Summary

> **SerpApi = What Google shows people**  
> **DataForSEO = Keyword metrics**  
> **Google Ads = Data source for CPC/competition through DataForSEO**  
> **No Google Ads spending or campaigns**
