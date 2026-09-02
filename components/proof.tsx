import { PROOF } from "@/lib/content";
import { Reveal } from "./reveal";

/**
 * Social proof, the reference's tweet-wall equivalent.
 *
 * Anything still flagged `placeholder` renders a visible "sample" tag, so
 * invented praise can never quietly ship. Replace the array in lib/content.ts
 * with real quotes and set placeholder: false.
 */
export function Proof() {
  return (
    <section id="proof" className="px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="text-center">
          <p className="eyebrow justify-center">
            <span className="inline-block h-px w-6 bg-rule" aria-hidden />
            {PROOF.eyebrow}
            <span className="inline-block h-px w-6 bg-rule" aria-hidden />
          </p>

          <p className="mt-6 font-display text-[clamp(3rem,10vw,6rem)] font-bold leading-none">
            {PROOF.stat.value}
          </p>
          <p className="mt-2 font-display text-[clamp(1.1rem,2.6vw,1.5rem)] font-medium">
            {PROOF.stat.label}
          </p>
          <p className="mx-auto mt-4 max-w-md text-[17px] leading-relaxed text-ink-soft">
            {PROOF.note}
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PROOF.quotes.map((quote, i) => (
            <Reveal key={quote.text} delay={i * 70}>
              <figure className="relative h-full rounded-[16px] border border-rule bg-paper-2 p-5 shadow-card">
                {quote.placeholder ? (
                  <span className="absolute -top-2.5 right-3 rounded-full border border-rule bg-star px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider">
                    sample
                  </span>
                ) : null}

                <span aria-hidden className="font-display text-[32px] leading-none text-pin">
                  “
                </span>
                <blockquote className="mt-1 text-[16px] leading-relaxed text-ink">
                  {quote.text}
                </blockquote>
                <figcaption className="mt-4 border-t border-rule-soft pt-3">
                  <span className="block font-display text-[15px] font-bold">
                    {quote.name}
                  </span>
                  <span className="font-mono text-[12px] text-muted">
                    {quote.meta}
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
