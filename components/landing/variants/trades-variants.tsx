import Image from "next/image";
import type { ReactNode } from "react";
import { TRADES } from "@/lib/content";
import { TRADE_TONES, TradeIcon } from "../trade-icons";
import { Heading, Section } from "../ui";

/* ---------------------------------------------------------------------------
   Eight treatments of "Built for shops like yours", for side-by-side review.
   Variant A is the one actually shipped on fix/small-fixes; the rest exist to
   argue against it. Delete this file once a winner is picked.

   B–E use real photographs. The set in public/variants/trades is Creative-
   Commons filler pulled from Openverse to prove the LAYOUT only — it clashes
   badly on purpose (sepia, black-and-white, a product shot for "Mobile",
   empty shelves for "Kirana"). Judge the treatment, not the pictures.
--------------------------------------------------------------------------- */

/** Photo file per trade, in the same order as TRADES.items. */
const PHOTOS = [
  "salon", "clinic", "sari", "fashion", "kirana", "gym", "restaurant", "tiles",
  "coaching", "repairs", "sweets", "mobile", "jewellers", "chemist", "tailor",
] as const;

const SIZES = "(min-width:1024px) 240px, (min-width:640px) 45vw, 90vw";

function photo(i: number) {
  return `/variants/trades/${PHOTOS[i]}.jpg`;
}

/** The heading, grid and footnote every variant shares. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <Section id="trades">
      <Heading title={TRADES.heading} sub={TRADES.sub} />
      <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 md:mt-12 lg:grid-cols-5">
        {children}
      </ul>
      <p className="mt-6 text-center text-[14px] text-[var(--l-muted)]">
        {TRADES.note}
      </p>
    </Section>
  );
}

const items = TRADES.items;

/* ------------------------------ A — shipped ------------------------------ */
export function TradesGlyphTint() {
  return (
    <Frame>
      {items.map((t) => {
        const tone = TRADE_TONES[t.tone];
        return (
          <li
            key={t.name}
            className="group relative isolate overflow-hidden rounded-2xl border border-[var(--l-line)] p-5 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-14px_rgba(17,24,39,0.28)]"
            style={{ backgroundColor: tone.wash }}
          >
            <TradeIcon
              name={t.icon}
              size={104}
              strokeWidth={1.1}
              className="pointer-events-none absolute -right-5 -bottom-6 -z-10 opacity-[0.09] transition-opacity duration-200 group-hover:opacity-[0.16]"
              style={{ color: tone.ink }}
            />
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: tone.chip, color: tone.ink }}
            >
              <TradeIcon name={t.icon} size={20} />
            </span>
            <h3 className="mt-3.5 text-[16px] font-semibold">{t.name}</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--l-muted)]">
              {t.line}
            </p>
          </li>
        );
      })}
    </Frame>
  );
}

/* --------------------------- B — photo + scrim --------------------------- */
export function TradesPhotoScrim() {
  return (
    <Frame>
      {items.map((t, i) => (
        <li
          key={t.name}
          className="relative flex min-h-[208px] items-end overflow-hidden rounded-2xl"
        >
          <Image
            src={photo(i)}
            alt=""
            fill
            sizes={SIZES}
            className="object-cover"
          />
          <span className="absolute inset-0 bg-[linear-gradient(to_top,rgba(6,10,18,.92)_8%,rgba(6,10,18,.55)_46%,rgba(6,10,18,.12)_100%)]" />
          <span className="absolute left-3.5 top-3.5 flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-white/30 bg-white/20 text-white backdrop-blur">
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
    </Frame>
  );
}

/* -------------------------- C — photo header band ------------------------ */
export function TradesPhotoBand() {
  return (
    <Frame>
      {items.map((t, i) => {
        const tone = TRADE_TONES[t.tone];
        return (
          <li
            key={t.name}
            className="flex flex-col overflow-hidden rounded-2xl border border-[var(--l-line)] bg-white"
          >
            <span className="relative block h-[104px] overflow-hidden">
              <Image
                src={photo(i)}
                alt=""
                fill
                sizes={SIZES}
                className="object-cover"
              />
            </span>
            <span className="block px-[18px] pb-[18px]">
              <span
                className="-mt-5 flex h-11 w-11 items-center justify-center rounded-[14px] border-[3px] border-white"
                style={{ backgroundColor: tone.chip, color: tone.ink }}
              >
                <TradeIcon name={t.icon} size={20} />
              </span>
              <h3 className="mt-3 text-[16px] font-semibold">{t.name}</h3>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--l-muted)]">
                {t.line}
              </p>
            </span>
          </li>
        );
      })}
    </Frame>
  );
}

/* ---------------------------- D — round avatar --------------------------- */
export function TradesPhotoAvatar() {
  return (
    <Frame>
      {items.map((t, i) => {
        const tone = TRADE_TONES[t.tone];
        return (
          <li
            key={t.name}
            className="rounded-2xl border border-[var(--l-line)] bg-white p-5"
          >
            <span className="relative block h-[60px] w-[60px]">
              <Image
                src={photo(i)}
                alt=""
                width={60}
                height={60}
                className="h-[60px] w-[60px] rounded-full object-cover"
              />
              <span
                className="absolute -bottom-[3px] -right-[3px] flex h-6 w-6 items-center justify-center rounded-full border-2 border-white"
                style={{ backgroundColor: tone.chip, color: tone.ink }}
              >
                <TradeIcon name={t.icon} size={13} strokeWidth={2} />
              </span>
            </span>
            <h3 className="mt-3.5 text-[16px] font-semibold">{t.name}</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--l-muted)]">
              {t.line}
            </p>
          </li>
        );
      })}
    </Frame>
  );
}

