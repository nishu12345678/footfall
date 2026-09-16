import { TRADES } from "@/lib/content";
import { Heading, Section } from "./ui";

/**
 * Naming the trade is what makes an owner read on. Fifteen plain
 * bordered tiles, text only — the name in ink, the searches in grey.
 */
export function Trades() {
  return (
    <Section id="trades">
      <Heading title={TRADES.heading} sub={TRADES.sub} />

      <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-12 lg:grid-cols-5">
        {TRADES.items.map((t) => (
          <li
            key={t.name}
            className="rounded-2xl border border-[var(--l-line)] p-5 transition-colors hover:bg-[var(--l-wash)]"
          >
            <h3 className="text-[16px] font-semibold">{t.name}</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--l-muted)]">
              {t.line}
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-center text-[14px] text-[var(--l-muted)]">
        {TRADES.note}
      </p>
    </Section>
  );
}
