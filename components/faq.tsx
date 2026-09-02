import { FAQ } from "@/lib/content";
import { Reveal } from "./reveal";
import { SectionHead } from "./window-card";

/**
 * Native <details> accordion — works with javascript disabled and is
 * keyboard-accessible without any of our own code.
 */
export function Faq() {
  return (
    <section id="faq" className="px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-3xl">
        <Reveal>
          <SectionHead
            eyebrow={FAQ.eyebrow}
            heading={FAQ.heading}
            sub={FAQ.sub}
            align="center"
          />
        </Reveal>

        <div className="mt-12 divide-y divide-rule-soft border-y border-rule">
          {FAQ.items.map((item, i) => (
            <Reveal key={item.q} delay={Math.min(i * 40, 240)}>
              <details className="group py-1">
                <summary className="flex cursor-pointer list-none items-start gap-4 py-4 [&::-webkit-details-marker]:hidden">
                  <span className="mt-1 font-mono text-[13px] text-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 font-display text-[19px] font-semibold leading-snug transition-colors group-hover:text-pin">
                    {item.q}
                  </span>
                  <span
                    aria-hidden
                    className="mt-0.5 flex-none font-mono text-[17px] text-pin transition-transform duration-200 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="pb-5 pl-[2.1rem] pr-8 text-[17px] leading-relaxed text-ink-soft">
                  {item.a}
                </p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
