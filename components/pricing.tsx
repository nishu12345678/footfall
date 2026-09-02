"use client";

import { useState } from "react";
import { LINKS, PRICING } from "@/lib/content";
import { Reveal } from "./reveal";
import { SectionHead } from "./window-card";

export function Pricing() {
  const [yearly, setYearly] = useState(false);

  return (
    <section
      id="pricing"
      className="border-y border-rule bg-paper-2 px-5 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionHead
            eyebrow={PRICING.eyebrow}
            heading={PRICING.heading}
            sub={PRICING.sub}
            align="center"
          />
        </Reveal>

        {/* billing toggle */}
        <Reveal delay={60}>
          <div className="mt-8 flex justify-center">
            <div
              role="group"
              aria-label="billing period"
              className="inline-flex items-center gap-1 rounded-full border border-rule bg-paper p-1 shadow-card"
            >
              {[
                { label: "monthly", value: false },
                { label: "yearly", value: true },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setYearly(opt.value)}
                  aria-pressed={yearly === opt.value}
                  className={`rounded-full px-4 py-1.5 font-display text-[15px] font-semibold transition-colors ${
                    yearly === opt.value
                      ? "bg-ink text-paper-2"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  {opt.label}
                  {opt.value ? (
                    <span
                      className={`ml-1.5 font-mono text-[12px] ${
                        yearly ? "text-star" : "text-pin"
                      }`}
                    >
                      {PRICING.yearlyDiscountLabel}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="mt-10 grid items-start gap-5 lg:grid-cols-3">
          {PRICING.plans.map((plan, i) => {
            const price = yearly ? plan.priceYearly : plan.priceMonthly;
            const featured = plan.badge === "popular";

            return (
              <Reveal key={plan.id} delay={i * 80}>
                <article
                  className={`relative h-full rounded-[16px] border bg-paper p-6 ${
                    featured
                      ? "border-pin shadow-lift lg:-translate-y-2"
                      : "border-rule shadow-card"
                  }`}
                >
                  {plan.badge ? (
                    <span className="absolute -top-3 left-6 rounded-full border border-rule bg-pin px-2.5 py-0.5 font-mono text-[12px] uppercase tracking-wider text-paper-2">
                      {plan.badge}
                    </span>
                  ) : null}

                  <h3 className="text-[1.7rem]">{plan.name}</h3>
                  <p className="mt-1 text-[16px] text-ink-soft">{plan.line}</p>

                  <p className="mt-5 flex items-baseline gap-1">
                    <span className="font-display text-[2.8rem] font-bold leading-none">
                      ₹{price.toLocaleString("en-IN")}
                    </span>
                    <span className="font-mono text-[13px] text-muted">
                      {price === 0 ? "forever" : "/ month"}
                    </span>
                  </p>
                  <p className="mt-1 font-mono text-[12px] text-muted">
                    {price === 0
                      ? "no card needed"
                      : yearly
                        ? "billed yearly"
                        : "billed monthly"}
                  </p>

                  <a
                    href={LINKS.cta}
                    className={`btn mt-5 w-full ${
                      featured ? "btn-primary" : "btn-ghost"
                    }`}
                  >
                    {plan.cta}
                  </a>

                  <p className="mt-5 font-mono text-[12px] uppercase tracking-wider text-muted">
                    {plan.best}
                  </p>

                  <ul className="mt-3 space-y-2 border-t border-rule-soft pt-4">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start gap-2 text-[16px] leading-snug text-ink-soft"
                      >
                        <span
                          aria-hidden
                          className="mt-0.5 flex-none font-mono text-[13px] text-open"
                        >
                          ✓
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </article>
              </Reveal>
            );
          })}
        </div>

        <Reveal delay={120}>
          <p className="mx-auto mt-8 max-w-xl text-center text-[16px] leading-relaxed text-muted">
            {PRICING.anchor}
          </p>
        </Reveal>

        {/* the reference's "maker discount" block */}
        <Reveal delay={160}>
          <div className="mt-12 rounded-[16px] border border-rule bg-ink p-7 text-paper-2 shadow-lift sm:p-9">
            <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-xl">
                <h3 className="font-mono text-[17px] font-bold tracking-wide text-star">
                  {PRICING.offer.heading}
                </h3>
                <p className="mt-3 text-[17px] leading-relaxed text-paper-2/85">
                  {PRICING.offer.body}
                </p>
                <p className="mt-3 font-mono text-[12px] text-paper-2/50">
                  {PRICING.offer.note}
                </p>
              </div>
              <a
                href={LINKS.cta}
                className="btn btn-primary flex-none border-paper-2"
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
