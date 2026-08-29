# footfall

**An AI that runs a local business's Google Business Profile, so people nearby actually walk in.**

Live: https://footfall-delta.vercel.app

---

## The problem

A local business owner — a salon, a clinic, a tile shop — pays ₹8,000–15,000 a month to a freelancer who posts on Instagram and sends back a screenshot of "reach". Nobody walks in.

Meanwhile the screen that actually decides whether someone walks in — their Google Business Profile — hasn't been touched in eight months. No posts. Reviews from 2024 sitting unanswered. Wrong closing time. The enquiry that arrived at 11pm went cold because the owner was working.

Google is where somebody two streets away, holding their phone, is choosing between you and the shop down the road. footfall points an AI at that screen and nothing else.

## Who it's for

Owner-operators of local walk-in businesses serving roughly 5km around them. They work *in* the shop, not on it.

## What it does

| | |
|---|---|
| **keywords** | Finds what neighbours actually search — "hair spa thane west", not "salon near me" |
| **posts** | Writes and publishes weekly posts about real services and real prices |
| **review replies** | Drafts and publishes replies in the owner's voice, within minutes |
| **review collection** | A link and counter QR that turns paying customers into reviews |
| **service pages** | One page per service, per locality |

## Stack

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**
- **Tailwind CSS v4** for layout, custom CSS tokens for the design system
- **Vercel** for hosting, auto-deploying from `main`
- **Convex** for backend and data (wiring in progress)

## Run it locally

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
```

## Project structure

```
app/
  layout.tsx        fonts, metadata
  globals.css       design tokens, window chrome, motion
  page.tsx          section assembly
components/         one file per landing page section
lib/
  content.ts        ALL copy lives here — edit words here, not in components
IDEA_SCOPE.md       the build's control plane: milestones, acceptance tests, fallbacks
```

**Editing copy:** change `lib/content.ts`. Nothing in `components/` contains hardcoded marketing text.

## Status

This is a Build Week project (29 Aug – 5 Sep 2026), built solo and in public.

Current state: landing page live. The connect-and-publish flow is the next milestone — see `IDEA_SCOPE.md` for the day-by-day plan, acceptance tests, and what gets cut if I fall behind.

**Testimonials on the live page are placeholders** and render a visible "sample" tag until they're replaced with real quotes from real owners. No invented praise ships.

## A note on claims

Google local ranking moves over weeks, not days. The map-pack animation on the landing page is labelled as an illustration of the outcome, not a guaranteed result. Anyone promising page one by Friday is selling something.

---

*footfall is an independent product. It is not affiliated with, endorsed by, or a product of Google.*
