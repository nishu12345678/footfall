import { FOUNDER, VISION } from "@/lib/content";
import { Reveal } from "./reveal";
import { WindowCard } from "./window-card";

export function Vision() {
  return (
    <section className="border-y border-rule bg-paper-2 px-5 py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-2 lg:gap-16">
        <Reveal>
          <p className="eyebrow">
            <span className="inline-block h-px w-6 bg-rule" aria-hidden />
            {VISION.eyebrow}
          </p>
          <h2 className="mt-4 text-[clamp(2rem,5.4vw,3.4rem)]">
            {VISION.heading}
          </h2>

          <div className="mt-6 space-y-4 text-[18px] leading-relaxed text-ink-soft">
            {VISION.body.map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>

          <p className="mt-6 border-l-2 border-pin pl-4 text-[17px] leading-relaxed text-ink">
            {VISION.kicker}
          </p>

          {/* founder block, same shape as the reference */}
          <div className="mt-8 flex items-center gap-3">
            {FOUNDER.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={FOUNDER.photo}
                alt={FOUNDER.name}
                className="h-11 w-11 rounded-full border border-rule object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="grid h-11 w-11 place-items-center rounded-full border border-rule bg-star/25 font-display text-[19px] font-bold"
              >
                {FOUNDER.initial}
              </span>
            )}
            <span>
              <span className="block font-display text-[17px] font-bold">
                {FOUNDER.name}, {FOUNDER.role}
              </span>
              <a
                href={FOUNDER.href}
                className="font-mono text-[13px] text-muted underline underline-offset-4 hover:text-pin"
              >
                {FOUNDER.handle}
              </a>
            </span>
          </div>
        </Reveal>

        {/* the argument, as two windows side by side */}
        <div className="grid content-start gap-5 sm:grid-cols-2 lg:mt-16">
          <Reveal delay={80}>
            <WindowCard title="Agency report · this month" className="sm:-rotate-1">
              <div className="p-4">
                <dl className="space-y-2.5">
                  {[
                    ["Reach", "12,400"],
                    ["Likes", "89"],
                    ["Posts made", "6"],
                    ["You paid", "₹12,000"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-baseline justify-between gap-3">
                      <dt className="font-mono text-[13px] text-muted">{k}</dt>
                      <dd className="font-display text-[17px] font-bold">{v}</dd>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between gap-3 border-t border-rule-soft pt-2.5">
                    <dt className="font-mono text-[13px] text-pin">
                      People who walked in
                    </dt>
                    <dd className="font-display text-[17px] font-bold text-pin">
                      Unknown
                    </dd>
                  </div>
                </dl>
              </div>
            </WindowCard>
          </Reveal>

          <Reveal delay={160}>
            <WindowCard title="Your Google listing · right now" className="sm:mt-8 sm:rotate-1">
              <div className="p-4">
                <ul className="space-y-2.5">
                  {[
                    "Last post — 8 months ago",
                    "3 reviews unanswered",
                    "Closing time is wrong",
                    "No services listed",
                    "2 enquiries went cold this week",
                  ].map((line) => (
                    <li
                      key={line}
                      className="flex items-start gap-2 text-[15px] leading-snug text-ink-soft"
                    >
                      <span className="mt-0.5 flex-none font-mono text-[13px] text-pin" aria-hidden>
                        ✕
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 border-t border-rule-soft pt-2.5 font-mono text-[12px] text-muted">
                  This is the screen people actually search
                </p>
              </div>
            </WindowCard>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
