"use client";

import { useEffect, useRef, useState } from "react";
import { MAP_PACK } from "@/lib/content";
import { Stars, WindowCard } from "./window-card";

type Row = {
  name: string;
  rating: number;
  reviews: number;
  distance: string;
  you?: boolean;
};

/**
 * The page's signature element.
 * The whole product promise is "you move into the top three" — so the page
 * shows exactly that, once, when it scrolls into view.
 */
export function MapPack({ className = "" }: { className?: string }) {
  const [after, setAfter] = useState(false);
  const [touched, setTouched] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || touched) return;
    if (typeof IntersectionObserver === "undefined") {
      setAfter(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.disconnect();
          window.setTimeout(() => setAfter(true), 1100);
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [touched]);

  const rows: Row[] = after ? MAP_PACK.after : MAP_PACK.before;

  const pick = (next: boolean) => {
    setTouched(true);
    setAfter(next);
  };

  return (
    <div ref={hostRef} className={className}>
      <WindowCard title={MAP_PACK.title}>
        {/* search bar */}
        <div className="flex items-center gap-2 border-b border-rule-soft px-3 py-2.5">
          <span className="text-muted" aria-hidden>
            ⌕
          </span>
          <span className="font-mono text-[14px] text-ink-soft">
            {MAP_PACK.query}
          </span>
          <span className="blink ml-px h-3.5 w-px bg-ink" aria-hidden />
        </div>

        <ol className="divide-y divide-rule-soft-soft">
          {rows.map((row, i) => (
            <li
              key={row.name}
              className={`flex items-center gap-3 px-3 py-3 transition-colors duration-500 ${
                row.you ? "bg-pin-soft" : ""
              }`}
            >
              <span
                className={`flex h-6 w-6 flex-none items-center justify-center rounded-full border text-[13px] font-mono transition-colors duration-500 ${
                  row.you
                    ? "border-pin bg-pin text-paper-2"
                    : "border-rule text-muted"
                }`}
                aria-hidden
              >
                {i + 1}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span
                    className={`truncate text-[16px] ${
                      row.you ? "font-semibold text-ink" : "text-ink-soft"
                    }`}
                  >
                    {row.name}
                  </span>
                  {row.you ? (
                    <span className="flex-none rounded-full border border-pin px-1.5 py-px font-mono text-[11px] uppercase tracking-wider text-pin">
                      you
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted">
                  <Stars n={Math.round(row.rating)} size={10} />
                  <span className="font-mono">{row.rating.toFixed(1)}</span>
                  <span aria-hidden>·</span>
                  <span>{row.reviews} reviews</span>
                  <span aria-hidden>·</span>
                  <span>{row.distance}</span>
                </span>
              </span>

              <span className="flex-none rounded-full border border-open bg-open-soft px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider text-open">
                open
              </span>
            </li>
          ))}
        </ol>

        {/* caption + manual toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-rule-soft bg-paper-3 px-3 py-2.5">
          <p className="font-mono text-[13px] leading-snug text-ink-soft">
            {after ? MAP_PACK.afterLabel : MAP_PACK.beforeLabel}
          </p>
          <div className="flex flex-none items-center gap-1" role="group" aria-label="map pack state">
            {[
              { label: "before", value: false },
              { label: "after", value: true },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => pick(opt.value)}
                aria-pressed={after === opt.value}
                className={`rounded-full border px-2.5 py-1 font-mono text-[12px] transition-colors ${
                  after === opt.value
                    ? "border-rule bg-ink text-paper-2"
                    : "border-rule text-muted hover:border-rule hover:text-ink"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </WindowCard>

      <p className="mt-2.5 px-1 font-mono text-[12px] leading-relaxed text-muted">
        {MAP_PACK.note}
      </p>
    </div>
  );
}
