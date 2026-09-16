import { WHY } from "@/lib/content";
import { Heading, Section } from "./ui";

/** Four numbers in bordered tiles, the source in small print. */
export function Why() {
  return (
    <Section id="why">
      <Heading title={WHY.heading} sub={WHY.sub} />

      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {WHY.stats.map((s) => (
          <div
            key={s.value + s.label}
            className="rounded-2xl border border-[var(--l-line)] px-8 py-9 text-center"
          >
            <p className="text-4xl font-bold tracking-tight md:text-5xl">{s.value}</p>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--l-muted)]">
              {s.label}
            </p>
            <p className="mt-3 text-[12px] font-medium uppercase tracking-wide text-[#9ca3af]">
              {s.source}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-[13px] text-[#9ca3af]">{WHY.note}</p>
    </Section>
  );
}
