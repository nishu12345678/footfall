import Image from "next/image";
import { TRADES } from "@/lib/content";
import { TradeIcon } from "./trade-icons";
import { Heading, Section } from "./ui";

/**
 * "Built for shops like yours" — a photograph per trade under a dark
 * scrim, with the trade's glyph in a small chip on top.
 *
 * Naming the trade is what makes an owner read on, but a picture of it
 * lands before the name does. Chosen from eight treatments reviewed on
 * design/landing-variants (variant B, "photo + scrim").
 *
 * Two things the scrim is doing, both load-bearing:
 *   · it holds white text at a readable contrast over photographs we do
 *     not control, which vary wildly in brightness;
 *   · it pulls fifteen unrelated images into something that reads as one
 *     set rather than a contact sheet.
 *
 * The glyph chip stays for the same reason it existed in the all-glyph
 * version: at a glance the icon says "salon" faster than a dim photo of
 * a salon does, and it is what the reader falls back on when a photo is
 * slow, missing, or ambiguous.
 */

/** Photo per trade, positionally matched to TRADES.items. */
const PHOTOS = [
  "salon",
  "clinic",
  "sari",
  "fashion",
  "kirana",
  "gym",
  "restaurant",
  "tiles",
  "coaching",
  "repairs",
  "sweets",
  "mobile",
  "jewellers",
  "chemist",
  "tailor",
] as const;

/* Five across at desktop, two at tablet, one on a phone — so the browser
   never downloads a 900px file to paint a 240px tile. */
const SIZES = "(min-width:1024px) 240px, (min-width:640px) 45vw, 90vw";

export function Trades() {
  return (
    <Section id="trades">
      <Heading title={TRADES.heading} sub={TRADES.sub} />

      <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-12 lg:grid-cols-5">
        {TRADES.items.map((t, i) => (
          <li
            key={t.name}
            className="group relative flex min-h-[208px] items-end overflow-hidden rounded-2xl transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgba(17,24,39,0.28)]"
          >
            <Image
              src={`/trades/${PHOTOS[i]}.jpg`}
              alt=""
              fill
              sizes={SIZES}
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />

            {/* Dark at the foot where the words sit, clearing towards the
                top so the photograph is still legible as a picture. */}
            <span
              aria-hidden
              className="absolute inset-0 bg-[linear-gradient(to_top,rgba(6,10,18,.92)_8%,rgba(6,10,18,.55)_46%,rgba(6,10,18,.12)_100%)]"
            />

            <span
              aria-hidden
              className="absolute left-3.5 top-3.5 flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-white/30 bg-white/20 text-white backdrop-blur"
            >
              <TradeIcon name={t.icon} size={18} strokeWidth={1.9} />
            </span>

            <span className="relative p-4 pb-[17px]">
              <h3 className="text-[16px] font-semibold text-white">{t.name}</h3>
              <p className="mt-1.5 text-[13.5px] leading-snug text-white/80">
                {t.line}
              </p>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-center text-[14px] text-[var(--l-muted)]">
        {TRADES.note}
      </p>
    </Section>
  );
}
