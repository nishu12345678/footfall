import { HERO, LINKS, TRUST } from "@/lib/content";
import { ColorGoogle } from "./google-word";
import { Icon } from "./icons";
import { Shot } from "./shot";
import { WhatsAppCta } from "./whatsapp-cta";

/**
 * Centered hero: badge, headline with "Google" in its own colours, a plain
 * deck, one-line sub, a black button and the WhatsApp link, then the
 * product — big.
 */
export function Hero() {
  return (
    <section id="top" className="w-full px-6 pb-6 pt-10 md:pb-10 md:pt-16">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center text-center">
        <p className="l-pill bg-[#f3e9fc] text-[#7c3aed]">{HERO.chip}</p>

        <h1 className="mt-5 max-w-4xl text-[2.5rem] leading-[1.12] md:mt-7 md:text-6xl md:leading-[1.05]">
          <ColorGoogle text={HERO.headline} />
        </h1>

        {/* The English value prop, right under the Hinglish headline. Plain
            ink on purpose — colouring "Google" a second time here made the
            deck read as another headline and fought the h1 above it. */}
        <p className="mt-4 text-lg font-medium text-[var(--l-ink)] md:mt-5 md:text-2xl">
          {HERO.tagline}
        </p>

        <p className="mx-auto mt-3 max-w-2xl text-base text-[var(--l-muted)] md:mt-4 md:text-lg">
          {HERO.sub}
        </p>

        <div className="mt-6 flex w-full flex-col items-center gap-2 sm:w-auto sm:flex-row md:mt-9 md:gap-3">
          <a href={LINKS.cta} className="lb lb-primary lb-lg w-full sm:w-auto">
            {HERO.ctaPrimary}
            <Icon name="arrow-right" />
          </a>
          <WhatsAppCta label={HERO.ctaWhatsapp} className="lb-lg w-full sm:w-auto" />
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
