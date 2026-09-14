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
    <section id="start" className="px-6 py-24 sm:px-10 sm:py-32 lg:px-16">
      <div className="mx-auto max-w-[1400px] rounded-[36px] bg-ink p-10 text-white shadow-lift sm:p-16">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal>
            <h2 className="text-[clamp(2.2rem,5vw,4rem)] text-white">
              Let&rsquo;s look at your listing together
            </h2>

            <p className="mx-auto mt-8 max-w-xl text-[19px] leading-relaxed text-white/60">
              Send us your business name and area. We&rsquo;ll pull up your Google
              listing, tell you exactly what&rsquo;s broken on it, and fix the
              first three things with you — today, while you watch.
            </p>

            <div className="mt-12 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
              <a
                href={LINKS.cta}
                className="btn bg-white text-ink hover:bg-white/90"
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

            <p className="mt-8 text-[15px] text-white/50">
              No card. No call booking. No 40-minute demo.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
