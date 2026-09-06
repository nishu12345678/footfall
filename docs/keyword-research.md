# How Keyword Research Works in footfall

This explains how footfall finds the exact phrases people type into Google when they want to buy from a local shop, and how those phrases end up on the shop's tracked list.

Running example used throughout: **Bansal Minerals**, a tile shop in Agra. The owner told footfall it sells *Floor Tiles*, *Bathroom Fittings*, and *Granite Supply*.

**The goal:** find the phrases people in Agra actually type into Google when they want to buy tiles, so footfall can check where the shop ranks for them and write posts about them.

---

## Terms and what they mean

| Term | Meaning |
|---|---|
| **Keyword** | A phrase someone types into Google. "tile shop near me" is a keyword. |
| **Seed** | The starting word we hand to Google to get ideas back. Seeds come from what the shop sells. "Granite Supply" becomes the seed "granite", because people search for the product, not the shop's catalogue name. |
| **Google Autocomplete** | The dropdown that appears while you type in Google. Type "tiles" and Google suggests "tiles near me", "tiles price", "tiles design for hall". Those suggestions are real things people searched. |
| **Google Trends** | Google's public tool showing how popular a search term is over time in a region. It also lists "related queries" — other searches people made along with your term. Trends gives *relative* popularity (0–100), not a count of searches. |
| **Search volume** | The actual number of times a phrase is searched per month, for a city. Google only shares this through its ads system. |
| **Head term** | The one- or two-word product at the core of a phrase. The head of "best granite shop near me" is "granite". |
| **Buying intent** | Whether the searcher wants to buy or just read. "tile shop near me" is buying. "how to clean tiles" is reading. Only buying searches bring walk-ins. |
| **Winnability** | How hard it would be to reach the top three on the map for a phrase. Measured by how many reviews the current top-three shops have. |
| **Targeted / Tracked** | A keyword the shop has chosen to track. Rank checks run only on these. |

## Which API does what

| API | What we use it for |
|---|---|
| **SerpAPI** | Fetches Google Autocomplete suggestions and Google Trends related queries by code. Also runs the map searches used for rank checks and competition checks. |
| **DataForSEO** | Gives real monthly search volume per city (it reads the numbers from Google's ads system and sells them to us). |
| **OpenAI** | Acts as a filter, once, on the candidate list. It can only *remove* phrases — never add them. |

---

## The algorithm, step by step

### 1. Make seeds

Take the shop's category plus its offerings and clean them up.

Result for Bansal Minerals: `tile shop`, `floor tiles`, `bathroom fittings`, `granite`.

### 2. Build the obvious phrases without asking anyone

For each seed, four fixed patterns. From "granite":

- granite near me
- best granite near me
- granite shop near me
- granite in agra

These are added by hand because Google's suggestions kept missing them, and they are the phrases that matter most.

### 3. Ask Google for more ideas

For each seed, two requests through SerpAPI:

1. **Autocomplete** — type "granite" and take the dropdown.
2. **Trends related queries** — for the shop's state (Uttar Pradesh) over the past year.

Together this might return: "granite price", "granite kitchen slab", "nissan granite", "granite shop thrissur", "how to polish granite", "granite colours".

### 4. Throw out junk with simple rules

No AI yet — just word lists:

- Drop anything with "how to", "images", "vs", and similar reading-only words.
- Drop anything naming another city (Thrissur, Delhi, …).
- Keep only phrases that contain a buying word: *shop*, *price*, *near me*, *best*, or the shop's own city.
- Keep phrases between 2 and 6 words.
- Cap the list at 28.

After this step "how to polish granite" and "granite shop thrissur" are gone. "nissan granite" survives — the rules can't tell it's a car.

### 5. Let the AI judge, once

One request to OpenAI with the shop's details and the surviving list. The instruction: **keep only phrases where the searcher could walk into this shop and buy.**

It removes "nissan granite". For every phrase it keeps, it names the head term.

This is the *only* place AI chooses keywords. It cannot add phrases, only remove them.

### 6. Measure search volume

One request to DataForSEO for all survivors in Agra. Example result:

- "tiles near me" — 1,900/month
- "granite shop near me" — 320/month
- "granite colours" — 90/month

Fallbacks, in order:

1. If DataForSEO returns nothing for the city → retry for **all of India**.
2. If still nothing → fall back to **Google Trends**, comparing head terms against each other for a relative score.

### 7. Optional deep run: check the competition

For each survivor, one map search from the shop's own location. Look at the top three results and average their review counts.

- Top three for "tiles near me" have ~400 reviews each → hard.
- Top three for "granite shop near me" have ~30 each → beatable.

### 8. Score and rank

Each phrase gets a number:

- Higher search volume → higher score.
- **"Near me" phrases get a big bonus (+4 points)** because that's what people actually type. A phrase naming the city gets only +0.5.
- In a deep run, beatable phrases score higher too.

The top fifteen are shown to the owner, each with a one-line reason, e.g. *"320 searches a month in Agra. Top 3 average 30 reviews, beatable."*

### 9. Save

From the top fifteen, the best **six "near me" phrases** are put on the tracked list automatically. The owner can add any of the others with a click, type their own, or remove any.

---

## What happens with the tracked list

Rank checks run **only** on tracked keywords, and the two kinds are treated differently:

- **"Near me" phrases** (capped at six) — searched from **five spots around the shop**, because someone three kilometres away sees a different map.
- **City phrases** like "granite in agra" — searched **once from the shop's own location**.

The same tracked list is also handed to the **post writer** as subjects and to the **service page generator**.

## So do we only track "near me" phrases?

Not only — but by default, yes.

**Tracked automatically:** after research, footfall takes the top fifteen results and saves only the "near me" / "nearby" phrases among them, at most six. If the owner does nothing else, those six are the entire tracked list.

**What the owner can add:** every phrase in the results list has a plus button — including city phrases like "granite in agra" and plain product phrases like "granite price". Clicking it tracks that phrase too. The owner can also type any phrase by hand. Anything added this way is tracked exactly like the automatic ones.

**Why the default leans this way.** Two deliberate choices in the code:

1. Scoring gives "near me" phrases a +4 bonus vs +0.5 for city phrases, so the top fifteen is already dominated by them.
2. The auto-save step picks only "near me" phrases. A shop should never finish setup tracking nothing but city phrases — "dentist in agra" is what agency reports contain, "dentist near me" is what people actually type.

**Honest summary:** footfall strongly prefers "near me" phrases and tracks them without asking, but nothing stops the owner from tracking anything else.

## Who decides what

| Actor | Decides |
|---|---|
| **The owner** | The offerings (which become seeds), and the final say on the tracked list. |
| **Google's own data** | Every candidate phrase and every search count. |
| **Fixed rules** | The rough cleaning (junk words, other cities, word count). |
| **The AI** | Acts only as a filter for cases rules cannot judge. It never adds phrases. |
