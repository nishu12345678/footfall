/*
 * Every image slot on the landing page.
 *
 * Drop a file at public/marketing/<key>.webp (or .png / .jpg) and the
 * <Shot> component picks it up on the next render; until then the slot
 * shows a quiet placeholder so the layout can be judged without art.
 *
 * Two kinds of slot live here:
 *   generated  — handed to an image model; `prompt` is what to give it.
 *   screenshot — captured from the real app; `prompt` says what to frame.
 *
 * The generated style follows the reference site's imagery: warmth comes
 * from PEOPLE — a real-looking Indian shopkeeper photographed on a clean
 * background — with product UI composited around them as floating cards.
 * The UI stays white, cool-grey and flat; the person carries the colour.
 *
 * docs/landing-images.md carries these same prompts for handing to
 * Gemini; regenerate it if you edit them here.
 */

export type ShotKey = keyof typeof SHOTS;

export const SHOTS = {
  /* ⚠ The installed file is a good generation with one flaw: the phone on
     the right shows a WhatsApp enquiry chat, a feature footfall does not
     have. It ships as a stand-in; regenerate with the prompt below, which
     replaces that panel with a review reply — something footfall really
     does. Swap the file, keep the name. */
  "hero-composite": {
    width: 1600,
    height: 894,
    alt: "A salon owner holding his phone, with footfall's work floating around him: his shop first on Google Maps, a review replied to, and a fresh Google post",
    role: "Hero. A person-composite, not a dashboard — the person makes the page feel human, the floating cards say what the product does.",
    prompt:
      "Marketing hero composite on a pure white background, in the style of modern Indian SaaS landing pages. CENTER: studio photograph of a smiling Indian man around 35, a salon owner, neatly groomed, wearing a dark green barber apron over a white t-shirt, holding a phone in both hands and looking at the camera, cut out cleanly on white, chest-up, centered. AROUND HIM, composited flat UI cards with soft subtle shadows, connected by one thin light-grey dashed circle passing behind him: LEFT, a white rounded card showing a Google Maps local results list titled 'salon near me' with three rows — row 1 highlighted in light blue: 'Sharma Hair Studio, 4.8 stars (141), 0.4 km, Open' with a small blue '1' pin; rows 2 and 3 greyed out generic salons. TOP, a small Google Maps pin icon in Google colours. RIGHT, slightly overlapping his shoulder, a white rounded card headed 'Response from the owner' showing a five-star row and the reply text 'Thank you Priya! On Sundays we keep two chairs free for walk-ins. See you next time.' with a small grey line beneath it reading 'Replied in 4 minutes'. BOTTOM CENTER, overlapping his hands, a white pill-shaped badge with a green circular star icon and the dark text 'Post published'. LOWER RIGHT, a small white stat card reading '4.8★ this month' partly faded. UPPER LEFT, a small hand-drawn black doodle: '3× calls' with a rough underline and a little arrow curving toward the man. Flat clean cards, #111827 text, thin #eef0f2 borders, one blue accent #1a73e8, a single green accent on the badge icon. No gradients on the background, no text anywhere except on the cards, photoreal person, sharp legible card text, 16:9.",
  },
  "report-composite": {
    width: 1600,
    height: 1600,
    alt: "A shop owner beside a large phone showing her free footfall report and everything wrong with her Google listing",
    role: "Free report section, right column. The reference's move: one big phone mockup in a soft rounded panel with a smiling person emerging beside it.",
    prompt:
      "Marketing composite inside a large rounded-corner panel with a very soft warm-grey gradient background (near-white, #f7f6f4 to #eceae7). LEFT AND CENTER: a large upright iPhone-style mockup, screen filling most of its face, showing a clean white mobile web app titled 'Your listing report' for 'Sharma Hair Studio'. On the screen: a large score '41/100' in dark text with a thin amber progress ring, then a list of findings each with a small coloured dot — red 'Last post: 8 months ago', red '11 reviews unanswered', amber '6 photos — top shops have 40+', amber 'Not in top 3 for salon near me', grey 'No website'. A dark rounded button at the bottom of the screen reads 'Fix all of this'. RIGHT: emerging from behind the phone's right edge, a studio photograph of a smiling Indian woman around 40 in a simple elegant beige kurta, the salon's owner, holding her own phone in one hand, warm and confident, photographed on the same soft background, waist-up. UI is flat white with #111827 text and thin borders, no gradients on the phone screen, photoreal person, sharp legible screen text, square.",
  },
  "feature-posts": {
    width: 1600,
    height: 894,
    alt: "Google Business Profile posts written and published by footfall",
    role: "'What it does' — the Posts card. A flat screenshot is right here (the reference uses flat dashboard shots on its feature cards). Sits flush at the card's bottom edge; keep the top edge clean.",
    prompt:
      "Straight-on screenshot crop of a Google Business Profile as seen in Google Maps on desktop, white background, no browser chrome. Show the 'Updates' section of a listing for 'Sharma Hair Studio' with two post cards side by side. Each card: a photo on top (a clean salon interior with a barber chair and mirror; the second a close-up of a beard trim), then the post text in Google's Roboto-style type — first: 'Monsoon rate — haircut + beard shape ₹299, weekdays before 2 PM. Walk in, no appointment needed.' second: 'Bridal season is here. Sundays open till 9 PM.' with a 'Learn more' link and a small grey date '2 days ago'. Below the cards, a small line 'Posted by footfall' in grey. Sharp, legible, photoreal UI, no gradients, 16:9.",
  },
  "feature-reviews": {
    width: 1600,
    height: 894,
    alt: "A two-star review on Google with a calm, fast reply from the owner drafted by footfall",
    role: "'What it does' — the Reviews card. Same flat treatment as feature-posts.",
    prompt:
      "Straight-on screenshot crop of the reviews section of a Google Business Profile in Google Maps on desktop, white background, no browser chrome. Two reviews stacked. First: reviewer 'Amit R.', two stars, 'Waited 40 min on a Saturday, nobody told me how long it would be.' — below it an indented 'Response from the owner' block: 'Sorry Amit, Saturdays after 5 get crowded and we should have told you. We are sorry your Saturday went like that — come by any weekday before 2 and we will take you straight in. — Sharma Hair Studio'. Second: reviewer 'Priya K.', five stars, 'Went in on a Sunday without booking and still got done in 20 minutes. Good with kids also.' with the owner response 'Thank you Priya! On Sundays we keep two chairs free for walk-ins. See you next time.' Small grey text under each response: 'Replied 4 minutes after the review'. Google's real review layout, Roboto-style type, sharp and legible, photoreal UI, 16:9.",
  },
  "owner-portrait": {
    width: 1600,
    height: 1194,
    alt: "A salon owner at her counter, checking her phone between customers",
    role: "'Why we built this' section. The only documentary photograph on the page — it should feel like a real customer, not stock.",
    prompt:
      "Documentary-style editorial photograph, natural light, 35mm, shallow depth of field. A confident Indian woman in her late thirties, owner of a small unisex salon, standing at her reception counter looking at her phone with a slight smile. Behind her, slightly out of focus: a salon chair, a mirror with warm bulbs, a shelf of products, a small idol and a flower garland. On the counter in front of her: a small acrylic standee with a QR code and the words 'Rate us on Google'. Real, unposed, warm skin tones, no text overlays, no logos, no heavy retouching. Horizontal, 4:3.",
  },

  /* ⬜ TO GENERATE. Both slots below exist because the same photograph —
     owner-portrait — was being used in two places it does not fit.

     Nothing is wired to them yet, on purpose: pointing a live slot at a
     missing file would swap a good photo for a dashed placeholder on a page
     that is currently being reviewed. Generate the art, drop the file in,
     then make the one-line swap noted in each `role` below. */

  "post-photo": {
    width: 1600,
    height: 900,
    alt: "A barber shaping a customer's beard, the kind of photo a shop puts on its own Google post",
    role: "The photo inside the post-draft card in components/landing/app-mock.tsx, which currently borrows owner-portrait.webp. That photo shows a woman at a reception counter while the post over it advertises 'haircut + beard shape ₹299' — the picture and the offer are selling different things. Swap: in app-mock.tsx change src to '/marketing/post-photo.webp'.",
    prompt:
      "A photograph taken by a small-shop owner on their own phone and posted to their Google Business Profile — competent but not professional, and it should read that way. A neighbourhood Indian unisex salon in daylight. A barber in his thirties, in a simple dark apron, leaning in to shape the edge of a seated male customer's beard with a trimmer, both concentrating, the customer's face calm and half-lit by daylight from the shopfront. Around them the ordinary truth of the shop: a mirror with warm bulbs, a comb and scissors on the ledge, a towel over the chair back, bottles on a shelf. Warm natural light, mild phone-camera imperfection — slight grain, a little highlight bloom from the window, no studio lighting, no glossy retouching, shallow but imperfect focus. CRITICAL: keep the lower third of the frame visually quiet — a dark gradient and a white headline are composited over it in the product, so nothing important, no faces and no busy detail may sit there. Absolutely no text, no signage, no logos, no watermarks anywhere in the image. Horizontal 16:9, and keep the subject near the centre because the frame is cropped to a wide strip.",
  },

  "owner-wrong-screen": {
    width: 1600,
    height: 1194,
    alt: "A shop owner looking at a social media feed on his phone while his shop sits empty behind him",
    role: "'Why we built this' / 'The money is going to the wrong screen'. That section argues the owner is paying ₹8,000–15,000 a month to get likes while the listing that actually brings people in has rotted. The photo currently there — a cheerful owner beside a 'Rate us on Google' standee — is the solved state, so it argues against the paragraph next to it. Swap: in components/landing/vision.tsx change the Shot name to 'owner-wrong-screen'.",
    prompt:
      "Documentary-style editorial photograph, natural light, 35mm, shallow depth of field, muted and quiet in mood. Mid-afternoon in a small Indian shop — a unisex salon or a modest clothing shop — in the dead hour when nobody is coming in. The owner, an Indian man in his late thirties in a plain shirt, sits sideways on his own customer chair, elbows on his knees, absorbed in his phone. On the phone screen, just legible and out of focus, a generic social-media grid of square photos with small heart icons — INVENTED interface only, no recognisable app, no real logos, no readable words. Behind him the shop is tidy, lit and completely empty: two vacant chairs, a mirror, a folded towel, the shutter half up, an empty street visible beyond the doorway. His expression is patient and a little resigned, NOT defeated, NOT comic, NOT humiliating — this is the customer, photographed with respect. Warm skin tones, honest light, no styling, no props arranged for the camera, no text overlays, no signage, no brand marks, no heavy retouching. Horizontal, 4:3.",
  },
} as const;

/* The app screens shown in "how it works" and "proof" are not image
   slots: they're rebuilt in HTML with sample data — see
   components/landing/app-mock.tsx. */
