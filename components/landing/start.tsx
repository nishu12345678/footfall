import { HERO, LINKS, START } from "@/lib/content";
import { Icon } from "./icons";
import { Section } from "./ui";
import { WhatsAppCta } from "./whatsapp-cta";

/**
 * Final call: two doors, sign in or message a person.
 *
 * The backdrop draws the thing the section is actually about — a shop
 * being found on a map. It is built from the page's own icon language
 * rather than a photograph, for two reasons: the text here is centred
 * and a photo behind centred text fights it at every breakpoint, and
 * the rest of the page has no photographic chrome, so one would read as
 * decoration bolted on.
 *
 * Everything below is aria-hidden and sits behind an -z-10 / isolate
 * boundary, so it can never intercept a click on the two buttons.
 */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {/* A soft wash rising from the footer, so the last section lifts off
          the page without a hard band edge. */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_100%,var(--l-wash)_0%,transparent_70%)]" />

      {/* Map grid — streets. Fades out before it reaches the copy so the
          text never sits on a line. */}
      <div
        className="absolute inset-0 opacity-[0.55]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--l-line) 1px, transparent 1px), linear-gradient(to bottom, var(--l-line) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage:
            "radial-gradient(75% 60% at 50% 50%, transparent 30%, #000 78%)",
          WebkitMaskImage:
            "radial-gradient(75% 60% at 50% 50%, transparent 30%, #000 78%)",
        }}
      />

      {/* Two faint pins: the other shops on the street. */}
      <Icon
        name="map-pin"
        size={72}
        strokeWidth={1}
        className="absolute left-[6%] top-[18%] hidden text-[var(--l-ink)] opacity-[0.07] lg:block"
      />
      <Icon
        name="map-pin"
        size={56}
        strokeWidth={1}
        className="absolute right-[9%] bottom-[16%] hidden text-[var(--l-ink)] opacity-[0.07] lg:block"
      />

      {/* Yours: the one that got found. Same glyph, but in the brand green
          and ringed, so the eye reads "this one is live" without a word of
          explanation. */}
      <span className="absolute right-[11%] top-[38%] hidden lg:block">
        <span className="absolute inset-0 -m-3 rounded-full bg-[var(--l-green)] opacity-[0.05]" />
        <span className="absolute inset-0 -m-7 rounded-full bg-[var(--l-green)] opacity-[0.035]" />
        <Icon
          name="map-pin"
          size={64}
          strokeWidth={1.2}
          className="relative text-[var(--l-green)] opacity-[0.16]"
        />
      </span>
    </div>
  );
}

export function Start() {
  return (
    <Section id="start" className="relative isolate overflow-hidden">
      <Backdrop />

      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-4xl md:text-[3.5rem] md:leading-[1.05]">{START.heading}</h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-[var(--l-muted)] md:text-xl">
          {START.sub}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row md:gap-3">
          <a href={LINKS.cta} className="lb lb-primary lb-lg w-full sm:w-auto">
            {HERO.ctaPrimary}
            <Icon name="arrow-right" />
          </a>
          <WhatsAppCta label={HERO.ctaWhatsapp} className="lb-lg w-full sm:w-auto" />
        </div>
        <p className="mt-5 text-[14px] text-[var(--l-muted)]">{START.note}</p>
      </div>
    </Section>
  );
}
