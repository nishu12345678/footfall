/*
 * Every image slot on the landing page.
 *
 * Drop a file at public/marketing/<key>.webp (or .png / .jpg) and the
 * <Shot> component picks it up on the next render; until then the slot
 * shows a quiet placeholder so the layout can be judged without art.
 *
 * `prompt` is what to hand an image model. Keep the shot in mind: this
 * page is white, cool-grey and flat, so the pictures do the warmth.
 * docs/landing-images.md is generated from this file's prompts.
 */

export type ShotKey = keyof typeof SHOTS;

export const SHOTS = {
  "hero-dashboard": {
    width: 2000,
    height: 1250,
    alt: "The footfall dashboard: this week's Google posts, review replies and WhatsApp enquiries for a salon",
    role: "Hero. The one picture that has to say 'this is a real product'. A real screenshot of /app beats anything generated — but if generating:",
    prompt:
      "Clean SaaS dashboard screenshot for a product called 'footfall', viewed straight-on, filling the frame edge to edge, no device bezel, no browser chrome. White background, light grey (#f3f4f6) panels with 16px rounded corners, thin #eef0f2 borders, dark text (#111827), DM Sans-style typography. Left sidebar with items: Overview, Posts, Reviews, Photos, Performance, Website. Top of main area: 'Sharma Hair Studio · Thane West' with a green 'Google connected' pill. Four stat tiles in a row: 'Calls 38 (+12 this week)', 'Direction requests 61', 'Profile views 1,240', 'Reviews answered 100%'. Below, two columns: left card 'This week's post' showing a Google Business post preview with a salon photo and the text 'Monsoon rate — haircut + beard shape ₹299, weekdays before 2 PM', status 'Published Mon 9:14 AM'; right card 'Reviews' listing three 5-star reviews from Indian names (Priya K., Rahul S., Meena) each with a short owner reply marked 'Replied by footfall'. One small blue accent (#1a73e8) on a line chart of profile views rising over 8 weeks. Flat, no drop shadows, no gradients, no people, no 3D, photoreal UI rendering, sharp legible text, 2000×1250.",
  },
  "report-phone": {
    width: 1600,
    height: 1200,
    alt: "The free footfall report on a phone, listing what is wrong with a shop's Google listing",
    role: "Free report section, right column.",
    prompt:
      "Product photograph: a modern black Android phone held in a man's hand at a slight angle, screen filling most of the frame, on a plain white background with soft natural light and a faint shadow. On the screen, a clean white mobile web app titled 'Your listing report' for 'Sharma Hair Studio'. A large score '41 / 100' in dark text with a thin amber ring. Below it a vertical list of six findings, each with a small coloured status dot and one line: red — 'Last post: 8 months ago'; red — '11 reviews unanswered'; amber — '6 photos (top shops have 40+)'; amber — 'Not in top 3 for \"salon near me\"'; red — 'Closing time wrong on Sundays'; grey — 'No website'. A dark rounded button at the bottom reads 'Fix all of this — ₹1,999/month'. UI is white, cool grey, dark text, DM Sans style, no gradients. Photoreal, sharp, legible screen text, 1600×1200.",
  },
  "whatsapp-approval": {
    width: 1600,
    height: 1424,
    alt: "A WhatsApp message from footfall asking the owner to approve this week's Google post",
    role: "How it works, right column. This is the whole product from the owner's side.",
    prompt:
      "Close-up product photograph of a phone screen showing a WhatsApp chat, white background, soft studio light, slight top-down angle, screen sharp and legible. The chat is with a contact named 'footfall' (verified green tick). Incoming message bubbles (light grey on WhatsApp's default light wallpaper): first bubble 'This week's Google post for Sharma Hair Studio is ready 👇'; second bubble containing a small image of a barber chair and the text 'Monsoon rate — haircut + beard shape ₹299, weekdays before 2 PM. Walk in, no appointment needed.'; under it two rounded reply buttons 'Approve ✓' and 'Edit'. Then an outgoing green bubble from the owner: 'Approve'. Then an incoming bubble: 'Posted to Google at 9:14 AM. Next one Monday.' Time stamps in grey. Indian context, real WhatsApp look, no fake gradients, no extra UI invented. Photoreal, 1600×1424.",
  },
  "feature-posts": {
    width: 1930,
    height: 1264,
    alt: "A Google Business Profile post written and published by footfall",
    role: "'What it does' — the Posts card. Sits flush at the bottom of a bordered card, so keep the top of the image clean.",
    prompt:
      "Straight-on screenshot crop of a Google Business Profile as seen in Google Maps on desktop, white background, no browser chrome. Show the 'Updates' section of a listing for 'Sharma Hair Studio' with two post cards side by side. Each card: a photo on top (a clean salon interior with a barber chair and mirror; the second a close-up of a beard trim), then the post text in Google's Roboto-style type — first: 'Monsoon rate — haircut + beard shape ₹299, weekdays before 2 PM. Walk in, no appointment needed.' second: 'Bridal season is here. Book a trial on WhatsApp — Sundays open till 9 PM.' with a 'Learn more' link and a small grey date '2 days ago'. Below the cards, a small line 'Posted by footfall' in grey. Sharp, legible, photoreal UI, no gradients, 1930×1264.",
  },
  "feature-reviews": {
    width: 1930,
    height: 1264,
    alt: "A one-star review on Google with a calm, fast reply from the owner drafted by footfall",
    role: "'What it does' — the Reviews card. Same card treatment as feature-posts.",
    prompt:
      "Straight-on screenshot crop of the reviews section of a Google Business Profile in Google Maps on desktop, white background, no browser chrome. Two reviews stacked. First: reviewer 'Amit R.', two stars, 'Waited 40 min on a Saturday, nobody told me how long it would be.' — below it an indented 'Response from the owner' block: 'Sorry Amit, Saturdays after 5 get crowded and we should have told you. Next visit, message us on WhatsApp first and we'll hold a chair. — Sharma Hair Studio'. Second: reviewer 'Priya K.', five stars, 'Went in on a Sunday without booking and still got done in 20 minutes. Good with kids also.' with the owner response 'Thank you Priya! On Sundays we keep two chairs free for walk-ins. See you next time 🙏'. Small grey text under each response: 'Replied 4 minutes after the review'. Google's real review layout, Roboto-style type, sharp and legible, photoreal UI, 1930×1264.",
  },
  "owner-portrait": {
    width: 1600,
    height: 1200,
    alt: "A salon owner at her counter in Thane, checking her phone between customers",
    role: "'Why we built this' section. The only photograph of a person on the page — it should feel like a real customer, not stock.",
    prompt:
      "Documentary-style editorial photograph, natural light, 35mm, shallow depth of field. A confident Indian woman in her late thirties, owner of a small unisex salon in Thane, standing at her reception counter looking at her phone with a slight smile. Behind her, slightly out of focus: a salon chair, a mirror with warm bulbs, a shelf of products, a small Ganesh idol and a flower garland. On the counter in front of her: a small acrylic standee with a QR code and the words 'Rate us on Google'. Real, unposed, warm skin tones, no text overlays, no logos, no heavy retouching. Horizontal, 1600×1200.",
  },
  "counter-qr": {
    width: 1200,
    height: 900,
    alt: "A small QR standee on a shop counter asking customers to leave a Google review",
    role: "Optional — 'Review collection' compact card. Skip if you want fewer images.",
    prompt:
      "Product photograph, close-up, natural window light. A small white acrylic table standee on a wooden shop counter next to a card-payment machine and a steel bowl of saunf. The standee shows a large clean QR code and the text 'Loved it? Rate us on Google' with a small Google 'G' mark and a five-star row beneath. Slightly out of focus in the background, the edge of a sari shop's display. Photoreal, sharp on the standee, no other text, 1200×900.",
  },
} as const;
