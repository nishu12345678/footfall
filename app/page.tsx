import { DM_Sans, Noto_Sans_Devanagari } from "next/font/google";
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
import { Trades } from "@/components/landing/trades";
import { Vision } from "@/components/landing/vision";
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

/*
 * DM Sans has no Devanagari glyphs at all, so the Hindi headline would drop
 * to whatever the OS happens to have — a different face on every machine,
 * and usually a much heavier one.
 *
 * This sits second in the font stack rather than behind a class. A browser
 * picks a font per character, so Latin still gets DM Sans and only the
 * Devanagari falls through to Noto. Mixed Hinglish in one sentence —
 * "हम Google से ग्राहक लाएँगे" — comes out right with no markup.
 */
const devanagari = Noto_Sans_Devanagari({
  variable: "--font-devanagari",
  subsets: ["devanagari"],
  display: "swap",
});

export default function Page() {
  return (
    <div
      className={`landing ${dmSans.variable} ${devanagari.variable} min-h-dvh overflow-x-clip`}
    >
      <Nav />
      <main>
        <Hero />
        {/* "This is for you" before any argument. An owner decides whether
            the page is talking to them long before they reach the reasoning. */}
        <Trades />
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
  );
}
