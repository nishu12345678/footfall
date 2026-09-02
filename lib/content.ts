import { COMPANY } from "./company";
/* ---------------------------------------------------------------------------
   footfall — every word on the landing page lives here.
   edit copy in this file. don't edit copy inside components.

   Written for an Indian local business owner reading on a phone:
   sentence case, short lines, rupees, WhatsApp, and the trade named
   out loud. No all-lowercase styling — it reads as an affectation to
   this audience and makes mixed Hindi-English harder to scan.

   things to change before you send this to anyone:
     1. BRAND.name          — if "footfall" isn't the name you want
     2. FOUNDER             — your name, your photo, your handle
     3. PROOF.stat + quotes — replace the placeholders with real ones
--------------------------------------------------------------------------- */

export const BRAND = {
  name: "footfall",
  tagline: "The AI that runs your Google listing, so people nearby walk in.",
  city: "Muzaffarnagar",
};

/** The number people can just message. Same one as the footer. */
const WHATSAPP = `https://wa.me/${COMPANY.phoneHref.replace(
  /[^0-9]/g,
  "",
)}?text=${encodeURIComponent(
  "Hi, I want to know how footfall can get me more customers from Google.",
)}`;

export const LINKS = {
  cta: "/app",
  secondary: "#how",
  whatsapp: WHATSAPP,
  support: `mailto:${COMPANY.email}`,
};

