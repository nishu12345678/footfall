import { DOES } from "@/lib/content";
import { Reveal } from "./reveal";
import { SectionHead } from "./window-card";

export function Does() {
  return (
    <section
      id="does"
      className="bg-paper-2 px-6 py-24 sm:px-10 sm:py-32 lg:px-16"
    >
      <div className="mx-auto max-w-[1400px]">
        <Reveal>
          <SectionHead
            eyebrow={DOES.eyebrow}
            heading={DOES.heading}
            sub={DOES.sub}
          />
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:mt-16 lg:gap-8">
          {DOES.items.map((item, i) => (
            <Reveal
              key={item.tag}
              delay={i * 70}
              className={i === 0 ? "md:col-span-2" : ""}
            >
              <article
                className={`card h-full p-8 ${
                  i === 0 ? "md:p-10" : ""
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
                  className={`mt-3 text-[17px] leading-relaxed text-ink-soft ${
                    i === 0 ? "md:max-w-2xl" : ""
                  }`}
                >
                  {item.body}
                </p>
                <p className="mt-6 border-t border-black/8 pt-4 text-[13px] text-muted">
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