/* ------------------------------ E — duotone ------------------------------ */
export function TradesDuotone() {
  return (
    <Frame>
      {items.map((t, i) => {
        const tone = TRADE_TONES[t.tone];
        return (
          <li
            key={t.name}
            className="overflow-hidden rounded-2xl border border-[var(--l-line)] pb-[18px]"
            style={{ backgroundColor: tone.wash }}
          >
            <span className="relative block h-24 overflow-hidden isolate">
              <Image
                src={photo(i)}
                alt=""
                fill
                sizes={SIZES}
                className="object-cover"
                style={{ filter: "grayscale(1) brightness(2.05) contrast(.72)" }}
              />
              <span
                className="absolute inset-0"
                style={{ backgroundColor: tone.ink, mixBlendMode: "multiply" }}
              />
            </span>
            <span
              className="-mt-5 ml-[18px] flex h-11 w-11 items-center justify-center rounded-[14px] border-[3px] border-white"
              style={{ backgroundColor: tone.chip, color: tone.ink }}
            >
              <TradeIcon name={t.icon} size={20} />
            </span>
            <h3 className="mx-[18px] mt-3 text-[16px] font-semibold">{t.name}</h3>
            <p className="mx-[18px] mt-1.5 text-[13.5px] leading-relaxed text-[var(--l-muted)]">
              {t.line}
            </p>
          </li>
        );
      })}
    </Frame>
  );
}

/* --------------------------- F — solid colour ---------------------------- */
export function TradesSolidChip() {
  return (
    <Frame>
      {items.map((t) => {
        const tone = TRADE_TONES[t.tone];
        return (
          <li
            key={t.name}
            className="rounded-2xl border border-[var(--l-line)] bg-white p-5 transition-shadow duration-200 hover:shadow-[0_10px_28px_-16px_rgba(17,24,39,.3)]"
          >
            <span
              className="flex h-11 w-11 items-center justify-center rounded-[13px] text-white"
              style={{ backgroundColor: tone.ink }}
            >
              <TradeIcon name={t.icon} size={22} strokeWidth={1.7} />
            </span>
            <h3 className="mt-3.5 text-[16px] font-semibold">{t.name}</h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--l-muted)]">
              {t.line}
            </p>
          </li>
        );
      })}
    </Frame>
  );
}

/* ---------------------------- G — monochrome ----------------------------- */
export function TradesMono() {
  return (
    <Frame>
      {items.map((t) => (
        <li
          key={t.name}
          className="rounded-2xl border border-[var(--l-line)] bg-white p-5 transition-colors hover:bg-[var(--l-wash)]"
        >
          <span className="block leading-[0] text-[var(--l-ink)]">
            <TradeIcon name={t.icon} size={24} strokeWidth={1.6} />
          </span>
          <h3 className="mt-3.5 text-[16px] font-semibold">{t.name}</h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--l-muted)]">
            {t.line}
          </p>
        </li>
      ))}
    </Frame>
  );
}

/* ------------------------- H — oversized watermark ----------------------- */
export function TradesWatermark() {
  return (
    <Frame>
      {items.map((t) => {
        const tone = TRADE_TONES[t.tone];
        return (
          <li
            key={t.name}
            className="relative isolate min-h-[150px] overflow-hidden rounded-2xl border border-[var(--l-line)] p-5"
            style={{ backgroundColor: tone.wash }}
          >
            <TradeIcon
              name={t.icon}
              size={132}
              strokeWidth={1}
              className="pointer-events-none absolute -right-[30px] -top-[22px] -z-10 opacity-[0.13]"
              style={{ color: tone.ink }}
            />
            <h3
              className="text-[16px] font-semibold"
              style={{ color: tone.ink }}
            >
              {t.name}
            </h3>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--l-muted)]">
              {t.line}
            </p>
          </li>
        );
      })}
    </Frame>
  );
}

/** Order and labels shown in the switcher pill. */
export const TRADES_VARIANTS = [
  "A · glyph + tint (shipped)",
  "B · photo + scrim",
  "C · photo band",
  "D · round avatar",
  "E · duotone photo",
  "F · solid colour chip",
  "G · monochrome",
  "H · big watermark",
];
