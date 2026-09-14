# Landing page images

Six slots. Each shows a grey placeholder until a file exists at
`public/marketing/<name>.webp` (`.png` / `.jpg` also work). Drop the file
in and reload — nothing else to wire. `lib/landing-images.ts` is the
source of truth for names, sizes, alt text and these prompts.

## The style (this changed — read first)

The reference site's warmth comes from **people, not screenshots**. Its
hero is a smiling person on plain white with product UI floating around
them — small cards, a phone mockup, one stat pill, a thin dashed line
connecting them, and one hand-drawn doodle. Its section art is a big
phone mockup in a soft rounded panel **with a person emerging beside
it**. Only the deep feature cards use flat screenshots.

So for ours:

- **People**: photoreal Indian shopkeepers, studio-lit, cut out on white
  or a soft warm-grey panel. The person carries the colour and warmth.
- **UI cards**: flat white, `#111827` text, thin `#eef0f2` borders, one
  blue accent `#1a73e8`, WhatsApp green only inside chats. No gradients,
  no glassmorphism, no 3D.
- **Text on cards must be sharp and legible.** If the model garbles the
  words, regenerate — blurry UI text is the #1 tell.
- Generate at 2× if the tool allows; downscale later.

---

## 1. `hero-composite` — 1600×1100

**Where:** under the headline, floating directly on the white page (no
frame). The person + floating cards composite. This is the money shot.

```
Marketing hero composite on a pure white background, in the style of modern Indian SaaS landing pages. CENTER: studio photograph of a smiling Indian man around 35, a salon owner, neatly groomed, wearing a dark green barber apron over a white t-shirt, holding a phone in both hands and looking at the camera, cut out cleanly on white, chest-up, centered. AROUND HIM, composited flat UI cards with soft subtle shadows, connected by one thin light-grey dashed circle passing behind him: LEFT, a white rounded card showing a Google Maps local results list titled 'salon near me' with three rows — row 1 highlighted in light blue: 'Sharma Hair Studio, 4.8 stars (141), 0.4 km, Open' with a small blue '1' pin; rows 2 and 3 greyed out generic salons. TOP, a small Google Maps pin icon in Google colours. RIGHT, a white iPhone-style phone mockup, slightly overlapping his shoulder, showing a WhatsApp chat with an incoming grey bubble 'Kal 10 baje slot milega?' and an outgoing green bubble 'Yes, 10 AM is open. Beard shape ₹120. Shall I hold it?'. BOTTOM CENTER, overlapping his hands, a white pill-shaped badge with a green circular star icon and the dark text 'Review replied'. LOWER RIGHT, a small white stat card reading '4.8★ this month' partly faded. UPPER LEFT, a small hand-drawn black doodle: '3× calls' with a rough underline and a little arrow curving toward the man. Flat clean cards, #111827 text, thin #eef0f2 borders, one blue accent #1a73e8, WhatsApp green only in the chat. No gradients on the background, no text anywhere except on the cards, photoreal person, sharp legible card text, 1600×1100.
```

## 2. `report-composite` — 1600×1424

**Where:** "See what's wrong with your listing — free", right column.
Big phone + person emerging beside it, in a soft rounded panel.

```
Marketing composite inside a large rounded-corner panel with a very soft warm-grey gradient background (near-white, #f7f6f4 to #eceae7). LEFT AND CENTER: a large upright iPhone-style mockup, screen filling most of its face, showing a clean white mobile web app titled 'Your listing report' for 'Sharma Hair Studio'. On the screen: a large score '41/100' in dark text with a thin amber progress ring, then a list of findings each with a small coloured dot — red 'Last post: 8 months ago', red '11 reviews unanswered', amber '6 photos — top shops have 40+', amber 'Not in top 3 for salon near me', grey 'No website'. A dark rounded button at the bottom of the screen reads 'Fix all of this'. RIGHT: emerging from behind the phone's right edge, a studio photograph of a smiling Indian woman around 40 in a simple elegant beige kurta, the salon's owner, holding her own phone in one hand, warm and confident, photographed on the same soft background, waist-up. UI is flat white with #111827 text and thin borders, no gradients on the phone screen, photoreal person, sharp legible screen text, 1600×1424.
```

## 3. `whatsapp-approval` — 1600×1424

**Where:** "Connect once. It runs every week.", left column. A single
floating phone on white — the section text beside it already carries the
human argument, so no person here.

