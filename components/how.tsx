import { STEPS } from "@/lib/content";
import { Reveal } from "./reveal";
import { SectionHead } from "./window-card";

export function How() {
  return (
    <section id="how" className="px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionHead
            eyebrow="how it works"
            heading="three steps, and only the first one is yours"
            sub="you do step one. we do step two. step three is the point."
          />
        </Reveal>

        <ol className="mt-12 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 90}>
              <li className="relative h-full rounded-[14px] border border-ink bg-paper-2 p-6 shadow-[3px_4px_0_var(--color-ink)]">
                <span className="font-mono text-[11px] text-pin">{step.n}</span>
                <h3 className="mt-3 text-[1.6rem]">{step.title}</h3>
                <p className="mt-1 font-mono text-[11px] text-muted">
                  {step.time}
                </p>
                <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
                  {step.body}
                </p>
                {i < STEPS.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute -right-3 top-1/2 hidden -translate-y-1/2 font-mono text-ink md:block"
                  >
                    →
                  </span>
                ) : null}
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
