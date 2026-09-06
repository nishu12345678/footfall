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

        <div className="card mt-12 divide-y divide-black/8">
          {FAQ.items.map((item, i) => (
            <Reveal key={item.q} delay={Math.min(i * 40, 240)}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-start gap-4 px-6 py-5 [&::-webkit-details-marker]:hidden">
                  <span className="mt-1 text-[13px] font-medium text-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 font-display text-[19px] font-semibold leading-snug transition-colors group-hover:text-pin">
                    {item.q}
                  </span>
                  <span
                    aria-hidden
                    className="mt-0.5 flex-none text-[19px] font-medium leading-none text-pin transition-transform duration-200 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="pb-6 pl-14 pr-12 text-[17px] leading-relaxed text-ink-soft">
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
