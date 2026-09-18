import type { ReactNode } from "react";
import { PROOF } from "@/lib/content";
import { AppPerformanceMock, AppReviewsMock } from "./app-mock";
import { Heading, Section } from "./ui";

/* Which mock renders in which evidence card. */
const EVIDENCE: Record<string, ReactNode> = {
  reviews: <AppReviewsMock />,
  performance: <AppPerformanceMock />,
};

/**
 * Quotes in a row that scrolls sideways on a phone and sits four-up on
 * a desktop.
 *
 * These quotes are illustrative of what owners tell us, not verbatim
 * attributed testimonials — see the PROOF.quotes note in lib/content.ts.
 * They carried a visible "Sample" tag until it was removed by request;
 * the `placeholder` flag is still set on each one and is what to key off
 * if that marker is ever wanted back.
 */
export function Proof() {
  return (
    <Section id="proof">
      <Heading
        title={PROOF.heading}
        sub={`${PROOF.stat.value} ${PROOF.stat.label}. ${PROOF.note}`}
      />

      {/* The app rebuilt in HTML with sample data — sharp at every
          width, nothing to screenshot or anonymise. */}
      <div className="mx-auto mt-12 grid max-w-3xl gap-6 md:grid-cols-2">
        {PROOF.evidence.map((e) => (
          <figure
            key={e.id}
            className="flex flex-col overflow-hidden rounded-3xl border border-[var(--l-line)]"
          >
            <div className="flex-1">{EVIDENCE[e.id]}</div>
            <figcaption className="border-t border-[var(--l-line)] px-6 py-4 text-[13px] text-[var(--l-muted)]">
              {e.caption}
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-4 text-center text-[12px] text-[#9ca3af]">
        {PROOF.evidenceNote}
      </p>

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
