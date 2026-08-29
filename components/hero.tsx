import { HERO, HERO_WINDOWS, LINKS } from "@/lib/content";
import { MapPack } from "./map-pack";
import { Reveal } from "./reveal";
import { Stars, WindowCard } from "./window-card";

export function Hero() {
  const { post, review, chat } = HERO_WINDOWS;

  return (
    <section id="top" className="relative overflow-hidden px-5 pt-14 pb-20 sm:pt-20">
      {/* loose marginalia, the way the reference scatters kaomoji */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-[6%] top-24 hidden select-none font-mono text-[13px] text-muted lg:block"
      >
        {HERO.scribbles[0]}
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute right-[8%] top-32 hidden select-none font-mono text-[13px] text-star lg:block"
      >
        {HERO.scribbles[1]}
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute left-[11%] top-[52%] hidden select-none font-mono text-[13px] text-muted xl:block"
      >
        {HERO.scribbles[2]}
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute right-[10%] top-[46%] hidden select-none font-mono text-[13px] text-muted xl:block"
      >
        {HERO.scribbles[4]}
      </span>

      <div className="relative mx-auto max-w-6xl">
        <Reveal className="text-center">
          <p className="chip mx-auto">
            <span className="h-1.5 w-1.5 rounded-full bg-open" aria-hidden />
            {HERO.chip}
          </p>

          <h1 className="mt-7 text-[clamp(3.6rem,15vw,9.5rem)] leading-[0.85]">
            {HERO.headline}
          </h1>

          <p className="mx-auto mt-5 max-w-xl font-display text-[clamp(1.05rem,2.6vw,1.45rem)] font-medium leading-snug text-ink">
            {HERO.sub}
          </p>

          <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-ink-soft">
            {HERO.body}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href={LINKS.cta} className="btn btn-primary">
              <span aria-hidden>◎</span>
              {HERO.ctaPrimary}
            </a>
            <a href={LINKS.secondary} className="btn btn-ghost">
              {HERO.ctaSecondary}
            </a>
          </div>

          <p className="mt-4 font-mono text-[11px] text-muted">{HERO.support}</p>
        </Reveal>

        {/* the collage. map pack is the centrepiece; the other three windows
            are the work it does to get there. */}
        <div className="mt-16 grid items-start gap-5 lg:grid-cols-12">
          <Reveal delay={80} className="lg:col-span-4 lg:mt-10">
            <WindowCard title={post.title} className="lg:-rotate-1">
              <div className="p-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  {post.business}
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-ink">
                  {post.body}
                </p>
                <div className="mt-3 h-20 rounded-md border border-rule bg-paper-3">
                  <div className="grid h-full place-items-center font-mono text-[10px] text-muted">
                    photo from your profile
                  </div>
                </div>
                <p className="mt-3 border-t border-rule-soft pt-2.5 font-mono text-[10px] text-open">
                  ✓ {post.meta}
                </p>
              </div>
            </WindowCard>
          </Reveal>

          <Reveal delay={0} className="lg:col-span-4">
            <MapPack />
          </Reveal>

          <div className="grid gap-5 lg:col-span-4 lg:mt-6">
            <Reveal delay={160}>
              <WindowCard title={review.title} className="lg:rotate-1">
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="grid h-7 w-7 place-items-center rounded-full border border-ink bg-star/25 font-display text-[12px] font-bold"
                    >
                      p
                    </span>
                    <span>
                      <span className="block text-[13px] font-semibold">
                        {review.author}
                      </span>
                      <Stars n={review.stars} size={11} />
                    </span>
                  </div>
                  <p className="mt-2.5 text-[13px] leading-relaxed text-ink-soft">
                    “{review.text}”
                  </p>
                  <div className="mt-3 rounded-md border border-rule bg-paper-3 p-2.5">
                    <p className="font-mono text-[9px] uppercase tracking-wider text-muted">
                      owner reply
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed">
                      {review.reply}
                    </p>
                  </div>
                  <p className="mt-3 border-t border-rule-soft pt-2.5 font-mono text-[10px] text-open">
                    ✓ {review.meta}
                  </p>
                </div>
              </WindowCard>
            </Reveal>

            <Reveal delay={240}>
              <WindowCard title={chat.title}>
                <div className="space-y-2 p-4">
                  <p className="max-w-[85%] rounded-xl rounded-tl-sm border border-rule bg-paper-3 px-3 py-2 text-[13px] leading-relaxed">
                    {chat.incoming}
                  </p>
                  <p className="ml-auto max-w-[90%] rounded-xl rounded-tr-sm border border-open bg-open-soft px-3 py-2 text-[13px] leading-relaxed">
                    {chat.outgoing}
                  </p>
                  <p className="border-t border-rule-soft pt-2.5 font-mono text-[10px] text-open">
                    ✓ {chat.meta}
                  </p>
                </div>
              </WindowCard>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
