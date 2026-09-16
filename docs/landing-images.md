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
| `owner-portrait` | `owner-portrait.webp` | ✅ Done — but used in two slots it doesn't fit, see below |
| `post-photo` | — | ⬜ **To generate** |
| `owner-wrong-screen` | — | ⬜ **To generate** |

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

## 2 · Two photos that argue with the words next to them

One photograph, `owner-portrait.webp`, is currently doing three jobs. In
two of them the picture contradicts the copy sitting on top of it.

Neither slot is wired up yet, deliberately: pointing a live slot at a
file that does not exist would replace a good photo with a dashed
placeholder on a page being reviewed right now. Generate the art, drop
the file in, then make the one-line swap noted under each.

### 2a · `post-photo` — the photo inside the post draft

Where: the post-draft card in `components/landing/app-mock.tsx`.

The problem: the card shows a Google post whose headline reads
**"Monsoon rate — haircut + beard shape ₹299"**, and the photo under it
is a woman standing at a reception counter. The picture and the offer
are selling different things, and the caption beneath even says *"your
own photo from the listing"* — so it should look like a photo the shop
took, not a portrait of the owner.

Two things the prompt is built around: it has to look phone-shot rather
than studio-lit, and **the bottom third has to stay empty**, because the
product composites a dark gradient and a white headline over it.

```
A photograph taken by a small-shop owner on their own phone and posted
to their Google Business Profile — competent but not professional, and
it should read that way. A neighbourhood Indian unisex salon in
daylight. A barber in his thirties, in a simple dark apron, leaning in
to shape the edge of a seated male customer's beard with a trimmer,
both concentrating, the customer's face calm and half-lit by daylight
from the shopfront. Around them the ordinary truth of the shop: a
mirror with warm bulbs, a comb and scissors on the ledge, a towel over
the chair back, bottles on a shelf. Warm natural light, mild
phone-camera imperfection — slight grain, a little highlight bloom from
the window, no studio lighting, no glossy retouching, shallow but
imperfect focus. CRITICAL: keep the lower third of the frame visually
quiet — a dark gradient and a white headline are composited over it in
the product, so nothing important, no faces and no busy detail may sit
there. Absolutely no text, no signage, no logos, no watermarks anywhere
in the image. Horizontal 16:9, and keep the subject near the centre
because the frame is cropped to a wide strip.
```

Save as `public/marketing/post-photo.webp` (1600×900). Then in
`app-mock.tsx` change the `src` to `/marketing/post-photo.webp`.

### 2b · `owner-wrong-screen` — "the money is going to the wrong screen"

Where: the `Vision` section, `components/landing/vision.tsx`.

The problem: that section argues the owner is paying ₹8,000–15,000 a
month for likes while the listing that actually brings people in has sat
untouched for eight months. The photo beside it is a cheerful owner next
to a *"Rate us on Google"* standee — the solved state. The picture
argues against the paragraph.

The replacement has to show the *problem*: attention on the wrong
screen, an empty shop behind it. The one hard rule is tone — this person
is the customer, so the photo has to be respectful, not comic and not
pitying.

```
Documentary-style editorial photograph, natural light, 35mm, shallow
depth of field, muted and quiet in mood. Mid-afternoon in a small Indian
shop — a unisex salon or a modest clothing shop — in the dead hour when
nobody is coming in. The owner, an Indian man in his late thirties in a
plain shirt, sits sideways on his own customer chair, elbows on his
knees, absorbed in his phone. On the phone screen, just legible and out
of focus, a generic social-media grid of square photos with small heart
icons — INVENTED interface only, no recognisable app, no real logos, no
readable words. Behind him the shop is tidy, lit and completely empty:
two vacant chairs, a mirror, a folded towel, the shutter half up, an
empty street visible beyond the doorway. His expression is patient and a
little resigned, NOT defeated, NOT comic, NOT humiliating — this is the
customer, photographed with respect. Warm skin tones, honest light, no
styling, no props arranged for the camera, no text overlays, no signage,
no brand marks, no heavy retouching. Horizontal, 4:3.
```

Save as `public/marketing/owner-wrong-screen.webp` (1600×1194). Then in
`vision.tsx` change the `Shot` name to `owner-wrong-screen`.

Once both are in, `owner-portrait.webp` is still used by nothing on the
page — keep it around as a spare or delete it.

## Retired

- `whatsapp-approval` — cut. It illustrated a WhatsApp approval flow
  the product does not have; approval happens in the app, which the
  `AppPostsMock` HTML mock now shows truthfully.
- `app-posts` / `app-reviews` / `app-performance` — never captured;
  replaced by the HTML mocks in `components/landing/app-mock.tsx`
  before any screenshot was taken.
