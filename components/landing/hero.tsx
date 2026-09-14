import { HERO, LINKS, TRUST } from "@/lib/content";
import { Icon, WhatsAppIcon } from "./icons";
import { Shot } from "./shot";

/** Colours one word of the headline; everything else stays ink. */
function Headline({ text, word }: { text: string; word: string }) {
  const i = text.indexOf(word);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span style={{ color: "var(--l-google)" }}>{word}</span>
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

        <p className="mx-auto mt-4 max-w-2xl text-base text-[var(--l-muted)] md:mt-6 md:text-xl">
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

      <div className="mx-auto mt-8 w-full max-w-5xl md:mt-14">
        <div className="overflow-hidden rounded-2xl border border-[var(--l-line)] bg-white">
          <Shot
            name="hero-dashboard"
            priority
            plain
            sizes="(min-width: 1024px) 1024px, 100vw"
          />
        </div>
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
