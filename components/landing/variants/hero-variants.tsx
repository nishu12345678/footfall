import { HERO } from "@/lib/content";

/* ---------------------------------------------------------------------------
   Headline candidates for the hero, for side-by-side review on this branch.

   The complaint about the shipped line — "Aap dukaan chalaiye, Google hum
   sambhal lenge" — is that it describes a division of labour (we handle the
   chore) instead of an outcome (you get customers). Every candidate below
   leads with the outcome.

   Two constraints each line has to satisfy:
     1. it must contain "Google", because <Headline> colours that word
        letter-by-letter in Google's palette;
     2. it has to survive md:text-6xl without running to four lines.

   The three lines are meant to say three different things: the headline is
   the promise, the tagline is who does the work, the sub is how.
--------------------------------------------------------------------------- */

export type HeroCopy = {
  name: string;
  headline: string;
  tagline: string;
  sub: string;
  /** Plain-English gloss, for whoever reviews this without Hindi. */
  gloss: string;
  /**
   * roman      — Hinglish in Latin letters (what ships today)
   * devanagari — Hindi in Devanagari, loanwords spelled out in Hindi too
   * mixed      — Devanagari grammar with the common English loanwords left
   *              in Latin ("Google पर जो customer…"), which is how most
   *              people under forty actually type
   */
  script: "roman" | "devanagari" | "mixed";
};

const SUB_HINDI =
  "footfall हर हफ़्ते आपके लिए पोस्ट डालता है, हर रिव्यू का जवाब देता है, और आपकी फ़ोटो, समय और सेवाएँ सही रखता है — ताकि आस-पास कोई आपका काम खोजे, तो आपकी दुकान ही सबसे पहले दिखे।";

const SUB_OUTCOME =
  "footfall posts for you every week, replies to every review, and keeps your photos, hours and services correct — so when someone nearby searches your trade, your shop is the one they find.";

