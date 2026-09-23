# How Footfall improves a Google listing — in plain words

Footfall is an agent for a shop's Google Business Profile (GBP). It does not
just *read* the listing and show reports. It *acts* on the listing every week
— writes posts, answers reviews, uploads photos, fills in services — and it
asks the owner's permission before anything risky goes out under the shop's
name.

This doc lists, in simple words, exactly what the app does, what the AI
does, and why each action moves the listing up.

---

## The one-line version

> Google ranks the listing that looks **alive, complete, and answered**.
> Footfall keeps a listing alive (posts + photos every week), complete
> (services, hours, categories, website), and answered (every review gets a
> reply) — automatically, with the owner approving anything sensitive.

---

## The core flows, most effective first

### 1. Reviews — every review gets a reply, fast

**Why it matters:** Replying to reviews is a ranking signal Google itself
lists. Shops that answer most of their reviews sit roughly two positions
higher in the local pack, and answering within a day is worth more than
answering in a week. An unanswered complaint also scares off every future
customer who reads it.

**What the app does:**
- Pulls new reviews from Google **every 4 hours** (cron: `sync gbp reviews`).
- Publishes the reply back to Google through the GBP API.
- Keeps a log ("agent actions") so the owner can see what was answered and when.

**What the AI does:**
- Writes a reply **against the actual review text**, using the shop's name,
  what it sells, and the shop's last 5 replies — so no two replies open the
  same way and nothing reads templated.
- **Praise (4–5 stars): replied automatically.** No waiting on the owner.
- **Complaints (3 stars or less): drafted and held.** The owner reads the
  draft, edits or asks for a rewrite, and only then it goes to Google. A
  wrong word under the shop's own name is a public liability.

### 2. Getting more reviews — ask every customer

**Why it matters:** Review count and freshness are among the strongest
signals for "near me" searches. Shops above you typically carry 25+ reviews.

**What the app does (no AI needed here):**
- Keeps a small customer list (schema supports manual, QR and import
  sources; today this is backend-driven, with no dedicated screen yet).
- Sends each customer a **WhatsApp message first, SMS as fallback** (via
  Twilio) with the shop's direct Google review link.
- Never sends the same person the invite twice in a day (dedupe).
- The free generated website also carries a "leave a review" link that
  points straight at the Google review box.

### 3. Google Posts — something new on the listing every week

**Why it matters:** A Google post loses most of its weight after about a
week. A listing that posts regularly gets more room in the local pack; one
with no posts looks dormant.

**What the app does:**
- Publishes approved posts to Google on a schedule: **3 posts a week**, at a
  fixed morning slot (cron: `publish scheduled posts`). Not daily — daily
  posting on a small shop reads as automated to Google.
- **Tops up the plan every Sunday** (cron: `top up the post plan`) so the
  shop never runs out of drafts and the profile never goes quiet.
- Also syncs posts *from* Google, so posts the owner made themselves count.

**What the AI does:**
- **Plans the content**: researches what this kind of shop in this city
  should post about (services, seasons, offers) and lays out a plan.
- **Writes each post** around the shop's real services and the keywords
  being targeted.
- **Illustrates it**: uses the shop's own Google photos when they exist
  (a real photo always beats a generated one); generates an image only when
  the shop has none.
- Everything the AI writes lands as a **draft**. Nothing is scheduled, let
  alone published, until the owner approves it.

### 4. Keywords — find winnable searches, then track them weekly

**Why it matters:** Almost every call comes from the top 3 map results (the
"local pack"). If nobody has worked out what local customers actually type,
the listing is written around the wrong words.

**What the app does:**
- Harvests real search phrases from **Google Autocomplete**, seeded with the
  shop's category, city, and offerings. If Google suggests a phrase, people
  are typing it — that is free, honest demand data.
- Adds pattern phrases ("X near me", "best X near me", "X in <city>") and
  Google Trends related queries; pulls **real monthly search volume** per
  city (DataForSEO) when configured — it never invents volumes.
