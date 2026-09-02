import { Does } from "@/components/does";
import { Faq } from "@/components/faq";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { How } from "@/components/how";
import { Nav } from "@/components/nav";
import { Pricing } from "@/components/pricing";
import { Proof } from "@/components/proof";
import { Start } from "@/components/start";
import { Trades, TrustBar } from "@/components/trades";
import { Vision } from "@/components/vision";

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        {/* Reassurance, then "this is for you", before any argument.
            An owner decides whether the page is talking to them long
            before they reach the reasoning. */}
        <TrustBar />
        <Trades />
        <How />
        <Does />
        <Vision />
        <Proof />
        <Pricing />
        <Faq />
        <Start />
      </main>
      <Footer />
    </>
  );
}
