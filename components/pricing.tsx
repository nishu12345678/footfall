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
    <section id="pricing" className="border-y border-rule bg-paper-2 px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-5xl">
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
          <div className="mt-12 rounded-[16px] border border-rule bg-white p-7 shadow-card">
            <div className="flex flex-wrap items-baseline justify-between gap-4">
              <div>
                <h3 className="text-[1.5rem]">{PRICING.free.name}</h3>
                <p className="mt-1 text-[16px] text-ink-soft">
                  {PRICING.free.line}
                </p>
              </div>
              <p className="text-[2.4rem] font-extrabold leading-none tracking-tight">
                ₹0
              </p>
            </div>
            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {PRICING.free.features.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2.5 text-[16px] leading-snug text-ink-soft"
                >
                  <span
                    aria-hidden
                    className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-open text-[11px] text-white"
                  >
                    ✓
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <a href={LINKS.cta} className="btn btn-ghost mt-6 w-full sm:w-auto">
              {PRICING.free.cta}
            </a>
          </div>
        </Reveal>

        <p className="mt-10 text-center text-[16px] font-semibold uppercase tracking-wider text-muted">
          To have footfall actually do the work
        </p>

        <div className="mt-6 grid items-start gap-5 md:grid-cols-2">
          {PRICING.plans.map((plan, i) => {
            const featured = Boolean(plan.badge);
            const saved = plan.listPrice - plan.price;

            return (
              <Reveal key={plan.id} delay={i * 80}>
                <article
                  className={`relative h-full rounded-[16px] bg-white p-7 ${
                    featured
                      ? "border-2 border-pin shadow-lift md:-translate-y-2"
                      : "border border-rule shadow-card"
                  }`}
                >
                  {plan.badge ? (
                    <span className="absolute -top-3.5 left-7 rounded-full bg-pin px-3 py-1 text-[13px] font-bold text-white">
                      {plan.badge}
                    </span>
                  ) : null}

                  <h3 className="text-[1.7rem]">{plan.name}</h3>
                  <p className="mt-1 text-[16px] text-ink-soft">{plan.line}</p>

                  <div className="mt-6 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="text-[3rem] font-extrabold leading-none tracking-tight">
                      {inr(plan.price)}
                    </span>
                    <span className="text-[16px] text-muted">
                      / {plan.period}
                    </span>
                  </div>

                  <p className="mt-2.5 flex flex-wrap items-center gap-2">
                    <span className="text-[17px] text-muted line-through">
                      {inr(plan.listPrice)}
                    </span>
                    <span className="rounded-full bg-open-soft px-2.5 py-1 text-[13px] font-bold text-open">
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
                    className={`btn mt-7 w-full ${
                      featured ? "btn-primary" : "btn-ghost"
                    }`}
                  >
                    {plan.cta}
                  </a>

                  <p className="mt-5 text-[14px] font-semibold uppercase tracking-wider text-muted">
                    {plan.best}
                  </p>
                </article>
              </Reveal>
            );
          })}
        </div>

        {/* One list, because both plans are the same product. */}
        <Reveal delay={140}>
          <div className="mt-8 rounded-[16px] border border-rule bg-white p-7 shadow-card">
            <p className="text-[17px] font-bold">
              Both plans include everything:
            </p>
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {PRICING.features.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2.5 text-[16px] leading-snug text-ink-soft"
                >
                  <span
                    aria-hidden
                    className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-open text-[11px] text-white"
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
          <p className="mx-auto mt-7 max-w-2xl text-center text-[16px] leading-relaxed text-muted">
            {PRICING.launchNote}
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-center text-[16px] leading-relaxed text-muted">
            {PRICING.anchor}
          </p>
        </Reveal>

        <Reveal delay={220}>
          <div className="mt-12 rounded-[16px] bg-ink p-8 text-white shadow-lift sm:p-10">
            <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <h3 className="text-[1.5rem] text-white">
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
                className="btn btn-whatsapp flex-none"
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
