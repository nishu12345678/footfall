import { COMPANY } from "./company";
/* ---------------------------------------------------------------------------
   footfall — every word on the landing page lives here.
   edit copy in this file. don't edit copy inside components.

   things to change before you send this to anyone:
     1. BRAND.name          — if "footfall" isn't the name you want
     2. FOUNDER             — your name, your photo, your handle
     3. PROOF.stat + quotes — replace the placeholders with monday's real ones
     4. LINKS.cta           — point it at the real signup flow when m1 ships
--------------------------------------------------------------------------- */

export const BRAND = {
  name: "footfall",
  tagline: "an ai that runs your google listing so people nearby walk in",
  city: "muzaffarnagar",
};

export const LINKS = {
  cta: "#start",
  secondary: "#how",
  support: "mailto:hi@footfall.app",
};

export const NAV = [
  { label: "how it works", href: "#how" },
  { label: "what it does", href: "#does" },
  { label: "proof", href: "#proof" },
  { label: "pricing", href: "#pricing" },
  { label: "faq", href: "#faq" },
];

export const HERO = {
  chip: "for salons, clinics, and shops that live on walk-ins",
  headline: BRAND.name,
  sub: "an ai that runs your google listing so people nearby walk in",
  body: "instagram gets you likes from people three cities away. google gets you the person standing two streets away, holding their phone, deciding right now. we work on that one.",
  ctaPrimary: "check my listing — free",
  ctaSecondary: "see how it works",
  support:
    "free to start. no contract. works with the google profile you already have.",
  scribbles: ["◎", "★★★★☆", "¯\\_(ツ)_/¯", "( ˘ ³˘)", "→ 2.1 km"],
};

/* the four window cards floating around the hero.
   each one is a real artifact from a google business profile. */
export const HERO_WINDOWS = {
  post: {
    title: "google post · published 09:14",
    business: "sharma hair studio",
    body: "monsoon rate — haircut + beard shape ₹299, weekdays before 2pm. walk in, no appointment needed.",
    meta: "written and posted by footfall",
  },
  review: {
    title: "review · replied in 4 min",
    author: "priya k.",
    stars: 5,
    text: "went in on a sunday without booking and still got done in 20 mins. good with kids also.",
    reply:
      "thank you priya! sundays we keep two chairs free for walk-ins. see you next time 🙏",
    meta: "reply drafted + published by footfall",
  },
  chat: {
    title: "whatsapp · 11:42 pm",
    incoming: "bhaiya kal subah 10 baje slot milega? rate kya hai beard ka",
    outgoing:
      "yes, 10am is open tomorrow. beard shape ₹120, with haircut ₹299. shall i hold the slot for you?",
    meta: "answered while the shop was closed",
  },
};

/* the signature element: the local map pack, before and after.
   this is the whole promise in one picture. */
export const MAP_PACK = {
  title: "google maps · “salon near me”",
  query: "salon near me",
  before: [
    {
      name: "glow unisex salon",
      rating: 4.4,
      reviews: 212,
      distance: "1.8 km",
    },
    { name: "the barber room", rating: 4.6, reviews: 388, distance: "2.4 km" },
    { name: "style lounge", rating: 4.2, reviews: 96, distance: "0.9 km" },
  ],
  after: [
    {
      name: "glow unisex salon",
      rating: 4.4,
      reviews: 212,
      distance: "1.8 km",
    },
    {
      name: "sharma hair studio",
      rating: 4.8,
      reviews: 141,
      distance: "0.4 km",
      you: true,
    },
    { name: "the barber room", rating: 4.6, reviews: 388, distance: "2.4 km" },
  ],
  beforeLabel: "you were here — page 1, position 7",
  afterLabel: "top 3. this is where the calls come from.",
  note: "illustration of the outcome we're working toward, not a guaranteed result. ranking moves over weeks.",
};

export const VISION = {
  eyebrow: "why we built this",
  heading: "the money is going to the wrong screen",
  body: [
    "every local business owner we spoke to is already paying someone ₹8,000 to ₹15,000 a month for “marketing”. what they get back is a screenshot of an instagram post and a number called reach. what they wanted was somebody walking through the door.",
    "meanwhile the screen that decides whether anyone walks in — their google listing — hasn't been touched in eight months. no posts. reviews from 2024 sitting unanswered. wrong closing time. the enquiry that came at 11pm went cold because they were working.",
    "that gap is the whole business. google is where somebody nearby, right now, with money in their pocket, is choosing between you and the shop two streets over. we point an ai at that screen and nothing else.",
  ],
  kicker:
    "it's early. we're doing this by hand for the first few shops so we learn what actually moves the needle. tell us what's broken.",
};

