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
      className="bg-paper-2 px-6 py-24 sm:px-10 sm:py-32 lg:px-16"
    >
      <div className="mx-auto grid max-w-[1400px] items-start gap-14 lg:grid-cols-2 lg:gap-20">
        <Reveal>
          <p className="eyebrow">{REPORT.eyebrow}</p>
          <h2 className="mt-4 text-[clamp(2.2rem,4.5vw,3.6rem)]">
            {REPORT.heading}
          </h2>
          <p className="mt-5 text-[clamp(1.1rem,1.8vw,1.3rem)] leading-relaxed text-ink-soft">
            {REPORT.sub}
          </p>

          <ol className="mt-10 grid gap-4">
            {REPORT.steps.map((step, i) => (
              <li key={step} className="flex items-baseline gap-4">
                <span
                  aria-hidden
                  className="w-9 flex-none text-[28px] font-extrabold leading-none tracking-[-0.03em] text-pin"
                >
                  {i + 1}
                </span>
                <span className="text-[17px] font-medium">{step}</span>
              </li>
            ))}
          </ol>

          <div className="mt-10 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center">
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

          <p className="mt-5 text-[15px] leading-relaxed text-muted">
            {REPORT.note}
          </p>
        </Reveal>

        <div className="grid gap-6 lg:gap-8">
          <Reveal delay={80}>
            <div className="card p-8">
              <p className="text-[17px] font-bold">What the report tells you</p>
              <ul className="mt-6 grid gap-5">
                {REPORT.checks.map((check) => (
                  <li key={check.label} className="flex items-start gap-4">
                    <span
                      aria-hidden
                      className="grid h-12 w-12 flex-none place-items-center rounded-[14px] bg-paper-2 text-[22px]"
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
            <div className="card flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
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
