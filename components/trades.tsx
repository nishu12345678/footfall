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
    <section className="border-y border-rule bg-paper-2 px-5 py-6">
      <ul className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3">
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
    <section id="trades" className="px-5 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <SectionHead
            eyebrow={TRADES.eyebrow}
            heading={TRADES.heading}
            sub={TRADES.sub}
            align="center"
          />
        </Reveal>

        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TRADES.items.map((trade, i) => (
            <Reveal key={trade.name} delay={Math.min(i * 50, 300)}>
              <li className="card flex h-full items-start gap-4 p-5 transition-shadow hover:shadow-lift">
                <span
                  aria-hidden
                  className="grid h-12 w-12 flex-none place-items-center rounded-xl bg-paper-2 text-[24px]"
                >
                  {trade.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-[18px] font-bold tracking-tight">
                    {trade.name}
                  </span>
                  <span className="mt-1 block text-[15px] leading-relaxed text-ink-soft">
                    {trade.line}
                  </span>
                </span>
              </li>
            </Reveal>
          ))}
        </ul>

        <Reveal delay={120}>
          <div className="mt-10 flex flex-col items-center gap-5 text-center">
            <p className="text-[17px] text-muted">{TRADES.note}</p>
            <a href={LINKS.cta} className="btn btn-primary">
              Try now — free
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