- Checks the shop's **actual map position** for each tracked keyword
  **every Monday** using real Google Maps results through DataForSEO. "Near me"
  keywords are searched from **5 points** (the shop + 4 compass points at
  the shop's pull radius); city keywords once from the shop itself.
- Records the **top 8 competitors** per keyword (name, rating, review
  count, average position) on every check, so the owner sees who they are
  actually losing to.
- On demand, runs a **3×3 geo-grid**: the same keyword searched from 9
  points around the shop, so the owner sees a map of how far their ranking
  reaches.

**What the AI does:**
- **Filters the harvest**: keeps only phrases where the searcher could
  realistically walk into *this* shop and buy — drops far-away areas, wrong
  products that share a word, and "information only" searches.
- **Suggests keywords** the shop should target for its category and city.
- **Estimates the shop's pull radius** ("how far will someone travel for a
  marble dealer vs a salon?") so rank checks cover the right area — a
  dentist is checked over a few km, a furniture shop across the city.

### 5. Listing completeness — services, hours, categories, attributes

**Why it matters:** Google reads the services list to decide which searches
the shop is relevant to. Missing hours can get a listing hidden from
"open now" searches. Secondary categories are free extra reach.

**What the app does:**
- Guided setup for service areas, opening hours, attributes (UPI, parking,
  home delivery…), and everything the shop sells.
- **Pushes the services list to Google** (a real `PATCH` on the listing's
  `serviceItems`), so the profile itself is rewritten — not just our copy
  of it. This runs both from the owner's button and **automatically every
  week** as part of the plan top-up.
- Honest note: today only *services* are written to Google. Hours,
  attributes, service areas and categories are collected and used
  everywhere in the app (audit, website, posts) but are **not yet pushed
  to the Google listing** — see "Not built yet" below.

**What the AI does:**
- **Suggests offerings and specialties** from the shop's category, city and
  website; the owner taps to accept — nothing is added on their behalf.
- **Translates the shop's own words into Google's official service IDs**
  ("teeth cleaning" → Google's "Dental cleaning"), so services land as
  structured data Google fully understands, not free text.

### 6. Photos — four a week, spaced out

**Why it matters:** Listings with 30+ photos get materially more direction
requests and calls. But 30 photos dumped at once reads as a one-off, and
Google can stop accepting uploads for a fortnight over it.

**What the app does (no AI needed here):**
- Owner uploads photos into a queue; the app **publishes about four a week**
  (Mon/Wed/Fri/Sat) so it reads like a shop someone is running.
- **Mirrors the Google gallery back daily**, so a photo deleted on Google
  also disappears from the shop's Footfall website.

### 7. A free website that matches the listing

**Why it matters:** A listing without a website loses to one with a website
almost every time. And the name, address and phone (NAP) on the site must
match Google exactly — that consistency is one of the few local-SEO levers
a small shop fully controls.

**What the app does:**
- Builds and hosts a one-page site at `<shopname>.footfall.zone`, straight
  from the Google listing: same name, address, phone, real opening hours,
  reviews, photos, and **LocalBusiness structured data** for Google.
- For shops that already have a website: fetches the page and runs basic
  checks (usable title, meta description, enough text, names the city,
  shows the phone number).

**What the AI does:**
- **Writes the site copy** — headline, about text, 10–14 service
  descriptions, FAQs, meta title/description — working the city, locality
  and searched phrases in naturally. Strict rules: it may not invent
  prices, awards, timings, or services the shop doesn't offer.
- For an existing website that fails checks, writes **one plain-English
  instruction per problem** ("add your phone number near the top"), no
  SEO jargon.

### 8. The free audit — the truth about the listing

**Why it matters:** This is the report that shows an owner what's broken
before they pay anything. It reads the *live* listing (posts, photos,
reviews, performance) so it can't invent problems.

**What the app checks (rules, no AI):**

| Check | Flagged when |
|---|---|
| Posting | Never posted, or last post > 30 days old |
| Review replies | Any review without a reply (worse if ≤3 stars) |
| Review count | Fewer than 25 reviews (critical under 10) |
| Photos | Fewer than 30 photos (critical under 10) |
| Keywords | None tracked, or not in the top 3 for any |
| Hours | Opening hours not set |
| Services | No services pushed to the profile |
| Categories | Only one category on the listing |
| Website | Missing, unreachable, or thin (no title/description/city/phone) |

Each finding says what's wrong, why it costs the shop, and what Footfall
will do about it. The findings roll up into a simple score.

### 9. Watching results — proof it's working

**What the app does (no AI):**
- Every night, pulls Google's own performance numbers: calls, direction
  requests, website clicks, how often the listing appeared, and **the actual
  search terms people used** to find the shop.
- Every Monday, re-checks keyword ranks, so the owner sees position moving
  week over week.

---

## What runs by itself vs. what waits for the owner

| Action | Automatic? |
|---|---|
| Reading reviews, photos, posts, performance from Google | ✅ Fully automatic (crons) |
| Reply to a **positive** review | ✅ Written and published automatically |
| Reply to a **negative** review (≤3★) | ✋ AI drafts it; owner approves |
| Writing posts | ✋ AI drafts; owner approves and schedules |
| Publishing approved posts | ✅ Automatic, 3/week at the slot time |
| Topping up the post plan | ✅ Automatic every Sunday (drafts only) |
| Publishing photos from the queue | ✅ Automatic, ~4/week |
| Suggesting keywords / offerings | ✋ Suggestions only; owner accepts |
| Pushing services to Google | ✅ Owner button **and** automatic weekly |
| Weekly rank check, nightly metrics | ✅ Automatic |
| Review invite to a customer | ✋ Owner adds the customer; app sends |

Everything automatic is gated by one switch: the **agent Active/Paused**
flag on the dashboard. A paused agent syncs nothing and publishes nothing.

The rule throughout the code: **the owner's say-so is the one thing the
agent can't supply.** Drafts everywhere; auto-publish only where the
downside is near zero (thanking a happy customer).

## The weekly rhythm (cron schedule, IST)

| When | What |
|---|---|
| Every 4 hours | Sync reviews (and draft/publish replies) |
| Daily 07:00 | Sync Google performance metrics |
| Daily 08:00 | Mirror the photo gallery from Google |
| Daily 11:00 | Publish any post due today |
| Daily 17:00 | Publish the next queued photo (Mon/Wed/Fri/Sat) |
| Sunday 08:30 | Top up the post plan with fresh AI drafts |
| Monday 07:30 | Check map rank for every tracked keyword |

---

## Everything the AI does, in one list

1. **Writes review replies** in the shop's tone, per review, never
   templated (with a guardrail for medical categories: never add clinical
   detail). The owner can hit "rewrite" for a fresh draft.
2. **Plans a month of posts** for this trade, this city, this season.
3. **Writes each post** around real services and target keywords.
4. **Generates a post image** — only when the shop has no real photo.
5. **Filters harvested keywords** down to ones that bring a paying local customer.
6. **Suggests keywords** worth targeting for the category and city.
7. **Estimates customer travel radius** so rank checks cover the right area.
8. **Suggests offerings and specialties** for the owner to tap-accept.
9. **Maps the shop's own service words to Google's official service IDs.**
10. **Writes the free website's copy** (headline, about, services, FAQs, meta).
11. **Explains website problems in plain words** for shops with their own site.

Everything else — syncing, scheduling, publishing, rank checking, WhatsApp
review invites, the audit rules, metrics — is plain code, deliberately, so
it is predictable and cheap.

---

## Not built yet (so the doc stays honest)

Things the audit copy or the idea docs mention that the code does **not**
do today:

- **Writing hours, attributes, categories or service areas to Google.**
  They are edited in the app and used by the audit/website, but no code
  PATCHes them onto the listing. Only `serviceItems` (services) is written.
- **A QR code screen in the app.** The review-collection mechanics that
  exist are the WhatsApp/SMS invite (backend, per customer) and the
  "leave a review" link on the generated website. The counter-QR promised
  in the audit copy has no UI yet.
- **Google Q&A and Google Business Messages** — not touched at all.
- **24/7 WhatsApp enquiry answering and customer win-back messages**
  (from the original idea doc) — aspirational, not built.
- **Instagram cross-posting** — not built.

---

## Small vocabulary

| Word | Meaning |
|---|---|
| **GBP** | Google Business Profile — the shop's listing on Google/Maps. |
| **Local pack** | The box of top 3 map results on a Google search page. Almost every call comes from there. |
| **Keyword** | A phrase people actually type, e.g. "granite shop near me". |
| **Rank** | The shop's position in map results for one keyword, searched from a real location. |
| **Geo-grid** | The same keyword searched from 9 points around the shop, drawn as a map of positions. |
| **Autocomplete harvest** | Reading Google's search suggestions to learn what locals really type. |
| **NAP** | Name, Address, Phone. Must match everywhere (Google, website) — consistency is a ranking signal. |
| **Draft** | Anything the AI wrote that has not been approved yet. Drafts never touch Google. |
| **Runway** | How many posts (draft + approved + scheduled) are ready. The Sunday cron keeps it topped up. |
| **Agent actions** | The visible log of everything Footfall did on the shop's behalf. |
| **Audit / free report** | The rules-based health check of the listing, free, produced from live Google data. |
