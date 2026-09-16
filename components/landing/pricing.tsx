import { LINKS, PRICING } from "@/lib/content";
import { Icon } from "./icons";
import { OfferDeadline } from "./offer-deadline";
import { Heading, Section, Tick } from "./ui";
import { WhatsAppCta } from "./whatsapp-cta";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * Free as a wide row on top (it is what most visitors take), the two
 * paid plans as bordered cards, one shared feature list, then the
 * founder's offer in a black panel. Prices here are display only —
 * convex/billing.ts holds the amounts actually charged.
 */
export function Pricing() {
  return (
    <Section id="pricing" wash>
      <Heading title={PRICING.heading} sub={PRICING.sub} />

      <div className="mt-12 rounded-3xl border border-[var(--l-line)] bg-white p-8 md:p-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <div className="flex items-baseline gap-3">
              <h3 className="text-2xl font-bold">{PRICING.free.name}</h3>
              <span className="text-2xl font-bold tracking-tight">₹0</span>
            </div>
            <p className="mt-1 text-[15px] text-[var(--l-muted)]">{PRICING.free.line}</p>
            <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
              {PRICING.free.features.map((f) => (
                <Tick key={f}>{f}</Tick>
              ))}
            </ul>
          </div>
          <a href={LINKS.cta} className="lb lb-outline h-12 flex-none px-6 text-base">
            {PRICING.free.cta}
          </a>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {PRICING.plans.map((plan) => {
          const featured = plan.featured;
          const saved = plan.listPrice - plan.price;
          /* Only the yearly plan can be compared to paying monthly. */
          const vsMonthly = plan.period === "year" ? PRICING.yearlySaving() : null;
          return (
            <article
              key={plan.id}
              className={`relative rounded-3xl border bg-white p-8 md:p-10 ${
                featured ? "border-[var(--l-ink)]" : "border-[var(--l-line)]"
              }`}
            >
              {vsMonthly && vsMonthly.amount > 0 ? (
                /* The badge rounds, and sits next to a different saving,
                   so hovering shows the actual sum — same pattern as the
                   deadline pill. */
                <span
                  title={vsMonthly.working}
                  className="absolute -top-3 left-8 cursor-help rounded-full bg-[var(--l-ink)] px-3 py-1 text-[12px] font-semibold text-white md:left-10"
                >
                  Save {inr(vsMonthly.amount)} vs paying monthly
                </span>
              ) : null}

              <h3 className="text-2xl font-bold">{plan.name}</h3>
              <p className="mt-1 text-[15px] text-[var(--l-muted)]">{plan.line}</p>

              <div className="mt-6 flex flex-wrap items-baseline gap-x-2">
                <span className="text-5xl font-bold tracking-tight">{inr(plan.price)}</span>
                <span className="text-[15px] text-[var(--l-muted)]">/ {plan.period}</span>
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-2 text-[14px]">
                <span className="text-[var(--l-muted)] line-through">{inr(plan.listPrice)}</span>
                <span className="l-pill bg-[#e6f7ec] px-2.5 py-0.5 text-[12px] text-[#15803d]">
                  Launch offer · save {inr(saved)}
                </span>
                {/* Disappears by itself once the date passes — see
                    lib/launch-offer.ts. */}
                <OfferDeadline />
              </p>
              {plan.period === "year" ? (
                <p className="mt-2 text-[14px] text-[var(--l-muted)]">
                  Works out to {inr(plan.perMonth)} a month.
                </p>
              ) : null}

              <a
                href="/app/billing"
                className={`lb mt-8 h-12 w-full text-base ${
                  featured ? "lb-primary" : "lb-outline"
                }`}
              >
                {plan.cta}
                <Icon name="arrow-right" />
              </a>
              <p className="mt-4 text-[13px] text-[var(--l-muted)]">{plan.best}</p>
            </article>
          );
        })}
      </div>

      <div className="mt-10 rounded-3xl border border-[var(--l-line)] bg-white p-8 md:p-10">
        <p className="text-[15px] font-semibold">Both plans include everything:</p>
        <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          {PRICING.features.map((f) => (
            <Tick key={f}>{f}</Tick>
          ))}
        </ul>
        <p className="mt-6 text-[14px] leading-relaxed text-[var(--l-muted)]">
          {PRICING.launchNote} {PRICING.anchor}
        </p>
      </div>

      <div className="mt-10 rounded-3xl bg-[var(--l-primary)] p-8 text-white md:p-12">
        <div className="flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <h3 className="text-2xl font-bold md:text-3xl">{PRICING.offer.heading}</h3>
            <p className="mt-3 text-[16px] leading-relaxed text-white/80">
              {PRICING.offer.body}
            </p>
            <p className="mt-3 text-[14px] text-white/50">{PRICING.offer.note}</p>
          </div>
          <WhatsAppCta
            label={PRICING.offer.cta}
            tone="dark"
            className="h-12 flex-none px-6 text-base"
          />
        </div>
      </div>
    </Section>
  );
}
