import { FOUNDER, VISION } from "@/lib/content";
import { Shot } from "./shot";
import { Section } from "./ui";

/**
 * The one place the page speaks in the first person. A photograph of
 * an owner on the left, the argument on the right, the founder signing
 * it off at the bottom.
 */
export function Vision() {
  return (
    <Section id="why-we-built-this" wash>
      <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
        <div className="overflow-hidden rounded-3xl border border-[var(--l-line)]">
          {/* The photo has to show the problem the paragraph describes: the
              owner absorbed in a social feed while the shop behind him sits
              empty. Anything cheerful here argues against the copy. See the
              'owner-wrong-screen' slot in lib/landing-images.ts. */}
          <Shot name="owner-wrong-screen" plain />
        </div>

        <div>
          <p className="l-pill bg-[var(--l-wash-2)] text-[var(--l-ink-2)]">
            {VISION.eyebrow}
          </p>
          <h2 className="mt-4 text-4xl md:text-[3rem] md:leading-[1.1]">
            {VISION.heading}
          </h2>
          <div className="mt-6 space-y-4 text-[16px] leading-relaxed text-[var(--l-ink-2)] md:text-[17px]">
            {VISION.body.map((p) => (
              <p key={p.slice(0, 32)}>{p}</p>
            ))}
          </div>
          <p className="mt-6 border-l-2 border-[var(--l-ink)] pl-4 text-[15px] leading-relaxed text-[var(--l-muted)]">
            {VISION.kicker}
          </p>

          <div className="mt-8 flex items-center gap-3">
            <span
              aria-hidden
              className="grid h-10 w-10 place-items-center rounded-full bg-[var(--l-ink)] text-[15px] font-semibold text-white"
            >
              {FOUNDER.initial}
            </span>
            <span>
              <span className="block text-[15px] font-semibold">{FOUNDER.name}</span>
              <span className="block text-[13px] text-[var(--l-muted)]">
                {FOUNDER.role}, footfall
              </span>
            </span>
          </div>
        </div>
      </div>
    </Section>
  );
}
