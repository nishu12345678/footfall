"use client";

import { useAction, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Relevance } from "@/components/relevance";
import { AppScreen, Loading, NeedsConnect } from "@/components/app-shell";
import { Working } from "@/components/working";
import dynamic from "next/dynamic";

const RankMap = dynamic(
  () => import("@/components/rank-map").then((m) => m.RankMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[268px] w-full animate-pulse rounded-[14px] border border-ink bg-paper-3" />
    ),
  },
);

const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

type Metric = "views" | "calls" | "directions";

const METRICS: { key: Metric; label: string }[] = [
  { key: "views", label: "Views" },
  { key: "calls", label: "Calls" },
  { key: "directions", label: "Directions" },
];

/** Only a "near me" search changes with where the searcher is standing. */
function isNearMe(term: string) {
  return term.includes("near me") || term.includes("nearby");
}

function ago(timestamp?: number) {
  if (!timestamp) return "never";
  const mins = Math.floor((Date.now() - timestamp) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

function pretty(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

export default function PerformancePage() {
  const data = useQuery(api.lists.performance);
  const syncMetrics = useAction(api.performance.syncMetrics);
  const checkRanks = useAction(api.performance.checkRanks);
  const runGeoGrid = useAction(api.performance.runGeoGrid);

  const [days, setDays] = useState<number>(30);
  const [chart, setChart] = useState<Metric>("views");
  const [busy, setBusy] = useState<null | "metrics" | "ranks">(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoSyncing, setAutoSyncing] = useState(false);
  const autoRan = useRef(false);
  const autoRanks = useRef(false);
  const [gridFor, setGridFor] = useState<string | null>(null);
  const [gridding, setGridding] = useState<string | null>(null);

  // Google's numbers cost nothing to read, so refresh them whenever the
  // screen is opened and the data has gone stale. Rank checks are NOT
  // automatic here — each one spends a SerpApi search per keyword.
  const STALE_AFTER_MS = 30 * 60 * 1000;
  const syncedAt = data?.business.metricsSyncedAt;
  const stale = data
    ? !syncedAt || Date.now() - syncedAt > STALE_AFTER_MS
    : false;

  useEffect(() => {
    if (!data || autoRan.current || !stale) return;
    autoRan.current = true;
    setAutoSyncing(true);
    void syncMetrics({ days: 90 })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setAutoSyncing(false));
  }, [data, stale, syncMetrics]);

  // The first rank check runs on its own — an empty ranking table teaches
  // the owner nothing. After that it's manual, because each check spends
  // one search per keyword.
  useEffect(() => {
    if (!data || autoRanks.current) return;
    if (data.business.ranksCheckedAt) return;
    if (data.keywords.length === 0) return;
    autoRanks.current = true;
    setBusy("ranks");
    void checkRanks({})
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(null));
  }, [data, checkRanks]);

  async function run(which: "metrics" | "ranks") {
    setBusy(which);
    setError(null);
    setNote(null);
    try {
      if (which === "metrics") {
        const r = await syncMetrics({ days });
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

  async function drawGrid(keyword: string) {
    setGridding(keyword);
    setError(null);
    try {
      await runGeoGrid({ keyword, size: 3, stepKm: 2 });
      setGridFor(keyword);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGridding(null);
    }
  }

  if (data === undefined) return <Loading />;
  if (data === null) return <NeedsConnect />;

  const { business, metrics, keywords, competitors, grid } = data;
  const shownGrid = gridFor ? grid.filter((g) => g.keyword === gridFor) : [];
  const rankedCount = keywords.filter((k) => k.rank !== undefined).length;

  // A proximity search and a city search are different questions. "Dentist
  // near me" has a different answer on every street; "dentist in Agra" has
  // roughly one answer for the whole city. Reporting them in one list makes
  // a good number and a bad number look the same.
  const groups = [
    {
      key: "near",
      title: "When someone nearby searches",
      note: "No city named — Google answers from where the customer is standing. This is most of the searches that walk through your door.",
      rows: keywords.filter((k) => isNearMe(k.term)),
    },
    {
      key: "city",
      title: "When someone names the city",
      note: "One answer for the whole city, so it barely moves with where the customer stands. Fewer people search this way.",
      rows: keywords.filter((k) => !isNearMe(k.term)),
    },
  ].filter((g) => g.rows.length > 0);

  // Metrics are stored per day, so switching the range is instant — no
  // second call to Google unless the owner asks for one.
  const cutoff = new Date(Date.now() - days * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const window = metrics.filter((row) => row.date >= cutoff);

  const totals = window.reduce(
    (acc, row) => ({
      views: acc.views + (row.views ?? 0),
      calls: acc.calls + (row.calls ?? 0),
      directions: acc.directions + (row.directions ?? 0),
    }),
    { views: 0, calls: 0, directions: 0 },
  );

  const peak = Math.max(1, ...window.map((row) => row[chart] ?? 0));
  const rangeLabel = window.length
    ? `${pretty(window[0].date)} – ${pretty(window[window.length - 1].date)}`
    : null;

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

      {/* range */}
      <div className="mt-5 flex items-center gap-1 rounded-full border border-ink bg-paper p-1">
        {RANGES.map((r) => (
          <button
            key={r.days}
            type="button"
            onClick={() => setDays(r.days)}
            aria-pressed={days === r.days}
            className={`flex-1 rounded-full px-3 py-1.5 font-display text-[13px] font-semibold transition-colors ${
              days === r.days
                ? "bg-ink text-paper-2"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-2 font-mono text-[10px] text-muted">
        {rangeLabel ? <span>{rangeLabel}</span> : <span>no data in range</span>}
        <span aria-hidden>·</span>
        <span>
          {autoSyncing
            ? "syncing now…"
            : `synced ${ago(business.metricsSyncedAt)}`}
        </span>
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void run("metrics")}
          disabled={busy !== null}
          className="btn btn-ghost btn-sm disabled:opacity-40"
        >
          {busy === "metrics" ? "syncing…" : `sync ${days} days`}
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
          className="mt-3 break-words rounded-[12px] border border-pin bg-pin-soft px-3.5 py-2.5 font-mono text-[12px] leading-snug"
        >
          {error}
        </p>
      ) : null}

      {/* totals */}
      <div className="mt-5 grid grid-cols-3 gap-2">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setChart(m.key)}
            aria-pressed={chart === m.key}
            className={`rounded-[14px] border p-3 text-center transition-colors ${
              chart === m.key
                ? "border-pin bg-pin-soft shadow-[2px_3px_0_var(--color-pin)]"
                : "border-ink bg-paper-2 shadow-[2px_3px_0_var(--color-ink)]"
            }`}
          >
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted">
              {m.label}
            </p>
            <p className="mt-1 font-display text-[22px] font-bold leading-none">
              {window.length ? totals[m.key].toLocaleString("en-IN") : "—"}
            </p>
          </button>
        ))}
      </div>

      {/* daily trend */}
      {window.length > 1 ? (
        <div className="mt-4 rounded-[14px] border border-ink bg-paper-2 p-4 shadow-[3px_4px_0_var(--color-ink)]">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted">
            {chart} per day
          </p>
          <div
            className="mt-3 flex h-24 items-end gap-px"
            role="img"
            aria-label={`${chart} per day over the last ${days} days`}
          >
            {window.map((row) => {
              const value = row[chart] ?? 0;
              return (
                <span
                  key={row.date}
                  title={`${pretty(row.date)}: ${value}`}
                  className="flex-1 rounded-t-[2px] bg-pin/70"
                  style={{ height: `${Math.max((value / peak) * 100, 2)}%` }}
                />
              );
            })}
          </div>
          <div className="mt-2 flex justify-between font-mono text-[9px] text-muted">
            <span>{pretty(window[0].date)}</span>
            <span>peak {peak}</span>
            <span>{pretty(window[window.length - 1].date)}</span>
          </div>
        </div>
      ) : null}

      {window.length === 0 ? (
        <p className="mt-3 font-mono text-[11px] leading-relaxed text-muted">
          Nothing pulled for this range yet. Google&rsquo;s data also lags a few
          days, so the most recent days often read zero.
        </p>
      ) : null}

      {/* keywords */}
      <section className="mt-7">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[15px] font-bold">
            Rank for targeted keywords
          </h2>
          <span className="flex-none font-mono text-[10px] text-muted">
            {ago(business.ranksCheckedAt)}
          </span>
        </div>

        {keywords.length === 0 ? (
          <p className="mt-3 rounded-[14px] border border-dashed border-rule px-4 py-8 text-center text-[13px] leading-relaxed text-muted">
            No keywords yet. Add them in setup and we&rsquo;ll track your
            position weekly.
          </p>
        ) : null}

        {groups.map((group) => (
          <div key={group.key} className="mt-5">
            <h3 className="font-display text-[13px] font-bold">
              {group.title}
            </h3>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              {group.note}
            </p>
            <ul className="mt-2 divide-y divide-rule-soft border-y border-rule">
              {[...group.rows]
                .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
                .map((kw) => {
                  const moved =
                    kw.rank !== undefined && kw.previousRank !== undefined
                      ? kw.previousRank - kw.rank
                      : null;
                  const checked = kw.checkedAt !== undefined;
                  return (
                    <li key={kw._id} className="py-3">
                      <div className="flex items-center gap-3">
                        <span className="min-w-0 flex-1 truncate text-[14px]">
                          {kw.term}
                        </span>
                        {moved !== null && moved !== 0 ? (
                          <span
                            className={`flex-none rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                              moved > 0
                                ? "bg-open-soft text-open"
                                : "bg-pin-soft text-pin"
                            }`}
                          >
                            {moved > 0 ? "▲" : "▼"} {Math.abs(moved)}
                          </span>
                        ) : null}
                        <span
                          className={`flex-none rounded-full border px-2 py-0.5 font-display text-[13px] font-bold ${
                            kw.rank === undefined
                              ? "border-rule text-muted"
                              : kw.rank <= 3
                                ? "border-open bg-open-soft text-open"
                                : kw.rank <= 10
                                  ? "border-star bg-star/20"
                                  : "border-pin bg-pin-soft text-pin"
                          }`}
                        >
                          {checked ? (kw.rank ?? "nowhere") : "—"}
                        </span>
                      </div>

                      {checked && (kw.coverageTotal ?? 0) > 1 ? (
                        <div className="mt-1.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-paper-3">
                              <div
                                className={`h-full rounded-full ${
                                  (kw.coverageFound ?? 0) === 0
                                    ? "bg-pin/30"
                                    : "bg-open"
                                }`}
                                style={{
                                  width: `${Math.round(((kw.coverageFound ?? 0) / (kw.coverageTotal ?? 1)) * 100)}%`,
                                }}
                              />
                            </div>
                            <span className="flex-none font-mono text-[10px] text-muted">
                              seen at {kw.coverageFound ?? 0}/{kw.coverageTotal}{" "}
                              spots
                              {kw.avgRank ? ` · avg ${kw.avgRank}` : ""}
                            </span>
                          </div>
                        </div>
                      ) : null}

                      {checked && isNearMe(kw.term) ? (
                        <button
                          type="button"
                          onClick={() => void drawGrid(kw.term)}
                          disabled={gridding !== null}
                          className="mt-1.5 font-mono text-[10px] text-muted underline underline-offset-4 hover:text-pin disabled:opacity-50"
                        >
                          {gridding === kw.term
                            ? "checking around you…"
                            : gridFor === kw.term
                              ? "hide the map"
                              : "where do I rank around here?"}
                        </button>
                      ) : null}

                      {gridFor === kw.term &&
                      shownGrid.length > 0 &&
                      business.lat &&
                      business.lng ? (
                        <div className="mt-3">
                          <p className="mb-1.5 font-mono text-[10px] text-muted">
                            Showing &ldquo;{kw.term}&rdquo; from several points
                            around you
                          </p>
                          <RankMap
                            lat={business.lat}
                            lng={business.lng}
                            keyword={kw.term}
                            points={shownGrid.map((g) => ({
                              lat: g.lat,
                              lng: g.lng,
                              rank: g.rank,
                            }))}
                          />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}

        {keywords.length > 0 ? (
          <p className="mt-3 rounded-[12px] border border-rule bg-paper-2 px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-soft">
            {business.ranksCheckedAt === undefined
              ? "Checking where you rank right now…"
              : rankedCount === 0
                ? `You don't appear anywhere in your service area for these searches yet. That's normal for a listing with few reviews — the shops ranking above you have hundreds. Collecting reviews is the fastest way to change it.`
                : `You show up somewhere in your service area for ${rankedCount} of ${keywords.length} searches. "Seen at 3/9 spots" means someone standing at 3 of the 9 places we checked would find you.`}
          </p>
        ) : null}
      </section>

      <Relevance />

      {/* competitors */}
      <section className="mt-7">
        <h2 className="font-display text-[15px] font-bold">
          Competitors ahead of you
        </h2>
        {competitors.length === 0 ? (
          <p className="mt-3 rounded-[14px] border border-dashed border-rule px-4 py-8 text-center text-[13px] leading-relaxed text-muted">
            Run a rank check and we&rsquo;ll fill this in from the map results
            around your shop.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-rule-soft border-y border-rule">
            {competitors.map((c) => (
              <li key={c._id} className="flex items-center gap-3 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px]">{c.name}</span>
                  <span className="font-mono text-[11px] text-muted">
                    ★ {c.rating ?? "—"} · {c.reviewCount ?? 0} reviews
                    {c.category ? ` · ${c.category}` : ""}
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
