import { HERO, HERO_WINDOWS, LINKS } from "@/lib/content";
import { MapPack } from "./map-pack";
import { Reveal } from "./reveal";
import { Stars, WindowCard } from "./window-card";

export function Hero() {
  const { post, review, chat } = HERO_WINDOWS;

  return (
    <section
      id="top"
      className="relative overflow-hidden bg-gradient-to-b from-paper-2/60 to-transparent px-6 pt-20 pb-24 sm:px-10 sm:pt-28 sm:pb-32 lg:px-16"
    >
      <div className="relative mx-auto max-w-[1400px]">
        <Reveal className="text-center">
          <p className="chip mx-auto">
            <span className="h-2 w-2 rounded-full bg-open" aria-hidden />
            {HERO.chip}
          </p>

          {/* The headline is the promise, not the brand name. Nobody
              searching for more customers is looking for a wordmark. */}
          <h1 className="mx-auto mt-8 max-w-5xl text-[clamp(3rem,7.5vw,6rem)]">
            {HERO.headline}
          </h1>

          <p className="mx-auto mt-8 max-w-2xl text-[clamp(1.15rem,2.2vw,1.45rem)] leading-relaxed text-ink-soft">
            {HERO.sub}
          </p>

          <div className="mt-10 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:items-center">
            <a href={LINKS.cta} className="btn btn-primary">
              {HERO.ctaPrimary}
            </a>
            <a
              href={LINKS.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-whatsapp"
            >
              {HERO.ctaWhatsapp}
            </a>
          </div>

          <p className="mt-6 text-[15px] text-muted">{HERO.support}</p>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {HERO.trust.map((item) => (
              <li
                key={item}
                className="flex items-center gap-2 text-[15px] font-medium text-ink-soft"
              >
                <span aria-hidden className="text-open">
                  ✓
                </span>
                {item}
              </li>
            ))}
          </ul>
        </Reveal>

        {/* The map pack is the centrepiece — it is the entire promise in
            one picture. The other two cards are the work that gets there. */}
        <div className="mt-20 grid items-start gap-6 lg:mt-24 lg:grid-cols-12 lg:gap-8">
          <Reveal delay={80} className="lg:col-span-4 lg:mt-10">
            <WindowCard title={post.title} live>
              <div className="p-6">
                <p className="text-[13px] font-medium text-muted">
                  {post.business}
                </p>
                <p className="mt-2 text-[16px] leading-relaxed text-ink">
                  {post.body}
                </p>
                <div className="mt-3 h-24 rounded-[12px] bg-paper-2">
                  <div className="grid h-full place-items-center text-[13px] text-muted">
                    Photo from your profile
                  </div>
                </div>
                <p className="mt-4 border-t border-rule-soft pt-3 text-[13px] font-medium text-open">
                  ✓ {post.meta}
                </p>
              </div>
            </WindowCard>
          </Reveal>

          <Reveal delay={0} className="lg:col-span-4">
            <MapPack />
          </Reveal>

          <div className="grid gap-6 lg:col-span-4 lg:mt-6 lg:gap-8">
            <Reveal delay={160}>
              <WindowCard title={review.title}>
                <div className="p-6">
                  <div className="flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className="grid h-9 w-9 place-items-center rounded-full bg-star/20 text-[15px] font-bold text-ink"
                    >
                      P
                    </span>
                    <span>
                      <span className="block text-[15px] font-semibold">
                        {review.author}
                      </span>
                      <Stars n={review.stars} size={13} />
                    </span>
                  </div>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                    “{review.text}”
                  </p>
                  <div className="mt-3 rounded-[12px] bg-paper-2 p-3">
                    <p className="text-[13px] font-medium text-muted">
                      Owner reply
                    </p>
                    <p className="mt-1 text-[15px] leading-relaxed">
                      {review.reply}
                    </p>
                  </div>
                  <p className="mt-4 border-t border-rule-soft pt-3 text-[13px] font-medium text-open">
                    ✓ {review.meta}
                  </p>
                </div>
              </WindowCard>
            </Reveal>

            <Reveal delay={240}>
              <WindowCard title={chat.title}>
                <div className="space-y-2.5 p-6">
                  <p className="max-w-[88%] rounded-[18px] rounded-tl-sm bg-paper-3 px-3.5 py-2.5 text-[15px] leading-relaxed text-ink">
                    {chat.incoming}
                  </p>
                  <p className="ml-auto max-w-[92%] rounded-[18px] rounded-tr-sm bg-open px-3.5 py-2.5 text-[15px] leading-relaxed text-white">
                    {chat.outgoing}
                  </p>
                  <p className="border-t border-rule-soft pt-3 text-[13px] font-medium text-open">
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
