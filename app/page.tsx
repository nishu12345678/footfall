import { Does } from "@/components/does";
import { Faq } from "@/components/faq";
import { Footer } from "@/components/footer";
import { Hero } from "@/components/hero";
import { How } from "@/components/how";
import { Nav } from "@/components/nav";
import { Pricing } from "@/components/pricing";
import { Proof } from "@/components/proof";
import { Start } from "@/components/start";
import { Vision } from "@/components/vision";

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Vision />
        <How />
        <Does />
        <Proof />
        <Pricing />
        <Faq />
        <Start />
      </main>
      <Footer />
    </>
  );
}
