import { HOW, LINKS, REPORT, STEPS } from "@/lib/content";
import { Icon, type IconName } from "./icons";
import { Shot } from "./shot";
import { Bullet, Section } from "./ui";

const STEP_ICON: IconName[] = ["log-in", "zap", "users"];
const STEP_TONE = ["blue", "green", "amber"] as const;

/**
 * Picture on the left this time so the page alternates. The three steps
 * are the whole story of the product from the owner's chair.
 */
export function How() {
  return (
    <Section id="how" wash>
      <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
        <div className="order-2 md:order-1">
          <Shot name="whatsapp-approval" />
        </div>

        <div className="order-1 md:order-2">
          <h2 className="text-4xl md:text-[3.25rem] md:leading-[1.1]">
            {HOW.heading}
          </h2>
          <p className="mt-5 text-lg text-[var(--l-muted)] md:text-xl">
            {HOW.sub}
          </p>

          <div className="mt-9 flex flex-col gap-7">
            {STEPS.map((s, i) => (
              <Bullet
                key={s.n}
                icon={STEP_ICON[i]}
                tone={STEP_TONE[i]}
                title={`${s.title} · ${s.time}`}
              >
                {s.body}
              </Bullet>
            ))}
          </div>

          <a href={LINKS.cta} className="lb lb-primary mt-10 h-12 px-6 text-base">
            {REPORT.cta}
            <Icon name="arrow-right" />
          </a>
        </div>
      </div>
    </Section>
  );
}
