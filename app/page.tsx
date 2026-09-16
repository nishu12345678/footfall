import { DM_Sans } from "next/font/google";
import { Does } from "@/components/landing/does";
import { Faq } from "@/components/landing/faq";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { How } from "@/components/landing/how";
import { MobileCta } from "@/components/landing/mobile-cta";
import { Nav } from "@/components/landing/nav";
import { Pricing } from "@/components/landing/pricing";
import { Proof } from "@/components/landing/proof";
import { Report } from "@/components/landing/report";
import { Start } from "@/components/landing/start";
import { Vision } from "@/components/landing/vision";
import {
  HERO_VARIANTS,
  HERO_VARIANT_NAMES,
} from "@/components/landing/variants/hero-variants";
import {
  TRADES_VARIANTS,
  TradesDuotone,
  TradesGlyphTint,
  TradesMono,
  TradesPhotoAvatar,
  TradesPhotoBand,
  TradesPhotoScrim,
  TradesSolidChip,
  TradesWatermark,
} from "@/components/landing/variants/trades-variants";
import {
  VariantProvider,
  VariantSwitch,
} from "@/components/landing/variants/variant-shell";
import { Why } from "@/components/landing/why";

/*
 * DM Sans for the marketing page only. The app keeps Manrope; fonts from
 * next/font are scoped to wherever their className lands, and this one
 * lands on the .landing wrapper (see globals.css).
 */
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

export default function Page() {
  return (
    <VariantProvider>
    <div className={`landing ${dmSans.variable} min-h-dvh overflow-x-clip`}>
      <Nav />
      <main>
        {/* Design-review harness — this branch only. Each switch renders one
            of several treatments; the floating button hides the controls so
            the page can be judged clean. See variants/variant-shell.tsx. */}
        <VariantSwitch id="hero" label="Headline" names={HERO_VARIANT_NAMES}>
          {HERO_VARIANTS.map((v) => (
            <Hero
              key={v.name}
              headline={v.headline}
              tagline={v.tagline}
              sub={v.sub}
            />
          ))}
        </VariantSwitch>
        {/* "This is for you" before any argument. An owner decides whether
            the page is talking to them long before they reach the reasoning. */}
        <VariantSwitch id="trades" label="Trades" names={TRADES_VARIANTS}>
          <TradesGlyphTint />
          <TradesPhotoScrim />
          <TradesPhotoBand />
          <TradesPhotoAvatar />
          <TradesDuotone />
          <TradesSolidChip />
          <TradesMono />
          <TradesWatermark />
        </VariantSwitch>
        {/* The free report is the cheapest yes on the page, so it comes
            before anything about price. */}
        <Report />
        <How />
        <Does />
        <Why />
        <Vision />
        <Proof />
        <Pricing />
        <Faq />
        <Start />
      </main>
      <Footer />
      <MobileCta />
    </div>
    </VariantProvider>
  );
}
