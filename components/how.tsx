import { STEPS } from "@/lib/content";
import { Reveal } from "./reveal";
import { SectionHead } from "./window-card";

export function How() {
  return (
    <section id="how" className="px-6 py-24 sm:px-10 sm:py-32 lg:px-16">
      <div className="mx-auto max-w-[1400px]">
        <Reveal>
          <SectionHead
            eyebrow="How it works"
            heading="Three steps, and only the first one is yours"
            sub="You do step one. We do step two. Step three is the point."
          />
        </Reveal>

        <ol className="mt-16 grid gap-6 md:grid-cols-3 lg:mt-20 lg:gap-8">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 90}>
              <li className="relative h-full rounded-[24px] bg-paper-2 p-8">
                <span className="block text-[44px] font-extrabold leading-none tracking-[-0.03em] text-ink/10">
                  {step.n}
                </span>
                <h3 className="mt-5 text-[1.7rem]">{step.title}</h3>
                <p className="mt-1.5 text-[13px] font-medium text-muted">
                  {step.time}
                </p>
                <p className="mt-5 text-[17px] leading-relaxed text-ink-soft">
                  {step.body}
                </p>
                {i < STEPS.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-muted md:block"
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
