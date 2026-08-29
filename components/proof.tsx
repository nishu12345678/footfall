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
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-ink-soft">
            {PROOF.note}
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PROOF.quotes.map((quote, i) => (
            <Reveal key={quote.text} delay={i * 70}>
              <figure className="relative h-full rounded-[14px] border border-ink bg-paper-2 p-5 shadow-[3px_4px_0_var(--color-ink)]">
                {quote.placeholder ? (
                  <span className="absolute -top-2.5 right-3 rounded-full border border-ink bg-star px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider">
                    sample
                  </span>
                ) : null}

                <span aria-hidden className="font-display text-[28px] leading-none text-pin">
                  “
                </span>
                <blockquote className="mt-1 text-[14px] leading-relaxed text-ink">
                  {quote.text}
                </blockquote>
                <figcaption className="mt-4 border-t border-rule-soft pt-3">
                  <span className="block font-display text-[13px] font-bold">
                    {quote.name}
                  </span>
                  <span className="font-mono text-[10px] text-muted">
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