export const FOUNDER = {
  name: "gaurav",
  role: "founder",
  handle: "@gaurav",
  href: "#",
  /* drop a square photo at /public/founder.jpg and set this to "/founder.jpg" */
  photo: "",
  initial: "g",
};

export const STEPS = [
  {
    n: "01",
    title: "connect",
    time: "40 seconds",
    body: "one google login. we read your business, your services, your reviews, your hours. nothing to fill in, nothing to upload, no call to book.",
  },
  {
    n: "02",
    title: "we run it",
    time: "every week, without you",
    body: "posts go up with the words people actually search. every review gets a reply. every customer gets asked for one. enquiries get answered at 11pm with your real prices.",
  },
  {
    n: "03",
    title: "people walk in",
    time: "the only number that counts",
    body: "you watch calls, direction requests and walk-ins from your own pin code. not reach. not impressions. people, in your shop.",
  },
];

export const DOES = {
  eyebrow: "what it does",
  heading: "five jobs, done every week, without you",
  sub: "this is the whole list. we'd rather do five things properly than twenty badly.",
  items: [
    {
      tag: "keywords",
      title: "it learns what your neighbours search",
      body: "“salon near me” is not what people type. they type “hair spa thane west”, “ladies parlour near station”, “beard trim under 200”. we find the ones you can actually win and write everything around them.",
      detail: "refreshed monthly · per locality, not per city",
    },
    {
      tag: "posts",
      title: "it posts, in your voice, every week",
      body: "google quietly rewards a listing that's alive. we write and publish posts about your real services and real prices — offers, timings, new services, festival hours. you approve on whatsapp or let it run.",
      detail: "1 post a week on free · unlimited on pro",
    },
    {
      tag: "reviews",
      title: "it replies to every review, fast",
      body: "an unanswered one-star does more damage than the review itself. we draft a reply in your tone within minutes — apologise where it's fair, invite them back, and never sound like a robot.",
      detail: "you can require your approval before anything is published",
    },
    {
      tag: "collection",
      title: "it asks your customers for reviews so you don't have to",
      body: "a link and a qr code for your counter. customer pays, taps, leaves a review before they've reached their scooter. their number stays with you — which is how you get a customer list you never had.",
      detail: "counter card · whatsapp link · post-visit follow-up",
    },
    {
      tag: "service pages",
      title: "it builds a page for each service you sell",
      body: "one page per service, per locality — “hair spa in thane west”, with your prices, your photos, your hours. these are the pages that catch searches your listing alone can't reach.",
      detail: "included on max · hosted, nothing for you to maintain",
    },
  ],
};

export const PROOF = {
  eyebrow: "proof",
  /* ⚠ REPLACE. this must be a number you can screenshot. */
  stat: {
    value: "3",
    label: "local shops running on footfall this week",
    placeholder: true,
  },
  note: "we're onboarding shops one at a time and sitting with each owner while they use it.",
  /* ⚠ PLACEHOLDERS. do not ship invented praise.
     after monday's sessions, paste what people actually said and set
     placeholder: false. anything still marked placeholder renders a
     visible "sample" tag so it can't go out by accident. */
  quotes: [
    {
      name: "salon owner",
      meta: "3 chairs · thane west",
      text: "my last post on google was from december. i didn't even know you could post there.",
      placeholder: true,
    },
    {
      name: "dentist",
      meta: "single clinic",
      text: "the agency sends me a report every month. i've never once read it and nothing changed.",
      placeholder: true,
    },
    {
      name: "tile & marble shop",
      meta: "family run · 22 years",
      text: "people call and ask if we're open. we're open. it says closed on google.",
      placeholder: true,
    },
    {
      name: "mattress shop",
      meta: "one showroom",
      text: "i pay ₹12,000 a month. i cannot tell you one customer who came from it.",
      placeholder: true,
    },
  ],
};

