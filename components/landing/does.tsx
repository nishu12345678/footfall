import { DOES } from "@/lib/content";
import { Icon, type IconName } from "./icons";
import { Shot } from "./shot";
import { Heading, Section } from "./ui";
import type { ShotKey } from "@/lib/landing-images";

/* The two jobs that photograph well get the big cards with a picture
   flush at the bottom; the other three get compact cards. */
const BIG: Record<string, ShotKey> = {
  Posts: "feature-posts",
  Reviews: "feature-reviews",
};

const SMALL_ICON: Record<string, IconName> = {
  Keywords: "search",
  Photos: "image",
  Website: "globe",
};

export function Does() {
  const big = DOES.items.filter((it) => it.tag in BIG);
  const small = DOES.items.filter((it) => !(it.tag in BIG));

  return (
    <Section id="does">
      <Heading title={DOES.heading} sub={DOES.sub} />

      <div className="mt-12 grid gap-6 md:mt-14 md:grid-cols-2">
        {big.map((it) => (
          <article
            key={it.tag}
            className="flex flex-col overflow-hidden rounded-3xl border border-[var(--l-line)]"
          >
            <div className="px-8 pt-8 md:px-10 md:pt-10">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-[var(--l-muted)]">
                {it.tag}
              </p>
              <h3 className="mt-2 text-2xl font-bold">{it.title}</h3>
              <p className="mt-4 text-[15px] leading-relaxed text-[var(--l-muted)]">
                {it.body}
              </p>
              <p className="mt-3 text-[13px] font-medium text-[var(--l-ink-2)]">
                {it.detail}
              </p>
            </div>
            <div className="mt-auto px-8 pt-8 md:px-10">
              <div className="overflow-hidden rounded-t-xl border border-b-0 border-[var(--l-line)]">
                <Shot name={BIG[it.tag]} plain />
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        {small.map((it) => (
          <article
            key={it.tag}
            className="rounded-3xl border border-[var(--l-line)] p-8"
          >
            <span className="l-dot bg-[var(--l-wash-2)] text-[var(--l-ink)]">
              <Icon name={SMALL_ICON[it.tag] ?? "check"} />
            </span>
            <p className="mt-5 text-[13px] font-semibold uppercase tracking-wide text-[var(--l-muted)]">
              {it.tag}
            </p>
            <h3 className="mt-2 text-xl font-bold">{it.title}</h3>
            <p className="mt-3 text-[15px] leading-relaxed text-[var(--l-muted)]">
              {it.body}
            </p>
            <p className="mt-3 text-[13px] font-medium text-[var(--l-ink-2)]">
              {it.detail}
            </p>
          </article>
        ))}
      </div>
    </Section>
  );
}