```
A single upright iPhone-style phone mockup on a pure white background, slight soft shadow, screen sharp and filling the phone's face, in the flat clean style of a SaaS landing page. On the screen, a WhatsApp chat with a business contact named 'footfall' with a green verified tick, WhatsApp's default light chat wallpaper. Messages top to bottom: incoming bubble "This week's Google post for Sharma Hair Studio is ready:"; incoming bubble containing a small photo of a barber chair and the caption 'Monsoon rate — haircut + beard shape ₹299, weekdays before 2 PM. Walk in, no appointment needed.' with two rounded reply buttons beneath it, 'Approve' and 'Edit'; outgoing green bubble 'Approve'; incoming bubble 'Posted to Google at 9:14 AM. Next one Monday.' Grey timestamps, realistic WhatsApp layout, nothing invented beyond real WhatsApp UI. Photoreal, sharp legible text, 1600×1424.
```

## 4. `feature-posts` — 1930×1264

**Where:** "Five jobs" — the Posts card. Flat screenshot is correct here
(the reference does the same on its feature cards). Keep the top edge of
the image clean; it sits flush at the card's bottom.

```
Straight-on screenshot crop of a Google Business Profile as seen in Google Maps on desktop, white background, no browser chrome. Show the 'Updates' section of a listing for 'Sharma Hair Studio' with two post cards side by side. Each card: a photo on top (a clean salon interior with a barber chair and mirror; the second a close-up of a beard trim), then the post text in Google's Roboto-style type — first: 'Monsoon rate — haircut + beard shape ₹299, weekdays before 2 PM. Walk in, no appointment needed.' second: 'Bridal season is here. Book a trial on WhatsApp — Sundays open till 9 PM.' with a 'Learn more' link and a small grey date '2 days ago'. Below the cards, a small line 'Posted by footfall' in grey. Sharp, legible, photoreal UI, no gradients, 1930×1264.
```

## 5. `feature-reviews` — 1930×1264

**Where:** "Five jobs" — the Reviews card. Same treatment as #4.

```
Straight-on screenshot crop of the reviews section of a Google Business Profile in Google Maps on desktop, white background, no browser chrome. Two reviews stacked. First: reviewer 'Amit R.', two stars, 'Waited 40 min on a Saturday, nobody told me how long it would be.' — below it an indented 'Response from the owner' block: 'Sorry Amit, Saturdays after 5 get crowded and we should have told you. Next visit, message us on WhatsApp first and we'll hold a chair. — Sharma Hair Studio'. Second: reviewer 'Priya K.', five stars, 'Went in on a Sunday without booking and still got done in 20 minutes. Good with kids also.' with the owner response 'Thank you Priya! On Sundays we keep two chairs free for walk-ins. See you next time.' Small grey text under each response: 'Replied 4 minutes after the review'. Google's real review layout, Roboto-style type, sharp and legible, photoreal UI, 1930×1264.
```

## 6. `owner-portrait` — 1600×1200

**Where:** "The money is going to the wrong screen". The one documentary
photo on the page. If it looks like stock, regenerate.

```
Documentary-style editorial photograph, natural light, 35mm, shallow depth of field. A confident Indian woman in her late thirties, owner of a small unisex salon in Thane, standing at her reception counter looking at her phone with a slight smile. Behind her, slightly out of focus: a salon chair, a mirror with warm bulbs, a shelf of products, a small idol and a flower garland. On the counter in front of her: a small acrylic standee with a QR code and the words 'Rate us on Google'. Real, unposed, warm skin tones, no text overlays, no logos, no heavy retouching. Horizontal, 1600×1200.
```

---

## After you have the files

```
public/marketing/
  hero-composite.webp
  report-composite.webp
  whatsapp-approval.webp
  feature-posts.webp
  feature-reviews.webp
  owner-portrait.webp
```

WebP preferred (`cwebp -q 82 in.png -o out.webp`); PNG works too. For
`hero-composite`, if you can export with a transparent background, PNG/WebP
with alpha looks even better on the page — but a pure-white background is
fine since the page is white.

`next dev` picks new files up on the next request; a production build
needs `next build` re-run because `/` is prerendered.

## Tips for Gemini specifically

- Ask for **one image at a time** and iterate; don't batch.
- If faces come out uncanny, add "natural skin texture, no beauty
  filter" and regenerate — the person must look real.
- If card text garbles, tell it "keep every word exactly as written,
  render text sharply" or generate the person alone on white and ask me
  to composite the UI cards in code/CSS instead — that's a viable
  fallback for #1.
