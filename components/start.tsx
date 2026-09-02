import { HERO, LINKS } from "@/lib/content";
import { Reveal } from "./reveal";

/**
 * Final call to action.
 *
 * Two doors, because owners split cleanly into two kinds: the ones who
 * will just sign in, and the ones who want to message a person first.
 * Both live in lib/content.ts → LINKS.
 */
export function Start() {
  return (
    <section id="start" className="bg-pin px-5 py-20 text-white sm:py-28">
      <div className="mx-auto max-w-2xl text-center">
        <Reveal>
          <h2 className="text-[clamp(2.1rem,5.5vw,3.4rem)]">
            Let&rsquo;s look at your listing together
          </h2>

          <p className="mx-auto mt-6 max-w-lg text-[19px] leading-relaxed text-white/85">
            Send us your business name and area. We&rsquo;ll pull up your Google
            listing, tell you exactly what&rsquo;s broken on it, and fix the
            first three things with you — today, while you watch.
          </p>

          <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            <a
              href={LINKS.cta}
              className="btn border-white bg-white text-pin hover:bg-white/90"
            >
              {HERO.ctaPrimary}
            </a>
            <a
              href={LINKS.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-whatsapp"
            >
              {HERO.ctaWhatsapp}
            </a>
          </div>

          <p className="mt-5 text-[15px] text-white/70">
            No card. No call booking. No 40-minute demo.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
