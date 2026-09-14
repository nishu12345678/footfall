/*
 * Every image slot on the landing page.
 *
 * Drop a file at public/marketing/<key>.webp (or .png / .jpg) and the
 * <Shot> component picks it up on the next render; until then the slot
 * shows a quiet placeholder so the layout can be judged without art.
 *
 * `prompt` is what to hand an image model. The style follows the
 * reference site's imagery: warmth comes from PEOPLE — a real-looking
 * Indian shopkeeper photographed on a clean background — with product
 * UI composited around them as floating cards, connected by thin
 * dashed lines, plus one small hand-drawn doodle. The UI stays white,
 * cool-grey and flat; the person carries the colour.
 *
 * docs/landing-images.md carries these same prompts for handing to
 * Gemini; regenerate it if you edit them here.
 */

export type ShotKey = keyof typeof SHOTS;

export const SHOTS = {
  "hero-composite": {
    width: 1600,
    height: 1100,
    alt: "A salon owner holding his phone, with footfall's work floating around him: his shop first on Google Maps, a review replied to, and a WhatsApp enquiry answered",
    role: "Hero. A person-composite, not a dashboard — the person makes the page feel human, the floating cards say what the product does.",
    prompt:
      "Marketing hero composite on a pure white background, in the style of modern Indian SaaS landing pages. CENTER: studio photograph of a smiling Indian man around 35, a salon owner, neatly groomed, wearing a dark green barber apron over a white t-shirt, holding a phone in both hands and looking at the camera, cut out cleanly on white, chest-up, centered. AROUND HIM, composited flat UI cards with soft subtle shadows, connected by one thin light-grey dashed circle passing behind him: LEFT, a white rounded card showing a Google Maps local results list titled 'salon near me' with three rows — row 1 highlighted in light blue: 'Sharma Hair Studio, 4.8 stars (141), 0.4 km, Open' with a small blue '1' pin; rows 2 and 3 greyed out generic salons. TOP, a small Google Maps pin icon in Google colours. RIGHT, a white iPhone-style phone mockup, slightly overlapping his shoulder, showing a WhatsApp chat with an incoming grey bubble 'Kal 10 baje slot milega?' and an outgoing green bubble 'Yes, 10 AM is open. Beard shape ₹120. Shall I hold it?'. BOTTOM CENTER, overlapping his hands, a white pill-shaped badge with a green circular star icon and the dark text 'Review replied'. LOWER RIGHT, a small white stat card reading '4.8★ this month' partly faded. UPPER LEFT, a small hand-drawn black doodle: '3× calls' with a rough underline and a little arrow curving toward the man. Flat clean cards, #111827 text, thin #eef0f2 borders, one blue accent #1a73e8, WhatsApp green only in the chat. No gradients on the background, no text anywhere except on the cards, photoreal person, sharp legible card text, 1600×1100.",
  },
  "report-composite": {
    width: 1600,
    height: 1424,
    alt: "A shop owner beside a large phone showing her free footfall report and everything wrong with her Google listing",
    role: "Free report section, right column. The reference's move: one big phone mockup in a soft rounded panel with a smiling person emerging beside it.",
    prompt:
      "Marketing composite inside a large rounded-corner panel with a very soft warm-grey gradient background (near-white, #f7f6f4 to #eceae7). LEFT AND CENTER: a large upright iPhone-style mockup, screen filling most of its face, showing a clean white mobile web app titled 'Your listing report' for 'Sharma Hair Studio'. On the screen: a large score '41/100' in dark text with a thin amber progress ring, then a list of findings each with a small coloured dot — red 'Last post: 8 months ago', red '11 reviews unanswered', amber '6 photos — top shops have 40+', amber 'Not in top 3 for salon near me', grey 'No website'. A dark rounded button at the bottom of the screen reads 'Fix all of this'. RIGHT: emerging from behind the phone's right edge, a studio photograph of a smiling Indian woman around 40 in a simple elegant beige kurta, the salon's owner, holding her own phone in one hand, warm and confident, photographed on the same soft background, waist-up. UI is flat white with #111827 text and thin borders, no gradients on the phone screen, photoreal person, sharp legible screen text, 1600×1424.",
  },
  "whatsapp-approval": {
    width: 1600,
    height: 1424,
    alt: "A WhatsApp chat where footfall sends the week's Google post and the owner approves it with one tap",
    role: "How it works, left column. Pure phone mockup, no person — the section beside it already has the human argument.",
    prompt:
      "A single upright iPhone-style phone mockup on a pure white background, slight soft shadow, screen sharp and filling the phone's face, in the flat clean style of a SaaS landing page. On the screen, a WhatsApp chat with a business contact named 'footfall' with a green verified tick, WhatsApp's default light chat wallpaper. Messages top to bottom: incoming bubble \"This week's Google post for Sharma Hair Studio is ready:\"; incoming bubble containing a small photo of a barber chair and the caption 'Monsoon rate — haircut + beard shape ₹299, weekdays before 2 PM. Walk in, no appointment needed.' with two rounded reply buttons beneath it, 'Approve' and 'Edit'; outgoing green bubble 'Approve'; incoming bubble 'Posted to Google at 9:14 AM. Next one Monday.' Grey timestamps, realistic WhatsApp layout, nothing invented beyond real WhatsApp UI. Photoreal, sharp legible text, 1600×1424.",
  },
  "feature-posts": {
    width: 1930,
    height: 1264,
    alt: "A Google Business Profile post written and published by footfall",
    role: "'What it does' — the Posts card. A flat screenshot is right here (the reference uses flat dashboard shots on its feature cards). Sits flush at the card's bottom edge; keep the top edge clean.",
    prompt:
      "Straight-on screenshot crop of a Google Business Profile as seen in Google Maps on desktop, white background, no browser chrome. Show the 'Updates' section of a listing for 'Sharma Hair Studio' with two post cards side by side. Each card: a photo on top (a clean salon interior with a barber chair and mirror; the second a close-up of a beard trim), then the post text in Google's Roboto-style type — first: 'Monsoon rate — haircut + beard shape ₹299, weekdays before 2 PM. Walk in, no appointment needed.' second: 'Bridal season is here. Book a trial on WhatsApp — Sundays open till 9 PM.' with a 'Learn more' link and a small grey date '2 days ago'. Below the cards, a small line 'Posted by footfall' in grey. Sharp, legible, photoreal UI, no gradients, 1930×1264.",
  },
  "feature-reviews": {
    width: 1930,
    height: 1264,
    alt: "A two-star review on Google with a calm, fast reply from the owner drafted by footfall",
    role: "'What it does' — the Reviews card. Same flat treatment as feature-posts.",
    prompt:
      "Straight-on screenshot crop of the reviews section of a Google Business Profile in Google Maps on desktop, white background, no browser chrome. Two reviews stacked. First: reviewer 'Amit R.', two stars, 'Waited 40 min on a Saturday, nobody told me how long it would be.' — below it an indented 'Response from the owner' block: 'Sorry Amit, Saturdays after 5 get crowded and we should have told you. Next visit, message us on WhatsApp first and we'll hold a chair. — Sharma Hair Studio'. Second: reviewer 'Priya K.', five stars, 'Went in on a Sunday without booking and still got done in 20 minutes. Good with kids also.' with the owner response 'Thank you Priya! On Sundays we keep two chairs free for walk-ins. See you next time.' Small grey text under each response: 'Replied 4 minutes after the review'. Google's real review layout, Roboto-style type, sharp and legible, photoreal UI, 1930×1264.",
  },
  "owner-portrait": {
    width: 1600,
    height: 1200,
    alt: "A salon owner at her counter in Thane, checking her phone between customers",
    role: "'Why we built this' section. The only documentary photograph on the page — it should feel like a real customer, not stock.",
    prompt:
      "Documentary-style editorial photograph, natural light, 35mm, shallow depth of field. A confident Indian woman in her late thirties, owner of a small unisex salon in Thane, standing at her reception counter looking at her phone with a slight smile. Behind her, slightly out of focus: a salon chair, a mirror with warm bulbs, a shelf of products, a small idol and a flower garland. On the counter in front of her: a small acrylic standee with a QR code and the words 'Rate us on Google'. Real, unposed, warm skin tones, no text overlays, no logos, no heavy retouching. Horizontal, 1600×1200.",
  },
} as const;