export const NAV = [
  { label: "How it works", href: "#how" },
  { label: "Who it's for", href: "#trades" },
  { label: "Free report", href: "#report" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
];

export const HERO = {
  chip: "Built for Indian shops, clinics and salons",
  headline: "Get more customers from Google, without doing it yourself",
  sub: "footfall is an AI that runs your Google Business Profile — posting every week, replying to every review, and answering enquiries on WhatsApp while you run the shop.",
  ctaPrimary: "Get my free report",
  ctaWhatsapp: "Talk on WhatsApp",
  support:
    "Free report first · No card needed · Works with your existing Google profile",
  /* Small reassurances that sit under the buttons. These matter more
     than another paragraph to someone deciding whether to trust this. */
  trust: ["No agency retainer", "Setup takes 40 seconds", "Cancel any time"],
};

/* the three cards around the hero.
   each one is a real artifact from a Google Business Profile. */
export const HERO_WINDOWS = {
  post: {
    title: "Google post · published 9:14 AM",
    business: "Sharma Hair Studio",
    body: "Monsoon rate — haircut + beard shape ₹299, weekdays before 2 PM. Walk in, no appointment needed.",
    meta: "Written and posted by footfall",
  },
  review: {
    title: "Review · replied in 4 minutes",
    author: "Priya K.",
    stars: 5,
    text: "Went in on a Sunday without booking and still got done in 20 minutes. Good with kids also.",
    reply:
      "Thank you Priya! On Sundays we keep two chairs free for walk-ins. See you next time 🙏",
    meta: "Reply drafted and published by footfall",
  },
  chat: {
    title: "WhatsApp · 11:42 PM",
    incoming: "Bhaiya kal subah 10 baje slot milega? Rate kya hai beard ka",
    outgoing:
      "Yes, 10 AM is open tomorrow. Beard shape ₹120, with haircut ₹299. Shall I hold the slot for you?",
    meta: "Answered while the shop was closed",
  },
};

/* the signature element: the local map pack, before and after.
   this is the whole promise in one picture. */
export const MAP_PACK = {
  title: "Google Maps · “salon near me”",
  query: "salon near me",
  before: [
    {
      name: "Glow Unisex Salon",
      rating: 4.4,
      reviews: 212,
      distance: "1.8 km",
    },
    { name: "The Barber Room", rating: 4.6, reviews: 388, distance: "2.4 km" },
    { name: "Style Lounge", rating: 4.2, reviews: 96, distance: "0.9 km" },
  ],
  after: [
    {
      name: "Glow Unisex Salon",
      rating: 4.4,
      reviews: 212,
      distance: "1.8 km",
    },
    {
      name: "Sharma Hair Studio",
      rating: 4.8,
      reviews: 141,
      distance: "0.4 km",
      you: true,
    },
    { name: "The Barber Room", rating: 4.6, reviews: 388, distance: "2.4 km" },
  ],
  beforeLabel: "You were here — page 1, position 7",
  afterLabel: "Top 3. This is where the calls come from.",
  note: "An illustration of the outcome we work toward, not a guaranteed result. Ranking moves over weeks.",
};

/* ------------------------------ who it's for -----------------------------
   The single most important section for this audience. A salon owner
   does not read "local businesses" and think "that's me" — they read
   "Salons & parlours" and think "that's me". So we name the trade. */

export const TRADES = {
  eyebrow: "Who it's for",
  heading: "Built for shops like yours",
  sub: "You look after the customers in front of you. footfall looks after the ones searching for you on Google.",
  items: [
    {
      icon: "💇",
      name: "Salons & parlours",
      line: "“Ladies parlour near me”, bridal packages, walk-in rates.",
    },
    {
      icon: "🦷",
      name: "Clinics & dentists",
      line: "“Dentist near me”, treatment pages, appointment enquiries.",
    },
    {
      icon: "🥻",
      name: "Sari & clothing shops",
      line: "New arrivals, wedding season collections, festival timings.",
    },
    {
      icon: "🛍️",
      name: "Style & fashion stores",
      line: "Fresh stock posts, offers, and photos that keep the listing alive.",
    },
    {
      icon: "🛒",
      name: "Kirana & grocery",
      line: "Correct timings, home delivery, “open now” when people search.",
    },
    {
      icon: "🏋️",
      name: "Gyms & fitness",
      line: "Membership offers, trial classes, reviews from real members.",
    },
    {
      icon: "🍽️",
      name: "Restaurants & cafés",
      line: "Today's menu, festival hours, replies to every food review.",
    },
    {
      icon: "🧱",
      name: "Tiles, marble & hardware",
      line: "Service pages per locality, so contractors find you first.",
    },
    {
      icon: "📚",
      name: "Coaching & classes",
      line: "Batch timings, results, and parents' questions answered fast.",
    },
    {
      icon: "🔧",
      name: "Repairs & services",
      line: "“Near me” searches at the moment something has broken.",
    },
  ],
  note: "And any other shop people find by searching your trade and your area.",
};

/** Plain reassurance strip under the hero. Nothing is claimed here that
    isn't true of the product today. */
export const TRUST = [
  "Works with your existing Google Business Profile",
  "You approve posts on WhatsApp before they go live",
  "We never ask for your Google password",
  "English, Hindi or a mix — however your customers write",
];

/* ------------------------------ free report ------------------------------
   The entry point. Somebody who will never read a pricing page still wants
   to know what is wrong with their own listing, and the report is the
   honest way to show them. Every check listed here is one the product
   actually runs — see convex/audit.ts. */

export const REPORT = {
  eyebrow: "Free report",
  heading: "See what’s wrong with your listing — free",
  sub: "Connect your Google profile and we’ll show you exactly what is costing you customers. No payment, no setup forms, and nothing gets published.",
  steps: [
    "Sign in with Google",
    "Connect your Business Profile",
    "Read your report",
  ],
  checks: [
    {
      icon: "📝",
      label: "Posts",
      line: "When you last posted, and how long Google has read your listing as dormant.",
    },
    {
      icon: "⭐",
      label: "Reviews",
      line: "How many sit unanswered — and which of them are actively costing you walk-ins.",
    },
    {
      icon: "📷",
      label: "Photos",
      line: "How far short you are of the count that moves calls and direction requests.",
    },
    {
      icon: "🔍",
      label: "Keywords",
      line: "Whether you appear in the top 3 for anything people near you actually type.",
    },
    {
      icon: "🕒",
      label: "Hours & services",
      line: "What is missing that leaves Google guessing what you sell and when you are open.",
    },
    {
      icon: "🌐",
      label: "Your website",
      line: "We read it and list what it is missing. No website? We build you one free, at yourshop.footfall.site.",
    },
  ],
  freeLine: "Free, and it stays free.",
  paidLine:
    "On a plan, footfall fixes every one of these — every week, without you.",
  cta: "Get my free report",
  note: "About 40 seconds. Nothing is published and nothing on your listing changes.",
};

export const VISION = {
  eyebrow: "Why we built this",
  heading: "The money is going to the wrong screen",
  body: [
    "Every local business owner we spoke to is already paying someone ₹8,000 to ₹15,000 a month for “marketing”. What they get back is a screenshot of an Instagram post and a number called reach. What they wanted was somebody walking through the door.",
    "Meanwhile the screen that decides whether anyone walks in — their Google listing — hasn't been touched in eight months. No posts. Reviews from 2024 sitting unanswered. Wrong closing time. The enquiry that came at 11 PM went cold because they were working.",
    "That gap is the whole business. Google is where somebody nearby, right now, with money in their pocket, is choosing between you and the shop two streets over. We point an AI at that screen and nothing else.",
  ],
  kicker:
    "It's early. We're doing this by hand for the first few shops so we learn what actually moves the needle. Tell us what's broken.",
};

export const FOUNDER = {
  name: "Gaurav",
  role: "Founder",
  handle: "@gaurav",
  href: "#",
  /* drop a square photo at /public/founder.jpg and set this to "/founder.jpg" */
  photo: "",
  initial: "G",
};

export const STEPS = [
  {
    n: "1",
    title: "Connect",
    time: "40 seconds",
    body: "One Google login. We read your business, your services, your reviews and your hours. Nothing to fill in, nothing to upload, no call to book.",
  },
  {
    n: "2",
    title: "We run it",
    time: "Every week, without you",
    body: "Posts go up with the words people actually search. Every review gets a reply. Every customer gets asked for one. Enquiries get answered at 11 PM with your real prices.",
  },
  {
    n: "3",
    title: "People walk in",
    time: "The only number that counts",
    body: "You watch calls, direction requests and walk-ins from your own pin code. Not reach. Not impressions. People, in your shop.",
  },
];

export const DOES = {
  eyebrow: "What it does",
  heading: "Five jobs, done every week, without you",
  sub: "This is the whole list. We would rather do five things properly than twenty badly.",
  items: [
    {
      tag: "Keywords",
      title: "It learns what your neighbours actually search",
      body: "“Salon near me” is not what people type. They type “hair spa Thane West”, “ladies parlour near station”, “beard trim under 200”. We find the ones you can actually win and write everything around them.",
      detail: "Refreshed monthly · Per locality, not per city",
    },
    {
      tag: "Posts",
      title: "It posts in your voice, every week",
      body: "Google quietly rewards a listing that is alive. We write and publish posts about your real services and real prices — offers, timings, new services, festival hours. You approve on WhatsApp, or let it run.",
      detail: "Every week, on both plans",
    },
    {
      tag: "Reviews",
      title: "It replies to every review, fast",
      body: "An unanswered one-star does more damage than the review itself. We draft a reply in your tone within minutes — apologise where it is fair, invite them back, and never sound like a robot.",
      detail: "You can require your approval before anything is published",
    },
    {
      tag: "Review collection",
      title: "It asks your customers for reviews so you don't have to",
      body: "A link and a QR code for your counter. The customer pays, taps, and leaves a review before they have reached their scooter. Their number stays with you — which is how you get a customer list you never had.",
      detail: "Counter card · WhatsApp link · Post-visit follow-up",
    },
    {
      tag: "Service pages",
      title: "It builds a page for each service you sell",
      body: "One page per service, per locality — “Hair spa in Thane West” — with your prices, your photos and your hours. These are the pages that catch searches your listing alone cannot reach.",
      detail: "Hosted for you, nothing to maintain",
    },
  ],
};

export const PROOF = {
  eyebrow: "Proof",
  /* ⚠ REPLACE. this must be a number you can screenshot. */
  stat: {
    value: "3",
    label: "local shops running on footfall this week",
    placeholder: true,
  },
  note: "We're onboarding shops one at a time and sitting with each owner while they use it.",
  /* ⚠ PLACEHOLDERS. do not ship invented praise.
     paste what people actually said and set placeholder: false.
     anything still marked placeholder renders a visible "Sample" tag
     so it can't go out by accident. */
  quotes: [
    {
      name: "Salon owner",
      meta: "3 chairs · Thane West",
      text: "My last post on Google was from December. I didn't even know you could post there.",
      placeholder: true,
    },
    {
      name: "Dentist",
      meta: "Single clinic",
      text: "The agency sends me a report every month. I have never once read it and nothing changed.",
      placeholder: true,
    },
    {
      name: "Tile & marble shop",
      meta: "Family run · 22 years",
      text: "People call and ask if we are open. We are open. It says closed on Google.",
      placeholder: true,
    },
    {
      name: "Mattress shop",
      meta: "One showroom",
      text: "I pay ₹12,000 a month. I cannot tell you one customer who came from it.",
      placeholder: true,
    },
  ],
};

export const PRICING = {
  eyebrow: "Pricing",
  heading: "One plan. Two ways to pay.",
  sub: "The report is free for everyone. A plan is what makes footfall actually do the work.",
  anchor:
    "The freelancer posting on your Instagram charges ₹8,000–15,000 a month. This is the same work, done on the screen your customers actually search, for a fraction of it.",
  launchNote:
    "Launch pricing. It goes up once the first shops are running — whatever you start on is what you keep paying.",
  free: {
    name: "Free",
    line: "The report on your listing. No card, no expiry.",
    cta: "Get my free report",
    features: [
      "Full Google listing health check",
      "Everything that is broken, ranked worst first",
      "Your website read and checked",
      "A free one-page website at yourshop.footfall.site",
      "What each fix is worth",
    ],
  },
  /* Prices are shown here and enforced in convex/billing.ts. If you change
     one, change the other — the server never trusts an amount from the
     browser. */
  plans: [
    {
      id: "monthly",
      name: "Monthly",
      badge: "",
      price: 1999,
      listPrice: 2499,
      period: "month",
      perMonth: 1999,
      line: "Pay month to month.",
      best: "Best for trying it through one season",
      cta: "Start monthly",
    },
    {
      id: "yearly",
      name: "Yearly",
      badge: "Save ₹14,000",
      price: 9999,
      listPrice: 19999,
      period: "year",
      perMonth: 833,
      line: "One payment, a full year.",
      best: "Best for a shop that is staying",
      cta: "Start yearly",
    },
  ],
  /* The same list on both plans, because it is the same product. */
  features: [
    "Google posts written and published every week",
    "Every review answered, in your voice",
    "Review collection link and counter QR code",
    "WhatsApp enquiry replies, day and night",
    "Your local keywords, refreshed every month",
    "A service page for each thing you sell",
    "Calls, direction requests and walk-ins, tracked",
    "Approve on WhatsApp, or let it run by itself",
  ],
  offer: {
    heading: "First five shops",
    body: "We’re taking five local businesses this week and doing it with them, by hand. You get the founder’s phone number and every fix the same day. In return you tell us the truth about what’s useless.",
    cta: "Take one of the five",
    note: "Open until the five are gone.",
  },
};

export const FAQ = {
  eyebrow: "FAQ",
  heading: "Common questions from business owners",
  sub: "What to know about your Google profile, your data, and getting started.",
  items: [
    {
      q: "Will this work if I'm not good with computers?",
      a: "Yes. If you can use WhatsApp, you can use footfall. You sign in with Google once, and after that everything reaches you as a WhatsApp message you either approve or ignore. There is nothing to install and nothing to learn.",
    },
    {
      q: "What do I get without paying?",
      a: "The full report on your Google listing. Connect your profile and we show you what is broken — posts, unanswered reviews, missing photos, keywords you are not ranking for, hours and services that are not set, and what your website is missing. That part is free and stays free. A plan is what makes footfall go and fix it all, every week.",
    },
    {
      q: "What is footfall?",
      a: "It's an AI that runs your Google Business Profile — the listing that shows up when someone nearby searches for what you sell. It posts every week, replies to your reviews, asks your customers for new ones, and answers enquiries when you're busy working. You connect it once and then you mostly forget about it.",
    },
    {
      q: "Why Google and not Instagram?",
      a: "Instagram is where people scroll. Google is where people decide. Somebody typing “salon near me” is two streets away and ready to spend money in the next hour, and that person never sees your Instagram post. This isn't an argument against Instagram — it's an argument for fixing the thing that is actually connected to your door.",
    },
    {
      q: "Do I have to give you my Google password?",
      a: "No. You sign in with Google yourself and grant access to your business profile, the same way you'd connect any app. We never see your password, and you can remove our access from your Google account in two taps whenever you like.",
    },
    {
      q: "What if my old marketing agency has my login?",
      a: "Very common, and annoying. You can still get owner access back — Google has a process for it and we'll walk you through it on a call. This is usually the first thing we fix, because you should own your own listing.",
    },
    {
      q: "Will it post something embarrassing?",
      a: "You decide. You can leave approvals on, and every post and review reply comes to you on WhatsApp before it goes live — one tap to approve, one tap to edit. Once you trust it, turn approvals off.",
    },
    {
      q: "How soon will I see more customers?",
      a: "Honestly: weeks, not days. Google ranking moves slowly and anyone promising you page one by Friday is selling something. What you'll see in the first week is your listing alive again — posts up, reviews answered, hours right. Calls and direction requests follow that.",
    },
    {
      q: "What does it need from me?",
      a: "About 40 seconds to connect, and your real prices. That's it. If you want to approve posts before they publish, that's roughly two minutes a week on WhatsApp.",
    },
    {
      q: "Do you write fake reviews?",
      a: "No, and we never will. We ask your real customers, right after they've been served, when they actually feel like saying something nice. Fake reviews get listings suspended, and your listing is not worth risking.",
    },
    {
      q: "Does it work for my kind of business?",
      a: "It works for any business people search for by area — salons, clinics, dentists, sari and clothing shops, kirana stores, gyms, tile and hardware shops, coaching classes, repair services, restaurants. If a customer would type your trade plus your locality into Google, it works.",
    },
    {
      q: "Is it in English only?",
      a: "Posts and replies can be written in English, Hindi or Marathi, or a mix — whichever your customers actually use in reviews. We match how people in your area type, not textbook language.",
    },
    {
      q: "Can I cancel?",
      a: "Yes. Nothing auto-debits — you pay for a period and that period is what you get. If you don't pay again it simply stops, your report stays free, and everything we published stays up on your listing.",
    },
  ],
};

export const FOOTER = {
  columns: [
    {
      title: "Product",
      links: [
        { label: "How it works", href: "#how" },
        { label: "Who it's for", href: "#trades" },
        { label: "Free report", href: "#report" },
        { label: "Pricing", href: "#pricing" },
        { label: "Try now", href: LINKS.cta },
      ],
    },
    {
      title: "Company",
      links: [
        { label: "FAQ", href: "#faq" },
        { label: "Privacy policy", href: "/privacy" },
        { label: "Terms & conditions", href: "/terms" },
      ],
    },
    {
      title: "Contact",
      links: [
        { label: "WhatsApp", href: WHATSAPP },
        { label: COMPANY.email, href: `mailto:${COMPANY.email}` },
        { label: COMPANY.phone, href: `tel:${COMPANY.phoneHref}` },
        { label: "LinkedIn", href: COMPANY.founder.linkedin },
      ],
    },
  ],
  legal: `A product of ${COMPANY.legalName}. footfall is an independent product — it is not affiliated with, endorsed by, or a product of Google.`,
  copyright: `© ${BRAND.name}, 2026 · Built in ${BRAND.city}`,
};
