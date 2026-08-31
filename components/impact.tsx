"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

const ROWS = [
  { key: "views", label: "Views", detail: "people who saw your listing" },
  { key: "calls", label: "Calls", detail: "tapped your number" },
  {
    key: "directions",
    label: "Directions",
    detail: "asked Google how to reach you",
  },
] as const;

/**
 * Before footfall, and after.
 *
 * The work this product does is invisible day to day — a post here, a
 * photo there. This is the one place that answers "did any of it matter",
 * and it only earns trust if it's honest: equal windows either side, and
 * it says plainly when there isn't enough data yet rather than drawing a
 * chart out of four days.
 */
export function Impact() {
  const data = useQuery(api.lists.impact);
  if (!data) return null;

  const started = new Date(data.startedAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  if (!data.ready) {
    return (
      <section className="mt-7">
        <h2 className="font-display text-[15px] font-bold">
          Before footfall, and after
        </h2>
        <p className="mt-3 rounded-[14px] border border-dashed border-rule px-4 py-8 text-center text-[13px] leading-relaxed text-muted">
          {data.days > 0
            ? `We've been running your listing for ${data.days} day${data.days === 1 ? "" : "s"}. Once there's a week of it, this compares that week against the week before we started.`
            : "This starts filling in once we've been running your listing for a week. Google's own data lags a couple of days behind."}
        </p>
      </section>
    );
  }

  if (!data.hasBefore) {
    return (
      <section className="mt-7">
        <h2 className="font-display text-[15px] font-bold">
          Before footfall, and after
        </h2>
        <p className="mt-3 rounded-[14px] border border-dashed border-rule px-4 py-8 text-center text-[13px] leading-relaxed text-muted">
          Google has no data for the {data.days} days before we started, so
          there&rsquo;s nothing honest to compare against yet.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-7">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[15px] font-bold">
          Before footfall, and after
        </h2>
        <span className="flex-none font-mono text-[10px] text-muted">
          {data.days} days each
        </span>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
        The {data.days} days since we started on {started}, against the{" "}
        {data.days} days before it.
      </p>

      <ul className="mt-3 space-y-2">
        {ROWS.map((row) => {
          const before = data.before[row.key];
          const after = data.after[row.key];
          const change = data.change[row.key];
          const up = change !== null && change > 0;
          const peak = Math.max(before, after, 1);

          return (
            <li
              key={row.key}
              className="rounded-[14px] border border-rule bg-paper-2 p-3.5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[14px] font-semibold">{row.label}</span>
                {change === null ? (
                  <span className="flex-none font-mono text-[10px] text-muted">
                    new
                  </span>
                ) : (
                  <span
                    className={`flex-none rounded-full border px-2 py-0.5 font-mono text-[10px] ${
                      up
                        ? "border-open bg-open-soft text-open"
                        : change === 0
                          ? "border-rule text-muted"
                          : "border-pin bg-pin-soft text-pin"
                    }`}
                  >
                    {up ? "▲" : change === 0 ? "—" : "▼"} {Math.abs(change)}%
                  </span>
                )}
              </div>

              <p className="mt-0.5 text-[12px] text-muted">{row.detail}</p>

              <div className="mt-3 space-y-1.5">
                {(
                  [
                    ["Before", before, "bg-muted/40"],
                    ["After", after, up ? "bg-open" : "bg-pin/50"],
                  ] as const
                ).map(([label, value, fill]) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="w-12 flex-none font-mono text-[9px] uppercase tracking-wider text-muted">
                      {label}
                    </span>
                    <span className="h-3 flex-1 overflow-hidden rounded-full bg-paper-3">
                      <span
                        className={`block h-full rounded-full ${fill}`}
                        style={{
                          width: `${Math.max((value / peak) * 100, 2)}%`,
                        }}
                      />
                    </span>
                    <span className="w-12 flex-none text-right font-display text-[13px] font-bold">
                      {value.toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
