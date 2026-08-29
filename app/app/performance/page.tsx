"use client";

import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { AppScreen, Loading, NeedsConnect } from "@/components/app-shell";

export default function PerformancePage() {
  const data = useQuery(api.lists.performance);
  const syncMetrics = useAction(api.performance.syncMetrics);
  const checkRanks = useAction(api.performance.checkRanks);

  const [busy, setBusy] = useState<null | "metrics" | "ranks">(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(which: "metrics" | "ranks") {
    setBusy(which);
    setError(null);
    setNote(null);
    try {
      if (which === "metrics") {
        const r = await syncMetrics({});
        setNote(
          r.days
            ? `Pulled ${r.days} days: ${r.views} views, ${r.calls} calls, ${r.directions} direction requests.`
            : "Google returned no data for this period yet.",
        );
      } else {
        const r = await checkRanks({});
        setNote(
          `Checked ${r.checked} keywords — found you in ${r.found}. ${r.competitors} competitors recorded.`,
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (data === undefined) return <Loading />;
  if (data === null) return <NeedsConnect />;

  const { business, metrics, keywords, competitors } = data;

  const totals = metrics.reduce(
    (acc, row) => ({
      views: acc.views + (row.views ?? 0),
      calls: acc.calls + (row.calls ?? 0),
      directions: acc.directions + (row.directions ?? 0),
    }),
    { views: 0, calls: 0, directions: 0 },
  );

  return (
    <AppScreen
      name={business.orgName}
      location={business.locationName ?? business.city}
      logoUrl={business.logoUrl}
    >
      <h1 className="text-[1.6rem]">performance</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        What your listing did, and where you rank for the searches that matter.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void run("metrics")}
          disabled={busy !== null}
          className="btn btn-ghost btn-sm disabled:opacity-40"
        >
          {busy === "metrics" ? "syncing…" : "sync from google"}
        </button>
        <button
          type="button"
          onClick={() => void run("ranks")}
          disabled={busy !== null}
          className="btn btn-primary btn-sm disabled:opacity-40"
        >
          {busy === "ranks" ? "checking…" : "check rankings"}
        </button>
      </div>

      {note ? (
        <p className="mt-3 rounded-[12px] border border-open bg-open-soft px-3.5 py-2.5 text-[13px] leading-snug">
          {note}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-[12px] border border-pin bg-pin-soft px-3.5 py-2.5 font-mono text-[12px] leading-snug break-words"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-5 grid grid-cols-3 gap-2">
        {[
          ["Views", totals.views],
          ["Calls", totals.calls],
          ["Directions", totals.directions],
        ].map(([label, value]) => (
          <div
            key={label as string}
            className="rounded-[14px] border border-ink bg-paper-2 p-3 text-center shadow-[2px_3px_0_var(--color-ink)]"
          >
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted">
              {label}
            </p>
            <p className="mt-1 font-display text-[22px] font-bold leading-none">
              {metrics.length ? (value as number) : "—"}
            </p>
          </div>
        ))}
      </div>

      {metrics.length === 0 ? (
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted">
          Not pulled from Google yet. These come from the Business Profile
          Performance API once it&rsquo;s wired up.
        </p>
      ) : null}

      <section className="mt-7">
        <h2 className="font-display text-[15px] font-bold">
          Rank for targeted keywords
        </h2>
        {keywords.length === 0 ? (
          <p className="mt-3 rounded-[14px] border border-dashed border-rule px-4 py-8 text-center text-[13px] leading-relaxed text-muted">
            No keywords yet. Add them in setup and we&rsquo;ll track your
            position weekly.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-rule-soft border-y border-rule">
            {keywords.map((kw, i) => (
              <li key={kw._id} className="flex items-center gap-3 py-3">
                <span className="w-5 flex-none font-mono text-[11px] text-muted">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px]">
                  {kw.term}
                </span>
                <span className="flex-none font-display text-[15px] font-bold">
                  {kw.rank ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {keywords.length > 0 && keywords.every((k) => k.rank === undefined) ? (
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted">
            Positions blank until the first rank check runs. Lower is better.
          </p>
        ) : null}
      </section>

      <section className="mt-7">
        <h2 className="font-display text-[15px] font-bold">
          Competitors ahead of you
        </h2>
        {competitors.length === 0 ? (
          <p className="mt-3 rounded-[14px] border border-dashed border-rule px-4 py-8 text-center text-[13px] leading-relaxed text-muted">
            We&rsquo;ll fill this in from the map results around your shop.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-rule-soft border-y border-rule">
            {competitors.map((c) => (
              <li key={c._id} className="flex items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px]">{c.name}</span>
                  <span className="font-mono text-[11px] text-muted">
                    ★ {c.rating ?? "—"} · {c.reviewCount ?? 0} reviews
                  </span>
                </span>
                <span className="flex-none font-display text-[15px] font-bold">
                  {c.averageRank ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppScreen>
  );
}
