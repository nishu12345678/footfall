import { HERO, HERO_WINDOWS, LINKS } from "@/lib/content";
import { MapPack } from "./map-pack";
import { Reveal } from "./reveal";
import { Stars, WindowCard } from "./window-card";

export function Hero() {
  const { post, review, chat } = HERO_WINDOWS;

  return (
    <section
      id="top"
      className="relative overflow-hidden bg-gradient-to-b from-paper-2 to-white px-5 pt-14 pb-20 sm:pt-20"
    >
      <div className="relative mx-auto max-w-6xl">
        <Reveal className="text-center">
          <p className="chip mx-auto">
            <span className="h-2 w-2 rounded-full bg-open" aria-hidden />
            {HERO.chip}
          </p>

          {/* The headline is the promise, not the brand name. Nobody
              searching for more customers is looking for a wordmark. */}
          <h1 className="mx-auto mt-6 max-w-4xl text-[clamp(2.3rem,6vw,4rem)]">
            {HERO.headline}
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-[clamp(1.05rem,2.2vw,1.3rem)] leading-relaxed text-ink-soft">
            {HERO.sub}
          </p>

          <div className="mt-9 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
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

          <p className="mt-5 text-[15px] text-muted">{HERO.support}</p>

          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
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
        <div className="mt-16 grid items-start gap-5 lg:grid-cols-12">
          <Reveal delay={80} className="lg:col-span-4 lg:mt-10">
            <WindowCard title={post.title} live>
              <div className="p-5">
                <p className="text-[13px] font-semibold uppercase tracking-wider text-muted">
                  {post.business}
                </p>
                <p className="mt-2 text-[16px] leading-relaxed text-ink">
                  {post.body}
                </p>
                <div className="mt-3 h-24 rounded-lg border border-rule bg-paper-2">
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

          <div className="grid gap-5 lg:col-span-4 lg:mt-6">
            <Reveal delay={160}>
              <WindowCard title={review.title}>
                <div className="p-5">
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
                  <div className="mt-3 rounded-lg border border-rule bg-paper-2 p-3">
                    <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">
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
                <div className="space-y-2 p-5">
                  <p className="max-w-[88%] rounded-2xl rounded-tl-sm bg-paper-3 px-3.5 py-2.5 text-[15px] leading-relaxed">
                    {chat.incoming}
                  </p>
                  <p className="ml-auto max-w-[92%] rounded-2xl rounded-tr-sm bg-open-soft px-3.5 py-2.5 text-[15px] leading-relaxed">
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
