import type { ReactNode } from "react";

/**
 * The card everything on the page sits in.
 *
 * This used to be a mac window with red/amber/green traffic lights. That
 * is a developer's in-joke — to a salon owner it is just three dots. Now
 * it is a plain labelled card, the shape of every app they already use,
 * with the source of the thing named in the header.
 */
export function WindowCard({
  title,
  children,
  className = "",
  live = false,
}: {
  title: string;
  children: ReactNode;
  className?: string;
  /** Shows a small "live" pip, for things footfall is doing right now. */
  live?: boolean;
}) {
  return (
    <section className={`window ${className}`}>
      <header className="window-bar">
        <span className="window-title">{title}</span>
        {live ? (
          <span className="ml-auto flex flex-none items-center gap-1.5 text-[12px] font-semibold text-open">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-open"
            />
            Live
          </span>
        ) : null}
      </header>
      {children}
    </section>
  );
}

export function Stars({ n = 5, size = 15 }: { n?: number; size?: number }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 text-star"
      aria-label={`${n} out of 5 stars`}
      style={{ fontSize: size }}
    >
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} aria-hidden className={i < n ? "" : "opacity-25"}>
          ★
        </span>
      ))}
    </span>
  );
}

export function SectionHead({
  eyebrow,
  heading,
  sub,
  align = "left",
}: {
  eyebrow: string;
  heading: string;
  sub?: string;
  align?: "left" | "center";
}) {
  const centered = align === "center";
  return (
    <div className={centered ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-4 text-[clamp(2rem,4.6vw,3rem)]">{heading}</h2>
      {sub ? (
        <p className="mt-4 text-[19px] leading-relaxed text-ink-soft">{sub}</p>
      ) : null}
    </div>
  );
}
