import { LINKS, REPORT } from "@/lib/content";
import { Icon, type IconName } from "./icons";
import { Shot } from "./shot";
import { Section } from "./ui";

/* Which icon stands for each check in the report. */
const CHECK_ICON: Record<string, IconName> = {
  Posts: "file-text",
  Reviews: "star",
  Photos: "image",
  Keywords: "search",
  "Hours & services": "clock",
  "Your website": "globe",
};

/**
 * Two columns: the argument on the left, the report on a phone on the
 * right. The six checks are the real ones the product runs.
 */
export function Report() {
  return (
    <Section id="report">
      <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
        <div>
          <p className="l-pill bg-[#e6f7ec] text-[#15803d]">{REPORT.eyebrow}</p>
          <h2 className="mt-4 text-4xl md:text-[3.25rem] md:leading-[1.1]">
            {REPORT.heading}
          </h2>
          <p className="mt-5 text-lg text-[var(--l-muted)] md:text-xl">
            {REPORT.sub}
          </p>

          <ol className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] font-medium">
            {REPORT.steps.map((s, i) => (
              <li key={s} className="flex items-center gap-3">
                <span className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--l-ink)] text-[12px] font-semibold text-white">
                    {i + 1}
                  </span>
                  {s}
                </span>
                {i < REPORT.steps.length - 1 ? (
                  <span aria-hidden className="text-[#d1d5db]">
                    <Icon name="arrow-right" size={14} />
                  </span>
                ) : null}
              </li>
            ))}
          </ol>

          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {REPORT.checks.map((c) => (
              <li key={c.label} className="flex items-start gap-3">
                <span className="l-dot h-8 w-8 bg-[var(--l-wash-2)] text-[var(--l-ink)]">
                  <Icon name={CHECK_ICON[c.label] ?? "check"} size={15} />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">{c.label}</span>
                  <span className="mt-0.5 block text-[14px] leading-relaxed text-[var(--l-muted)]">
                    {c.line}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <a href={LINKS.cta} className="lb lb-primary mt-10 h-12 px-6 text-base">
            {REPORT.cta}
            <Icon name="arrow-right" />
          </a>
          <p className="mt-3 text-[14px] text-[var(--l-muted)]">{REPORT.note}</p>
        </div>

        <div>
          {/* The composite draws its own soft panel background, so the
              slot only rounds the corners — no border of its own. */}
          <div className="overflow-hidden rounded-3xl">
            <Shot name="report-composite" plain className="rounded-3xl" />
          </div>
        </div>
      </div>
    </Section>
  );
}
