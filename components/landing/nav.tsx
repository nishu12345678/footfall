"use client";

import { useEffect, useState } from "react";
import { BRAND, LINKS, NAV, NAV_CTA } from "@/lib/content";
import { Icon } from "./icons";

/**
 * Sticky white header with a hairline, wordmark left, links centre-right,
 * two buttons. On a phone the links fold into a panel under the bar.
 */
export function Nav() {
  const [open, setOpen] = useState(false);

  // Close the panel when a link is followed or the viewport grows.
  useEffect(() => {
    if (!open) return;
    const onResize = () => {
      if (window.innerWidth >= 1024) setOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open]);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[var(--l-line)] bg-white">
      <nav className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between px-6">
        <a href="#top" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-64.png"
            alt=""
            width={32}
            height={32}
            className="h-8 w-8"
          />
          <span className="text-xl font-semibold tracking-tight">{BRAND.name}</span>
        </a>

        <div className="flex items-center gap-7">
          <ul className="hidden items-center gap-7 lg:flex">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="text-[15px] font-medium text-[var(--l-ink-2)] transition-colors hover:text-[var(--l-ink)]"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3">
            <a href={LINKS.cta} className="lb lb-primary hidden lg:inline-flex">
              {NAV_CTA.primary}
              <Icon name="arrow-right" />
            </a>
            <a href={LINKS.login} className="lb lb-outline hidden lg:inline-flex">
              {NAV_CTA.login}
            </a>
            <button
              type="button"
              aria-label={open ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={open}
              aria-controls="landing-menu"
              onClick={() => setOpen((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-lg text-[var(--l-ink)] transition-colors hover:bg-[var(--l-wash-2)] lg:hidden"
            >
              <Icon name={open ? "x" : "menu"} size={20} />
            </button>
          </div>
        </div>
      </nav>

      <div
        id="landing-menu"
        hidden={!open}
        className="border-t border-[var(--l-line)] bg-white px-6 pb-6 pt-2 lg:hidden"
      >
        <ul className="divide-y divide-[var(--l-line)]">
          {NAV.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                onClick={() => setOpen(false)}
                className="block py-3.5 text-[16px] font-medium text-[var(--l-ink)]"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="mt-4 grid gap-2">
          <a href={LINKS.cta} className="lb lb-primary w-full">
            {NAV_CTA.primary}
          </a>
          <a href={LINKS.login} className="lb lb-outline w-full">
            {NAV_CTA.login}
          </a>
        </div>
      </div>
    </header>
  );
}
