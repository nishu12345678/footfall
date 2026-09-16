import { TRADES } from "@/lib/content";
import { TRADE_TONES, TradeIcon } from "./trade-icons";
import { Heading, Section } from "./ui";

/**
 * Naming the trade is what makes an owner read on — but a picture of the
 * trade lands before the name does. Each tile is washed in one soft tint,
 * carries its glyph in a chip, and repeats that glyph oversized and faint
 * in the corner so the card reads as a shop at a glance.
 */
export function Trades() {
  return (
    <Section id="trades">
      <Heading title={TRADES.heading} sub={TRADES.sub} />

      <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-12 lg:grid-cols-5">
        {TRADES.items.map((t) => {
          const tone = TRADE_TONES[t.tone];
          return (
            <li
              key={t.name}
              className="group relative isolate overflow-hidden rounded-2xl border border-[var(--l-line)] p-5 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgba(17,24,39,0.28)]"
              style={{ backgroundColor: tone.wash }}
            >
              {/* The trade, drawn large and faint — the tile's "photo". */}
              <TradeIcon
                name={t.icon}
                size={104}
                strokeWidth={1.1}
                className="pointer-events-none absolute -right-5 -bottom-6 -z-10 opacity-[0.09] transition-opacity duration-200 group-hover:opacity-[0.16]"
                style={{ color: tone.ink }}
              />

              <span
                className="flex h-10 w-10 items-center justify-center rounded-xl"
                style={{ backgroundColor: tone.chip, color: tone.ink }}
              >
                <TradeIcon name={t.icon} size={20} />
              </span>

              <h3 className="mt-3.5 text-[16px] font-semibold">{t.name}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--l-muted)]">
                {t.line}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 text-center text-[14px] text-[var(--l-muted)]">
        {TRADES.note}
      </p>
    </Section>
  );
}
