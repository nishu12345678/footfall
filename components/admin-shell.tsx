"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { FootfallAttribution } from "@/components/footfall-attribution";

/* ---------------------------------------------------------------------------
   The internal dashboard's chrome and its small vocabulary of parts.

   Deliberately NOT components/app-shell.tsx. That shell is a max-w-xl
   column with a bottom tab bar, built for a shop owner holding a phone;
   this one is a wide page for somebody reading a funnel and a customer
   table, usually on a laptop. Sharing one shell between the two would
   have meant a width prop and a hidden nav flag, and the two would have
   drifted anyway.

   What it does keep is the product's design language — warm paper, the
   .card / .inset-group surfaces, the cobalt accent, the same type scale —
   because an internal tool that looks like a different product is one
   more thing to hold in your head. It stays responsive and accessible for
   the same reason every other screen does: the founder reads this on a
   phone at least as often as at a desk.
--------------------------------------------------------------------------- */

export function AdminShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper-2">
      <header className="sticky top-0 z-30 material hairline-b pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-4 py-3.5 sm:px-6 lg:flex-row lg:items-center lg:gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <FootfallAttribution href="/" size="compact" />
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-pin" />
                internal
              </span>
            </div>
            <h1 className="mt-0.5 truncate text-[20px] font-extrabold tracking-[-0.02em] sm:text-[22px]">
              {title}
            </h1>
            {subtitle ? (
              <div className="mt-0.5 text-[12px] leading-snug text-muted">
                {subtitle}
              </div>
            ) : null}
          </div>
          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="mx-auto w-full max-w-[1400px] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-6">
        <p className="text-[12px] leading-relaxed text-muted">
          Convex is the ledger. Anything here that disagrees with GA is
          right. Revenue is stored in paise and shown in rupees; a monthly
          run rate is not GAAP MRR — nothing on this product auto-debits.{" "}
          <Link href="/app" className="link">
            back to the app
          </Link>
        </p>
      </footer>
    </div>
  );
}

/* --------------------------------- parts --------------------------------- */

/** A titled block. `note` is for the caveat that belongs with the number. */
export function Panel({
  title,
  note,
  actions,
  children,
  className = "",
}: {
  title: string;
  note?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card overflow-hidden ${className}`}>
      <div className="hairline-b flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
            {title}
          </h2>
          {note ? (
            <div className="mt-0.5 text-[12px] leading-snug text-muted">
              {note}
            </div>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** One headline number. `hint` is the sentence that stops it being read wrong. */
export function Stat({
  label,
  value,
  hint,
  tone = "normal",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "normal" | "good" | "warn";
}) {
  const valueTone =
    tone === "good"
      ? "text-open-deep"
      : tone === "warn"
        ? "text-alert"
        : "text-ink";
  return (
    <div className="card p-4 sm:p-5">
      <p className="eyebrow">{label}</p>
      <p
        className={`mt-2 text-[clamp(1.5rem,4vw,1.9rem)] font-extrabold leading-none tracking-[-0.03em] tabular-nums ${valueTone}`}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 text-[12px] leading-snug text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * The truncation warning.
 *
 * docs/product-analytics.md: "A report hitting its safety cap must say it
 * is truncated rather than silently presenting a partial number as exact."
 * Every bounded read on this page that can hit its cap renders one of
 * these, so a lower bound is never mistaken for a total.
 */
export function Truncated({ what }: { what: string }) {
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-[12px] bg-alert-soft px-3.5 py-2.5 text-[12px] leading-snug text-alert"
    >
      <span aria-hidden className="mt-px flex-none font-bold">
        !
      </span>
      <span>
        <strong className="font-semibold">Lower bound, not a total.</strong>{" "}
        {what} hit its safety cap, so the real figure is at least this
        large.
      </span>
    </p>
  );
}

/** A small status pill. */
export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "info";
}) {
  const tones = {
    neutral: "bg-black/5 text-ink-soft",
    good: "bg-open-soft text-open-deep",
    warn: "bg-alert-soft text-alert",
    info: "bg-pin-soft text-pin",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold leading-tight ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** A quiet "nothing here yet" that does not look like a failure. */
export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="px-5 py-10 text-center text-[13px] leading-relaxed text-muted">
      {children}
    </p>
  );
}

/** Loading, at the size of the thing it is standing in for. */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2.5 px-5 py-5" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-3.5 rounded-full bg-paper-3"
          style={{ width: `${100 - i * 9}%` }}
        />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
