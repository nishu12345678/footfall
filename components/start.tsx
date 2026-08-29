import { LINKS } from "@/lib/content";
import { Reveal } from "./reveal";

/**
 * Final call to action.
 *
 * Both buttons point somewhere real today (whatsapp + email) so nothing on
 * the page is a dead end. When the M1 connect flow ships, point the primary
 * button at it in lib/content.ts → LINKS.cta.
 */
export function Start() {
  return (
    <section
      id="start"
      className="border-y border-rule bg-paper-2 px-5 py-20 sm:py-28"
    >
      <div className="mx-auto max-w-2xl text-center">
        <Reveal>
          <p className="eyebrow justify-center">
            <span className="inline-block h-px w-6 bg-rule" aria-hidden />
            start here
            <span className="inline-block h-px w-6 bg-rule" aria-hidden />
          </p>

          <h2 className="mt-5 text-[clamp(2.2rem,6.5vw,4rem)]">
            let&rsquo;s look at your listing together
          </h2>

          <p className="mx-auto mt-5 max-w-lg text-[16px] leading-relaxed text-ink-soft">
            send us your business name and area. we&rsquo;ll pull up your google
            listing, tell you exactly what&rsquo;s broken on it, and fix the
            first three things for free — today, while you watch.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href={LINKS.cta} className="btn btn-primary">
              <span aria-hidden>◎</span>
              check my listing — free
            </a>
            <a href={LINKS.support} className="btn btn-ghost">
              email us instead
            </a>
          </div>

          <p className="mt-4 font-mono text-[11px] text-muted">
            no card. no call booking. no 40-minute demo.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