export const HERO_VARIANTS: HeroCopy[] = [
  {
    name: "0 · shipped",
    headline: HERO.headline,
    tagline: HERO.tagline,
    sub: HERO.sub,
    gloss: "“You run the shop, we'll handle Google.” Describes the chore, not the gain.",
    script: "roman",
  },
  {
    name: "1 · already searching",
    headline:
      "Google par jo customer aapko dhoondh rahe hain, unhe dukaan tak laayenge.",
    tagline: "You run the shop. footfall runs your Google listing.",
    sub: SUB_OUTCOME,
    gloss:
      "“The customers already searching for you on Google — we'll bring them to your shop.” Strongest idea: the demand already exists. Longest line.",
    script: "roman",
  },
  {
    name: "2 · same rhythm, new promise",
    headline: "Hum Google se customer laayenge, aap dukaan sambhaliye.",
    tagline: "More customers from Google, without doing it yourself.",
    sub: SUB_OUTCOME,
    gloss:
      "“We'll bring the customers from Google — you look after the shop.” Keeps the memorable two-part rhythm but leads with the benefit.",
    script: "roman",
  },
  {
    name: "3 · brand word",
    headline: "Google se customer laakar, aapki dukaan ki footfall badhayenge.",
    tagline: "More customers from Google, without doing it yourself.",
    sub: SUB_OUTCOME,
    gloss:
      "“Bringing customers from Google, we'll raise your shop's footfall.” Reinforces the brand name — but 'footfall' is English marketing jargon many owners won't know.",
    script: "roman",
  },
  {
    name: "4 · shortest",
    headline: "Aapki dukaan par zyada customer — Google se, har hafte.",
    tagline: "You run the shop. footfall runs your Google listing.",
    sub: SUB_OUTCOME,
    gloss:
      "“More customers at your shop — from Google, every week.” Punchiest, adds a cadence promise, but doesn't say who does the work.",
    script: "roman",
  },
  {
    name: "5 · names the money",
    headline: "Zyada customer, zyada bikri — Google se, bina mehnat ke.",
    tagline: "You run the shop. footfall runs your Google listing.",
    sub: SUB_OUTCOME,
    gloss:
      "“More customers, more sales — from Google, without the effort.” Names the real motive, but 'more sales' claims more than the product can guarantee.",
    script: "roman",
  },
  /* ---------------------------------------------------------------------
     Devanagari. Two things to watch while comparing these:

     · "Google" stays in Latin in every one of them. Writing it "गूगल"
       throws away the letter-colouring and the brand mark at the same
       time, and nobody types it that way anyway.
     · Devanagari has taller ascenders and the शिरोरेखा (the head line), so
       the same point size reads bigger and heavier than Latin. These lines
       are kept shorter than their roman twins for that reason — check them
       at md:text-6xl before picking one.
  --------------------------------------------------------------------- */
  {
    name: "6 · देवनागरी · already searching",
    headline: "Google पर जो ग्राहक आपको ढूँढ रहे हैं, उन्हें दुकान तक लाएँगे।",
    tagline: "You run the shop. footfall runs your Google listing.",
    sub: SUB_OUTCOME,
    gloss:
      "Variant 1 in Devanagari, fully Hindi — “ग्राहक” rather than “customer”. Warmest and most respectful; slightly more formal than how people speak.",
    script: "devanagari",
  },
  {
    name: "7 · मिक्स्ड · already searching",
    headline: "Google पर जो customer आपको ढूँढ रहे हैं, उन्हें दुकान तक लाएँगे।",
    tagline: "You run the shop. footfall runs your Google listing.",
    sub: SUB_OUTCOME,
    gloss:
      "Same line, but “customer” left in Latin — how most shop owners under forty actually write. Reads faster than the pure-Hindi version to that group, and jarring to an older one.",
    script: "mixed",
  },
  {
    name: "8 · देवनागरी · same rhythm",
    headline: "हम Google से ग्राहक लाएँगे, आप दुकान सँभालिए।",
    tagline: "More customers from Google, without doing it yourself.",
    sub: SUB_OUTCOME,
    gloss:
      "“We'll bring the customers from Google — you look after the shop.” Keeps the two-part rhythm of the shipped line. Shortest Devanagari option, so the one most likely to hold a single line.",
    script: "devanagari",
  },
  {
    name: "9 · मिक्स्ड · shortest",
    headline: "आपकी दुकान पर ज़्यादा customer — Google से, हर हफ़्ते।",
    tagline: "You run the shop. footfall runs your Google listing.",
    sub: SUB_OUTCOME,
    gloss:
      "“More customers at your shop — from Google, every week.” Punchy, and the weekly cadence is a concrete promise.",
    script: "mixed",
  },
  {
    name: "10 · देवनागरी · names the money",
    headline: "ज़्यादा ग्राहक, ज़्यादा बिक्री — Google से, बिना मेहनत के।",
    tagline: "You run the shop. footfall runs your Google listing.",
    sub: SUB_OUTCOME,
    gloss:
      "“More customers, more sales — from Google, without the effort.” Names the real motive. Note “more sales” claims more than the product can guarantee.",
    script: "devanagari",
  },
  {
    name: "11 · पूरा हिंदी (headline + sub)",
    headline: "Google पर जो ग्राहक आपको ढूँढ रहे हैं, उन्हें दुकान तक लाएँगे।",
    tagline: "आप दुकान सँभालिए। footfall आपकी Google लिस्टिंग सँभालेगा।",
    sub: SUB_HINDI,
    gloss:
      "The whole hero in Hindi, deck and paragraph included — the only variant with no English sentence in it. Warmest for a Hindi-first reader; costs you every visitor who reads English faster, and every investor who opens the page.",
    script: "devanagari",
  },
];

export const HERO_VARIANT_NAMES = HERO_VARIANTS.map((v) => v.name);
