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
    <section id="proof" className="px-6 py-24 sm:px-10 sm:py-32 lg:px-16">
      <div className="mx-auto max-w-[1400px]">
        <Reveal className="text-center">
          <p className="eyebrow justify-center">{PROOF.eyebrow}</p>

          <p className="mt-8 font-display text-[clamp(3.5rem,11vw,7rem)] font-extrabold leading-none tracking-[-0.04em]">
            {PROOF.stat.value}
          </p>
          <p className="mt-2 font-display text-[clamp(1.1rem,2.6vw,1.5rem)] font-medium">
            {PROOF.stat.label}
          </p>
          <p className="mx-auto mt-5 max-w-md text-[17px] leading-relaxed text-ink-soft">
            {PROOF.note}
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4 lg:gap-8">
          {PROOF.quotes.map((quote, i) => (
            <Reveal key={quote.text} delay={i * 70}>
              <figure className="card relative h-full p-8">
                {quote.placeholder ? (
                  <span className="absolute -top-2.5 right-3 whitespace-nowrap rounded-full bg-star/15 px-2.5 py-1 text-[11px] font-semibold leading-none text-[#8a5a13]">
                    sample
                  </span>
                ) : null}

                <span aria-hidden className="font-display text-[32px] leading-none text-pin">
                  “
                </span>
                <blockquote className="mt-1 text-[16px] leading-relaxed text-ink">
                  {quote.text}
                </blockquote>
                <figcaption className="mt-6 border-t border-black/8 pt-4">
                  <span className="block font-display text-[15px] font-semibold">
                    {quote.name}
                  </span>
                  <span className="text-[12px] text-muted">
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
