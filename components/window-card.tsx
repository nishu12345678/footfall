import type { ReactNode } from "react";

/**
 * The mac-window frame the whole page is built out of.
 * Everything inside one of these is a google-listing artifact.
 */
export function WindowCard({
  title,
  children,
  className = "",
  tone = "paper",
}: {
  title: string;
  children: ReactNode;
  className?: string;
  tone?: "paper" | "ink";
}) {
  const dots =
    tone === "ink"
      ? ["bg-pin", "bg-star", "bg-open"]
      : ["bg-pin", "bg-star", "bg-open"];

  return (
    <section className={`window ${className}`}>
      <header className="window-bar">
        <span className="flex items-center gap-1.5">
          {dots.map((c, i) => (
            <span key={i} className={`window-dot ${c}`} aria-hidden />
          ))}
        </span>
        <span className="window-title">{title}</span>
      </header>
      {children}
    </section>
  );
}

export function Stars({ n = 5, size = 13 }: { n?: number; size?: number }) {
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
    <div className={centered ? "text-center mx-auto max-w-2xl" : "max-w-2xl"}>
      <p className="eyebrow">
        <span className="inline-block h-px w-6 bg-rule" aria-hidden />
        {eyebrow}
      </p>
      <h2 className="mt-4 text-[clamp(2rem,5.4vw,3.4rem)]">{heading}</h2>
      {sub ? (
        <p className="mt-4 text-[17px] leading-relaxed text-ink-soft">{sub}</p>
      ) : null}
    </div>
  );
}
