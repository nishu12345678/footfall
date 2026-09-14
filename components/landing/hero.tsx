import { HERO, LINKS, TRUST } from "@/lib/content";
import { Icon, WhatsAppIcon } from "./icons";
import { Shot } from "./shot";

/** Google's own letter colours: blue, red, yellow, blue, green, red. */
const GOOGLE_COLORS = [
  "#4285F4",
  "#EA4335",
  "#FBBC05",
  "#4285F4",
  "#34A853",
  "#EA4335",
];

/** "Google", letter by letter in the brand palette. */
function GoogleWord({ word }: { word: string }) {
  return (
    <span className="whitespace-nowrap">
      {word.split("").map((ch, i) => (
        <span key={i} style={{ color: GOOGLE_COLORS[i % GOOGLE_COLORS.length] }}>
          {ch}
        </span>
      ))}
    </span>
  );
}

/** Colours one word of the text; everything else stays ink. */
function Headline({ text, word }: { text: string; word: string }) {
  const i = text.indexOf(word);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <GoogleWord word={word} />
      {text.slice(i + word.length)}
    </>
  );
}

/**
 * Centered hero: badge, headline with one coloured word, one-line sub,
 * a black button and a text link, then the product — big.
 */
export function Hero() {
  return (
    <section id="top" className="w-full px-6 pb-6 pt-10 md:pb-10 md:pt-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center text-center">
        <p className="l-pill bg-[#f3e9fc] text-[#7c3aed]">{HERO.chip}</p>

        <h1 className="mt-5 max-w-4xl text-[2.5rem] leading-[1.12] md:mt-7 md:text-6xl md:leading-[1.05]">
          <Headline text={HERO.headline} word={HERO.highlight} />
        </h1>

        {/* The English value prop, right under the Hinglish headline. */}
        <p className="mt-4 text-lg font-medium text-[var(--l-ink)] md:mt-5 md:text-2xl">
          <Headline text={HERO.tagline} word={HERO.highlight} />
        </p>

        <p className="mx-auto mt-3 max-w-2xl text-base text-[var(--l-muted)] md:mt-4 md:text-lg">
          {HERO.sub}
        </p>

        <div className="mt-6 flex w-full flex-col items-center gap-2 sm:w-auto sm:flex-row md:mt-9 md:gap-3">
          <a href={LINKS.cta} className="lb lb-primary lb-lg w-full sm:w-auto">
            {HERO.ctaPrimary}
            <Icon name="arrow-right" />
          </a>
          <a
            href={LINKS.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="lb lb-link lb-lg"
          >
            <WhatsAppIcon size={18} style={{ color: "#25d366" }} />
            {HERO.ctaWhatsapp}
          </a>
        </div>

        <p className="mt-4 text-[14px] text-[var(--l-muted)]">{HERO.support}</p>
      </div>

      {/* A person-composite on white: no frame, no border — the image's
          own white ground merges with the page, the way the reference
          floats its hero art. Narrower than the old panel because the
          subject is a centered figure, not a wide dashboard. */}
      <div className="mx-auto mt-8 w-full max-w-3xl md:mt-12">
        <Shot
          name="hero-composite"
          priority
          plain
          sizes="(min-width: 1024px) 768px, 100vw"
        />
      </div>

      {/* Reassurance line under the picture: plain, not a marquee. */}
      <ul className="mx-auto mt-8 flex max-w-5xl flex-wrap items-center justify-center gap-x-8 gap-y-2.5 md:mt-10">
        {TRUST.map((item) => (
          <li
            key={item}
            className="flex items-center gap-2 text-[14px] text-[var(--l-muted)]"
          >
            <span className="text-[var(--l-green)]">
              <Icon name="check" size={15} strokeWidth={2.5} />
            </span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
