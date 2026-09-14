# Landing page images

Files live in `public/marketing/<name>.webp` (png/jpg also work). The
page picks them up automatically; missing files render as labelled
placeholders. The source of truth for slots is `lib/landing-images.ts`.

## Status

| Slot | File | Status |
|---|---|---|
| `hero-composite` | `hero-composite.webp` | ⚠ Installed, but **regenerate** — see below |
| `report-composite` | `report-composite.webp` | ✅ Done |
| `feature-posts` | `feature-posts.webp` | ✅ Done |
| `feature-reviews` | `feature-reviews.webp` | ✅ Done |
| `owner-portrait` | `owner-portrait.webp` | ✅ Done |

The app screens ("how it works" and "proof") are **not image slots**:
they're rebuilt in HTML with sample data in
`components/landing/app-mock.tsx`, so they stay sharp at any width,
need no anonymising, and never drift from the product's design. Edit
their copy in `APP_MOCK` in `lib/content.ts`.

## 1 · Hero — regenerate (one Gemini run)

The installed hero is a good generation with one flaw: the phone on the
right shows a WhatsApp enquiry chat, which is a feature footfall does
not have. This prompt keeps everything that worked and swaps that panel
for a review reply — something footfall really does.

```
Marketing hero composite on a pure white background, in the style of
modern Indian SaaS landing pages. CENTER: studio photograph of a
smiling Indian man around 35, a salon owner, neatly groomed, wearing a
dark green barber apron over a white t-shirt, holding a phone in both
hands and looking at the camera, cut out cleanly on white, chest-up,
centered. AROUND HIM, composited flat UI cards with soft subtle
shadows, connected by one thin light-grey dashed circle passing behind
him: LEFT, a white rounded card showing a Google Maps local results
list titled 'salon near me' with three rows — row 1 highlighted in
light blue: 'Sharma Hair Studio, 4.8 stars (141), 0.4 km, Open' with a
small blue '1' pin; rows 2 and 3 greyed out generic salons. TOP, a
small Google Maps pin icon in Google colours. RIGHT, slightly
overlapping his shoulder, a white rounded card headed 'Response from
the owner' showing a five-star row and the reply text 'Thank you
Priya! On Sundays we keep two chairs free for walk-ins. See you next
time.' with a small grey line beneath it reading 'Replied in 4
minutes'. BOTTOM CENTER, overlapping his hands, a white pill-shaped
badge with a green circular star icon and the dark text 'Post
published'. LOWER RIGHT, a small white stat card reading '4.8★ this
month' partly faded. UPPER LEFT, a small hand-drawn black doodle:
'3× calls' with a rough underline and a little arrow curving toward
the man. Flat clean cards, #111827 text, thin #eef0f2 borders, one
blue accent #1a73e8, a single green accent on the badge icon. No
gradients on the background, no text anywhere except on the cards,
photoreal person, sharp legible card text, 16:9.
```

Save as `public/marketing/hero-composite.webp` (or hand me the jpeg —
I'll convert). Keep the 16:9-ish landscape shape.

## Retired

- `whatsapp-approval` — cut. It illustrated a WhatsApp approval flow
  the product does not have; approval happens in the app, which the
  `AppPostsMock` HTML mock now shows truthfully.
- `app-posts` / `app-reviews` / `app-performance` — never captured;
  replaced by the HTML mocks in `components/landing/app-mock.tsx`
  before any screenshot was taken.
