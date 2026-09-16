"use client";

import { useState } from "react";
import { FAQ } from "@/lib/content";
import { Icon } from "./icons";
import { Heading, Section } from "./ui";

const FIRST = 6;

/**
 * One bordered box, native <details> rows, the first six shown and a
 * small button for the rest. Works without JavaScript for the six.
 */
export function Faq() {
  const [all, setAll] = useState(false);
  const items = all ? FAQ.items : FAQ.items.slice(0, FIRST);

  return (
    <Section id="faq">
      <Heading title={FAQ.heading} sub={FAQ.sub} />

      <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-2xl border border-[var(--l-line)]">
        {items.map((item, i) => (
          <details
            key={item.q}
            className={i < items.length - 1 ? "border-b border-[var(--l-line)]" : ""}
          >
            <summary className="flex w-full cursor-pointer items-center justify-between gap-6 px-6 py-5 text-left transition-colors hover:bg-[var(--l-wash)] md:px-8">
              <span className="text-base font-medium md:text-lg">{item.q}</span>
              <span className="l-chev flex-none text-[var(--l-muted)]">
                <Icon name="chevron-down" size={18} />
              </span>
            </summary>
            <p className="px-6 pb-6 text-[15px] leading-relaxed text-[var(--l-muted)] md:px-8 md:text-base">
              {item.a}
            </p>
          </details>
        ))}
      </div>

      {FAQ.items.length > FIRST ? (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setAll((v) => !v)}
            className="lb h-9 border-[#e5e7eb] bg-white px-3 text-sm font-medium shadow-[inset_0_1px_0_0_rgba(255,255,255,1),0_1px_3px_0_rgba(15,23,42,0.06)] hover:bg-[var(--l-wash)]"
          >
            {all ? "Show fewer questions" : "Show more questions"}
          </button>
        </div>
      ) : null}
    </Section>
  );
}
