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
};

const SUB_OUTCOME =
  "footfall posts for you every week, replies to every review, and keeps your photos, hours and services correct — so when someone nearby searches your trade, your shop is the one they find.";

export const HERO_VARIANTS: HeroCopy[] = [
  {
    name: "0 · shipped",
    headline: HERO.headline,
    tagline: HERO.tagline,
    sub: HERO.sub,
    gloss: "“You run the shop, we'll handle Google.” Describes the chore, not the gain.",
  },
  {
    name: "1 · already searching",
    headline:
      "Google par jo customer aapko dhoondh rahe hain, unhe dukaan tak laayenge.",
    tagline: "You run the shop. footfall runs your Google listing.",
    sub: SUB_OUTCOME,
    gloss:
      "“The customers already searching for you on Google — we'll bring them to your shop.” Strongest idea: the demand already exists. Longest line.",
  },
  {
    name: "2 · same rhythm, new promise",
    headline: "Hum Google se customer laayenge, aap dukaan sambhaliye.",
    tagline: "More customers from Google, without doing it yourself.",
    sub: SUB_OUTCOME,
    gloss:
      "“We'll bring the customers from Google — you look after the shop.” Keeps the memorable two-part rhythm but leads with the benefit.",
  },
  {
    name: "3 · brand word",
    headline: "Google se customer laakar, aapki dukaan ki footfall badhayenge.",
    tagline: "More customers from Google, without doing it yourself.",
    sub: SUB_OUTCOME,
    gloss:
      "“Bringing customers from Google, we'll raise your shop's footfall.” Reinforces the brand name — but 'footfall' is English marketing jargon many owners won't know.",
  },
  {
    name: "4 · shortest",
    headline: "Aapki dukaan par zyada customer — Google se, har hafte.",
    tagline: "You run the shop. footfall runs your Google listing.",
    sub: SUB_OUTCOME,
    gloss:
      "“More customers at your shop — from Google, every week.” Punchiest, adds a cadence promise, but doesn't say who does the work.",
  },
  {
    name: "5 · names the money",
    headline: "Zyada customer, zyada bikri — Google se, bina mehnat ke.",
    tagline: "You run the shop. footfall runs your Google listing.",
    sub: SUB_OUTCOME,
    gloss:
      "“More customers, more sales — from Google, without the effort.” Names the real motive, but 'more sales' claims more than the product can guarantee.",
  },
];

export const HERO_VARIANT_NAMES = HERO_VARIANTS.map((v) => v.name);
