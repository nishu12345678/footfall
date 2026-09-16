import { HERO, LINKS, START } from "@/lib/content";
import { Icon, WhatsAppIcon } from "./icons";
import { Section } from "./ui";

/** Final call: two doors, sign in or message a person. */
export function Start() {
  return (
    <Section id="start">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-4xl md:text-[3.5rem] md:leading-[1.05]">{START.heading}</h2>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-[var(--l-muted)] md:text-xl">
          {START.sub}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row md:gap-3">
          <a href={LINKS.cta} className="lb lb-primary lb-lg w-full sm:w-auto">
            {HERO.ctaPrimary}
            <Icon name="arrow-right" />
          </a>
          <a
            href={LINKS.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="lb lb-whatsapp lb-lg w-full sm:w-auto"
          >
            <WhatsAppIcon size={18} />
            {HERO.ctaWhatsapp}
          </a>
        </div>
        <p className="mt-5 text-[14px] text-[var(--l-muted)]">{START.note}</p>
      </div>
    </Section>
  );
}
