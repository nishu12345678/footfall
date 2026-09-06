import { LINKS, TRADES, TRUST } from "@/lib/content";
import { Reveal } from "./reveal";
import { SectionHead } from "./window-card";

/**
 * A thin strip of reassurances, straight under the hero.
 *
 * The objection this answers is never "what does it do" — it is "is this
 * safe, and is it for me". Four short lines beat another paragraph.
 */
export function TrustBar() {
  return (
    <section className="bg-paper-2 px-6 py-8 sm:px-10 sm:py-10 lg:px-16">
      <ul className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-center gap-x-10 gap-y-4">
        {TRUST.map((item) => (
          <li
            key={item}
            className="flex items-center gap-2.5 text-[15px] font-medium text-ink-soft"
          >
            <span
              aria-hidden
              className="grid h-5 w-5 flex-none place-items-center rounded-full bg-open text-[11px] text-white"
            >
              ✓
            </span>
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Who this is for, by trade.
 *
 * A salon owner does not read "for local businesses" and think "that's
 * me". They read "Salons & parlours" and think "that's me". Naming the
 * trade is the single highest-value thing on the page for this audience,
 * which is why it sits directly under the hero.
 */
export function Trades() {
  return (
    <section id="trades" className="px-6 py-24 sm:px-10 sm:py-32 lg:px-16">
      <div className="mx-auto max-w-[1400px]">
        <Reveal>
          <SectionHead
            eyebrow={TRADES.eyebrow}
            heading={TRADES.heading}
            sub={TRADES.sub}
            align="center"
          />
        </Reveal>

        <ul className="mt-16 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3 lg:gap-x-10 lg:gap-y-12">
          {TRADES.items.map((trade, i) => (
            <Reveal key={trade.name} delay={Math.min(i * 50, 300)}>
              <li className="flex h-full items-start gap-5">
                <span
                  aria-hidden
                  className="grid h-14 w-14 flex-none place-items-center rounded-[16px] bg-white text-[24px] shadow-card"
                >
                  {trade.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[18px] font-bold tracking-tight">
                    {trade.name}
                  </span>
                  <span className="mt-1.5 block text-[15px] leading-relaxed text-ink-soft">
                    {trade.line}
                  </span>
                </span>
              </li>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={120}>
          <div className="mt-16 flex flex-col items-center gap-5 text-center lg:mt-20">
            <p className="text-[17px] text-muted">{TRADES.note}</p>
            <a href={LINKS.cta} className="btn btn-primary">
              See your plan
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
