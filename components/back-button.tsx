"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

/**
 * The way back from any screen that isn't a tab.
 *
 * Browser history first, so the owner lands exactly where they came from;
 * `fallback` when there is no history to go back to (a fresh tab, a link
 * from an email, a bookmark). Rendered as a real link to the fallback, so
 * it works before hydration and with the keyboard, and so "open in new
 * tab" does something sensible.
 *
 * Pass `onClick` to take over entirely — a screen with its own steps (the
 * sign-in code screen) goes back a step, not a page.
 */
export function BackButton({
  fallback,
  label = "Back",
  onClick,
  className = "",
}: {
  fallback: string;
  label?: string;
  onClick?: () => void;
  className?: string;
}) {
  const router = useRouter();

  function go(e: MouseEvent<HTMLAnchorElement>) {
    // Let modified clicks (new tab, etc.) behave like any link.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    if (onClick) {
      onClick();
      return;
    }
    // Only go back when we came from this site; otherwise the user would
    // be sent out of the app to whatever was open before.
    const cameFromHere =
      typeof document !== "undefined" &&
      document.referrer !== "" &&
      document.referrer.startsWith(window.location.origin);
    if (window.history.length > 1 && cameFromHere) router.back();
    else router.push(fallback);
  }

  return (
    <a
      href={fallback}
      onClick={go}
      className={`pressable inline-flex min-h-11 items-center gap-1.5 self-start rounded-full py-2 pr-3 text-[14px] font-medium text-ink-soft hover:text-ink ${className}`}
    >
      <svg
        aria-hidden
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M15 5l-7 7 7 7" />
      </svg>
      {label}
    </a>
  );
}
