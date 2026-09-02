import { LINKS, REPORT } from "@/lib/content";
import { Reveal } from "./reveal";

/**
 * The free report, on the landing page.
 *
 * This is the cheapest thing a stranger can say yes to. Somebody who will
 * never read a pricing page will still want to know what is wrong with
 * their own listing — so the report leads, and the plan follows.
 *
 * The sample card on the right is written to look exactly like the real
 * /app/report screen, because it is the same three severities.
 */
export function Report() {
  return (
    <section
      id="report"
      className="border-y border-rule bg-paper-2 px-5 py-20 sm:py-28"
    >
      <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <p className="eyebrow">{REPORT.eyebrow}</p>
          <h2 className="mt-4 text-[clamp(2rem,4.6vw,3rem)]">
            {REPORT.heading}
          </h2>
          <p className="mt-4 text-[19px] leading-relaxed text-ink-soft">
            {REPORT.sub}
          </p>

          <ol className="mt-8 grid gap-3">
            {REPORT.steps.map((step, i) => (
              <li key={step} className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="grid h-8 w-8 flex-none place-items-center rounded-full bg-pin text-[15px] font-bold text-white"
                >
                  {i + 1}
                </span>
                <span className="text-[17px] font-medium">{step}</span>
              </li>
            ))}
          </ol>

          <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <a href={LINKS.cta} className="btn btn-primary">
              {REPORT.cta}
            </a>
            <a
              href={LINKS.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
            >
              Ask us first
            </a>
          </div>

          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            {REPORT.note}
          </p>
        </Reveal>

        <div className="grid gap-5">
          <Reveal delay={80}>
            <div className="card p-6">
              <p className="text-[17px] font-bold">What the report tells you</p>
              <ul className="mt-4 grid gap-4">
                {REPORT.checks.map((check) => (
                  <li key={check.label} className="flex items-start gap-3.5">
                    <span
                      aria-hidden
                      className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-paper-2 text-[20px]"
                    >
                      {check.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[17px] font-bold">
                        {check.label}
                      </span>
                      <span className="mt-0.5 block text-[16px] leading-relaxed text-ink-soft">
                        {check.line}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal delay={160}>
            <div className="flex flex-col gap-2 rounded-[16px] border border-rule bg-white p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[16px] font-bold text-open">
                {REPORT.freeLine}
              </p>
              <p className="text-[16px] leading-relaxed text-ink-soft">
                {REPORT.paidLine}
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