export const PRICING = {
  eyebrow: "pricing",
  heading: "less than one week of your agency",
  sub: "three plans. cancel from the app, any time, no phone call.",
  anchor:
    "the freelancer posting on your instagram charges ₹8,000–15,000 a month. this is the same money doing work you can see.",
  yearlyDiscountLabel: "−20%",
  plans: [
    {
      id: "free",
      name: "free",
      badge: "",
      priceMonthly: 0,
      priceYearly: 0,
      line: "see the real state of your listing.",
      best: "best for finding out how bad it is",
      cta: "check my listing",
      features: [
        "full listing health check",
        "1 google post a month",
        "review replies — drafted for you to paste",
        "your top 10 local keywords",
      ],
    },
    {
      id: "pro",
      name: "pro",
      badge: "popular",
      priceMonthly: 499,
      priceYearly: 399,
      line: "the listing runs itself.",
      best: "best for a shop that wants walk-ins",
      cta: "get pro",
      features: [
        "unlimited posts, published for you",
        "auto review replies, in your voice",
        "review collection link + counter qr",
        "whatsapp enquiry replies, 24/7",
        "monthly calls & direction-request report",
      ],
    },
    {
      id: "max",
      name: "max",
      badge: "",
      priceMonthly: 1499,
      priceYearly: 1199,
      line: "everything, plus the pages.",
      best: "best for multiple services or branches",
      cta: "get max",
      features: [
        "everything in pro",
        "service pages per locality",
        "up to 3 branches on one account",
        "competitor rank tracking each week",
        "whatsapp offers to past customers",
      ],
    },
  ],
  offer: {
    heading: "< first five shops >",
    body: "we're taking five local businesses this week and doing it with them, by hand, for free. you get the founder's phone number and every fix same-day. in return you tell us the truth about what's useless.",
    cta: "take one of the five",
    note: "* open until the five are gone.",
  },
};

export const FAQ = {
  eyebrow: "faq",
  heading: "frequently asked questions",
  sub: "what to know about your google profile, your data, and getting started.",
  items: [
    {
      q: "what is footfall?",
      a: "it's an ai that runs your google business profile — the listing that shows up when someone nearby searches for what you sell. it posts every week, replies to your reviews, asks your customers for new ones, and answers enquiries when you're busy working. you connect it once and then you mostly forget about it.",
    },
    {
      q: "why google and not instagram?",
      a: "instagram is where people scroll. google is where people decide. somebody typing “salon near me” is two streets away and ready to spend money in the next hour. that person never sees your instagram post. this is not an argument against instagram — it's an argument for fixing the thing that's actually connected to your door.",
    },
    {
      q: "do i have to give you my google password?",
      a: "no. you sign in with google yourself and grant access to your business profile, the same way you'd connect any app. we never see your password, and you can remove our access from your google account in two taps whenever you like.",
    },
    {
      q: "what if my old marketing agency has my login?",
      a: "very common, and annoying. you can still get owner access back — google has a process for it and we'll walk you through it on a call. this is usually the first thing we fix, because you should own your own listing.",
    },
    {
      q: "will it post something embarrassing?",
      a: "you decide. on pro you can leave approvals on, and every post and review reply comes to you on whatsapp before it goes live — one tap to approve, one tap to edit. once you trust it, turn approvals off.",
    },
    {
      q: "how long until i see more customers?",
      a: "honestly: weeks, not days. google ranking moves slowly and anyone promising you page one by friday is selling something. what you'll see in the first week is your listing alive again — posts up, reviews answered, hours right. calls and direction requests follow that.",
    },
    {
      q: "what does it need from me?",
      a: "about 40 seconds to connect, and your real prices. that's it. if you want to approve posts before they publish, that's roughly two minutes a week on whatsapp.",
    },
    {
      q: "do you write fake reviews?",
      a: "no, and we never will. we ask your real customers, right after they've been served, when they actually feel like saying something nice. fake reviews get listings suspended, and your listing is not worth risking.",
    },
    {
      q: "does it work for my kind of business?",
      a: "it works for any business people search for by area — salons, clinics, dentists, gyms, tile and hardware shops, coaching classes, repair services, restaurants. if a customer would type your trade plus your locality into google, it works.",
    },
    {
      q: "is it in english only?",
      a: "posts and replies can be written in english, hindi, or marathi, or a mix — whichever your customers actually use in reviews. we match how people in your area type, not textbook language.",
    },
    {
      q: "can i cancel?",
      a: "yes, from inside the app, any time, no phone call and no retention offer. you keep access until the end of the period you've paid for, and your listing stays yours — everything we published stays up.",
    },
  ],
};

export const FOOTER = {
  columns: [
    {
      title: "product",
      links: [
        { label: "how it works", href: "#how" },
        { label: "what it does", href: "#does" },
        { label: "pricing", href: "#pricing" },
        { label: "check my listing", href: "#start" },
      ],
    },
    {
      title: "company",
      links: [
        { label: "faq", href: "#faq" },
        { label: "privacy policy", href: "/privacy" },
        { label: "terms & conditions", href: "/terms" },
      ],
    },
    {
      title: "connect",
      links: [
        { label: "email", href: `mailto:${COMPANY.email}` },
        { label: "phone", href: `tel:${COMPANY.phoneHref}` },
        { label: "linkedin", href: COMPANY.founder.linkedin },
      ],
    },
  ],
  legal: `*a product of ${COMPANY.legalName}. footfall is an independent product — it is not affiliated with, endorsed by, or a product of google.*`,
  copyright: `© ${BRAND.name}, 2026 · built in ${BRAND.city}`,
};
