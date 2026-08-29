import { DOES } from "@/lib/content";
import { Reveal } from "./reveal";
import { SectionHead } from "./window-card";

export function Does() {
  return (
    <section
      id="does"
      className="border-y border-rule bg-paper-2 px-5 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionHead
            eyebrow={DOES.eyebrow}
            heading={DOES.heading}
            sub={DOES.sub}
          />
        </Reveal>

        <div className="mt-12 grid gap-5 md:grid-cols-2">
          {DOES.items.map((item, i) => (
            <Reveal
              key={item.tag}
              delay={i * 70}
              className={i === 0 ? "md:col-span-2" : ""}
            >
              <article
                className={`h-full rounded-[14px] border border-ink bg-paper p-6 shadow-[3px_4px_0_var(--color-ink)] ${
                  i === 0 ? "md:p-8" : ""
                }`}
              >
                <span className="chip">
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-pin"
                    aria-hidden
                  />
                  {item.tag}
                </span>
                <h3
                  className={`mt-4 ${
                    i === 0
                      ? "text-[clamp(1.5rem,3.4vw,2.2rem)] md:max-w-2xl"
                      : "text-[1.45rem]"
                  }`}
                >
                  {item.title}
                </h3>
                <p
                  className={`mt-3 text-[15px] leading-relaxed text-ink-soft ${
                    i === 0 ? "md:max-w-2xl" : ""
                  }`}
                >
                  {item.body}
                </p>
                <p className="mt-4 border-t border-rule-soft pt-3 font-mono text-[11px] text-muted">
                  {item.detail}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
