import { PROOF } from "@/lib/content";
import { Heading, Section } from "./ui";

/**
 * Quotes in a row that scrolls sideways on a phone and sits four-up on
 * a desktop. Anything still marked placeholder in content.ts wears a
 * visible "Sample" tag so invented praise can't ship by accident.
 */
export function Proof() {
  return (
    <Section id="proof">
      <Heading
        title={PROOF.heading}
        sub={`${PROOF.stat.value} ${PROOF.stat.label}. ${PROOF.note}`}
      />

      <div className="l-snap -mx-6 mt-12 flex gap-6 overflow-x-auto px-6 pb-2 md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-4">
        {PROOF.quotes.map((q) => (
          <figure
            key={q.text}
            className="flex w-[85%] flex-none flex-col rounded-3xl border border-[var(--l-line)] p-8 sm:w-[360px] md:w-auto"
          >
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-medium text-[var(--l-muted)]">
                {q.meta}
              </span>
              {q.placeholder ? (
                <span className="l-pill bg-[#fef3c7] px-2.5 py-1 text-[11px] text-[#b45309]">
                  Sample
                </span>
              ) : null}
            </div>
            <blockquote className="mt-6 flex-1 text-[15px] leading-relaxed text-[var(--l-ink-2)]">
              “{q.text}”
            </blockquote>
            <figcaption className="mt-6 border-t border-[var(--l-line)] pt-6">
              <p className="font-semibold">{q.name}</p>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}
