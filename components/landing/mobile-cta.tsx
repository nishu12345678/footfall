"use client";

import { useEffect, useState } from "react";
import { LINKS, NAV_CTA } from "@/lib/content";

/**
 * On a phone, a bar with the one button slides up once the hero's own
 * buttons have scrolled away, and hides again near the closing call so
 * it never sits on top of the same button twice.
 */
export function MobileCta() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const hero = document.getElementById("top");
    const end = document.getElementById("start");
    if (!hero || typeof IntersectionObserver === "undefined") return;

    let heroGone = false;
    let endNear = false;
    const apply = () => setOn(heroGone && !endNear);

    const a = new IntersectionObserver(
      ([e]) => {
        heroGone = !e.isIntersecting && e.boundingClientRect.bottom < 0;
        apply();
      },
      { threshold: 0 },
    );
    a.observe(hero);

    let b: IntersectionObserver | null = null;
    if (end) {
      b = new IntersectionObserver(
        ([e]) => {
          endNear = e.isIntersecting;
          apply();
        },
        { threshold: 0.1 },
      );
      b.observe(end);
    }

    return () => {
      a.disconnect();
      b?.disconnect();
    };
  }, []);

  return (
    <div
      aria-hidden={!on}
      className={`l-mobile-bar fixed inset-x-0 bottom-0 z-30 border-t border-[var(--l-line)] bg-white/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-sm md:hidden ${
        on ? "is-on" : ""
      }`}
    >
      <a href={LINKS.cta} className="lb lb-primary w-full" tabIndex={on ? 0 : -1}>
        {NAV_CTA.primary}
      </a>
    </div>
  );
}
