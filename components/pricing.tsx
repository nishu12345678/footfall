import { LINKS, PRICING } from "@/lib/content";
import { Reveal } from "./reveal";
import { SectionHead } from "./window-card";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * Two plans, same product.
 *
 * The struck-through number is the price this becomes after launch, not an
 * invented "value" — so it has to stay true. Prices here are display only;
 * convex/billing.ts holds the amounts that are actually charged.
 */
export function Pricing() {
  return (
    <section id="pricing" className="bg-paper-2 px-6 py-24 sm:px-10 sm:py-32 lg:px-16">
      <div className="mx-auto max-w-[1400px]">
        <Reveal>
          <SectionHead
            eyebrow={PRICING.eyebrow}
            heading={PRICING.heading}
            sub={PRICING.sub}
            align="center"
          />
        </Reveal>

        {/* Free comes first, because it is what most visitors will take. */}
        <Reveal>
          <div className="card mt-14 p-10 lg:mt-16">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <h3 className="text-[1.5rem]">{PRICING.free.name}</h3>
                <p className="mt-1 text-[16px] text-ink-soft">
                  {PRICING.free.line}
                </p>
              </div>
              <p className="text-[48px] font-extrabold leading-none tracking-[-0.04em]">
                ₹0
              </p>
            </div>
            <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PRICING.free.features.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2.5 text-[16px] leading-snug text-ink-soft"
                >
                  <span
                    aria-hidden
                    className="mt-0.5 flex-none text-[15px] font-semibold text-open-deep"
                  >
                    ✓
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <a href={LINKS.cta} className="btn btn-ghost mt-8 w-full sm:w-auto">
              {PRICING.free.cta}
            </a>
          </div>
        </Reveal>

        <p className="mt-14 text-center text-[13px] font-medium text-muted">
          To have footfall actually do the work
        </p>

        <div className="mt-8 grid items-start gap-6 md:grid-cols-2 lg:gap-8">
          {PRICING.plans.map((plan, i) => {
            const featured = Boolean(plan.badge);
            const saved = plan.listPrice - plan.price;

            return (
              <Reveal key={plan.id} delay={i * 80}>
                <article
                  className={`card relative h-full p-10 ${
                    featured
                      ? "shadow-lift ring-1 ring-pin/15 lg:-translate-y-3 lg:scale-[1.02]"
                      : ""
                  }`}
                >
                  {plan.badge ? (
                    <span className="absolute -top-3.5 left-10 rounded-full bg-pin px-3 py-1 text-[13px] font-semibold text-white">
                      {plan.badge}
                    </span>
                  ) : null}

                  <h3 className="text-[1.7rem]">{plan.name}</h3>
                  <p className="mt-1 text-[16px] text-ink-soft">{plan.line}</p>

                  <div className="mt-8 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="text-[56px] font-extrabold leading-none tracking-[-0.04em]">
                      {inr(plan.price)}
                    </span>
                    <span className="text-[16px] text-muted">
                      / {plan.period}
                    </span>
                  </div>

                  <p className="mt-4 flex flex-wrap items-center gap-2">
                    <span className="text-[17px] text-muted line-through">
                      {inr(plan.listPrice)}
                    </span>
                    <span className="rounded-full bg-open-soft px-2.5 py-1 text-[13px] font-semibold text-open-deep">
                      Launch offer — save {inr(saved)}
                    </span>
                  </p>

                  {plan.period === "year" ? (
                    <p className="mt-2 text-[15px] text-ink-soft">
                      Works out to {inr(plan.perMonth)} a month.
                    </p>
                  ) : null}

                  <a
                    href="/app/billing"
                    className={`btn mt-9 w-full ${
                      featured ? "btn-primary" : "btn-ghost"
                    }`}
                  >
                    {plan.cta}
                  </a>

                  <p className="mt-5 text-[13px] font-medium text-muted">
                    {plan.best}
                  </p>
                </article>
              </Reveal>
            );
          })}
        </div>

        {/* One list, because both plans are the same product. */}
        <Reveal delay={140}>
          <div className="mt-16 border-t border-black/8 pt-10">
            <p className="text-[17px] font-semibold">
              Both plans include everything:
            </p>
            <ul className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {PRICING.features.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2.5 text-[16px] leading-snug text-ink-soft"
                >
                  <span
                    aria-hidden
                    className="mt-0.5 flex-none text-[15px] font-semibold text-open-deep"
                  >
                    ✓
                  </span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={180}>
          <p className="mx-auto mt-12 max-w-2xl text-center text-[16px] leading-relaxed text-muted">
            {PRICING.launchNote}
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-center text-[16px] leading-relaxed text-muted">
            {PRICING.anchor}
          </p>
        </Reveal>

        <Reveal delay={220}>
          <div className="mt-16 rounded-[32px] bg-ink p-10 text-white shadow-lift sm:p-14">
            <div className="flex flex-col items-start gap-8 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-2xl">
                <h3 className="text-[1.7rem] text-white">
                  {PRICING.offer.heading}
                </h3>
                <p className="mt-3 text-[17px] leading-relaxed text-white/80">
                  {PRICING.offer.body}
                </p>
                <p className="mt-3 text-[15px] text-white/50">
                  {PRICING.offer.note}
                </p>
              </div>
              <a
                href={LINKS.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="btn flex-none bg-white text-ink hover:bg-white/90"
              >
                {PRICING.offer.cta}
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
