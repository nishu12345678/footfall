"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Steps } from "@/components/steps";

type Tab = "areas" | "keywords" | "hours" | "attributes";

const TABS: { id: Tab; label: string }[] = [
  { id: "areas", label: "Service Areas" },
  { id: "keywords", label: "Keywords" },
  { id: "hours", label: "Hours" },
  { id: "attributes", label: "Attributes" },
];

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

type HourRow = { day: number; open?: string; close?: string; closed: boolean };

const DEFAULT_HOURS: HourRow[] = DAYS.map((_, day) => ({
  day,
  open: "10:00",
  close: "20:00",
  closed: false,
}));

export default function GbpPage() {
  const data = useQuery(api.gbp.list);
  const addArea = useMutation(api.gbp.addServiceArea);
  const removeArea = useMutation(api.gbp.removeServiceArea);
  const addKeyword = useMutation(api.gbp.addKeyword);
  const removeKeyword = useMutation(api.gbp.removeKeyword);
  const setHours = useMutation(api.gbp.setHours);
  const toggleAttribute = useMutation(api.gbp.toggleAttribute);
  const complete = useMutation(api.gbp.complete);
  const suggestKeywords = useAction(api.gbp.suggestKeywords);
  const researchKeywords = useAction(api.keywords.research);

  const [tab, setTab] = useState<Tab>("areas");
  const [draft, setDraft] = useState("");
  const [ideas, setIdeas] = useState<string[]>([]);
  const [researched, setResearched] = useState<
    {
      term: string;
      score: number;
      why: string;
      demand: number;
      source: string;
      reviews?: number;
      volume?: number | null;
      competition?: string | null;
      measured: string;
    }[]
  >([]);
  const [thinking, setThinking] = useState(false);
  const [hours, setLocalHours] = useState<HourRow[]>(DEFAULT_HOURS);
  const [hoursLoaded, setHoursLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!data || hoursLoaded) return;
    if (data.hours.length > 0) {
      setLocalHours(
        data.hours.map((h) => ({
          day: h.day,
          open: h.open,
          close: h.close,
          closed: h.closed,
        })),
      );
    }
    setHoursLoaded(true);
  }, [data, hoursLoaded]);

  if (data === undefined) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="font-mono text-[12px] text-muted">loading…</p>
      </main>
    );
  }

  if (data === null) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
        <h1 className="text-[1.8rem]">connect google first</h1>
        <a href="/app/connect" className="btn btn-primary mt-6 w-full">
          connect google
        </a>
      </main>
    );
  }

  const enabled = new Set(
    data.attributes.filter((a) => a.enabled).map((a) => a.key),
  );

  function patchHour(day: number, patch: Partial<HourRow>) {
    setLocalHours((rows) =>
      rows.map((r) => (r.day === day ? { ...r, ...patch } : r)),
    );
  }

  async function runResearch(deep: boolean) {
    setThinking(true);
    setError(null);
    try {
      setResearched(await researchKeywords({ deep }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setThinking(false);
    }
  }

  async function getKeywordIdeas() {
    setThinking(true);
    setError(null);
    try {
      setIdeas(await suggestKeywords({}));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setThinking(false);
    }
  }

  async function next() {
    const order: Tab[] = ["areas", "keywords", "hours", "attributes"];
    const i = order.indexOf(tab);

    if (tab === "hours") {
      await setHours({ hours });
    }
    if (i < order.length - 1) {
      setTab(order[i + 1]);
      setDraft("");
      return;
    }

    setBusy(true);
    try {
      await complete({});
      window.location.href = "/app/onboarding/others";
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10">
      <Steps current={4} />

      <div className="mt-7 flex gap-4 overflow-x-auto border-b border-rule">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setDraft("");
            }}
            className={`-mb-px flex-none border-b-2 pb-2.5 font-display text-[13px] font-semibold transition-colors ${
              tab === t.id
                ? "border-pin text-pin"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-7 flex-1">
        {tab === "areas" ? (
          <>
            <h1 className="text-[1.75rem]">where do your customers come from?</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
              The localities around you. We write these into your posts and
              pages so people nearby find you first.
            </p>

            <form
              className="mt-6 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.trim()) return;
                void addArea({ name: draft });
                setDraft("");
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={`e.g. ${data.business.city ?? "your area"}`}
                className="min-w-0 flex-1 rounded-[12px] border border-ink bg-paper-2 px-3.5 py-3 text-[15px] outline-none placeholder:text-muted/50"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="btn btn-primary btn-sm flex-none disabled:opacity-40"
              >
                add
              </button>
            </form>

            <ul className="mt-5 flex flex-wrap gap-2">
              {data.serviceAreas.map((area) => (
                <li key={area._id}>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-pin bg-pin-soft py-1.5 pl-3 pr-1.5 text-[13px]">
                    {area.name}
                    <button
                      type="button"
                      onClick={() => void removeArea({ id: area._id })}
                      aria-label={`remove ${area.name}`}
                      className="grid h-4 w-4 place-items-center rounded-full text-pin hover:bg-pin hover:text-paper-2"
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {tab === "keywords" ? (
          <>
            <h1 className="text-[1.75rem]">what do people search?</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
              We track your position for each of these every week, so you can
              see the ranking move.
            </p>

            <form
              className="mt-6 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!draft.trim()) return;
                void addKeyword({ term: draft });
                setDraft("");
              }}
            >
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="e.g. tiles shop near me"
                className="min-w-0 flex-1 rounded-[12px] border border-ink bg-paper-2 px-3.5 py-3 text-[15px] outline-none placeholder:text-muted/50"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="btn btn-primary btn-sm flex-none disabled:opacity-40"
              >
                add
              </button>
            </form>

            <ul className="mt-5 space-y-2">
              {data.keywords.map((kw) => (
                <li
                  key={kw._id}
                  className="flex items-center justify-between gap-3 rounded-[12px] border border-rule bg-paper-2 px-3.5 py-2.5"
                >
                  <span className="min-w-0 truncate text-[14px]">{kw.term}</span>
                  <button
                    type="button"
                    onClick={() => void removeKeyword({ id: kw._id })}
                    aria-label={`remove ${kw.term}`}
                    className="flex-none font-mono text-[13px] text-muted hover:text-pin"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-7 rounded-[14px] border border-ink bg-paper-2 p-4 shadow-[3px_3px_0_var(--color-ink)]">
              <div className="flex items-center justify-between gap-3">
                <p className="font-display text-[14px] font-bold">
                  Researched from Google
                </p>
                <span className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void runResearch(false)}
                    disabled={thinking}
                    className="font-mono text-[11px] underline underline-offset-4 hover:text-pin disabled:opacity-50"
                  >
                    {thinking ? "…" : "find"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void runResearch(true)}
                    disabled={thinking}
                    className="font-mono text-[11px] underline underline-offset-4 hover:text-pin disabled:opacity-50"
                  >
                    + competition
                  </button>
                </span>
              </div>

              {researched.length ? (
                <ul className="mt-3 space-y-2">
                  {researched.map((r) => (
                    <li
                      key={r.term}
                      className="rounded-[10px] border border-rule bg-paper p-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void addKeyword({ term: r.term });
                            setResearched((s) =>
                              s.filter((x) => x.term !== r.term),
                            );
                          }}
                          className="min-w-0 flex-1 text-left text-[13px]"
                        >
                          <span aria-hidden className="text-pin">+ </span>
                          {r.term}
                        </button>
                        {r.measured === "volume" && r.volume ? (
                          <span className="flex-none rounded-full border border-open bg-open-soft px-1.5 py-0.5 font-mono text-[9px] text-open">
                            {r.volume.toLocaleString("en-IN")}/mo
                          </span>
                        ) : null}
                        <span
                          className={`flex-none rounded-full border px-1.5 py-0.5 font-mono text-[9px] ${
                            r.demand > 0
                              ? "border-ink text-ink"
                              : "border-rule text-muted"
                          }`}
                          title="demand x winnability"
                        >
                          {r.score}
                        </span>
                      </div>
                      <p className="mt-1 font-mono text-[9px] leading-snug text-muted">
                        {r.why}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[12px] leading-relaxed text-muted">
                  Finds what people near you actually search for what you sell,
                  ranked by real monthly search volume where Google Ads
                  measures it, and Google Trends demand where it doesn&rsquo;t.
                  &ldquo;+ competition&rdquo; also reads the map results to see
                  how strong the current top 3 are — slower, more credits.
                </p>
              )}
            </div>

            <div className="mt-4 rounded-[14px] border border-rule bg-paper-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 font-display text-[14px] font-bold">
                  <span aria-hidden className="text-pin">
                    ✦
                  </span>
                  AI suggested
                </p>
                <button
                  type="button"
                  onClick={() => void getKeywordIdeas()}
                  disabled={thinking}
                  className="font-mono text-[11px] underline underline-offset-4 hover:text-pin disabled:opacity-50"
                >
                  {thinking ? "thinking…" : ideas.length ? "suggest more" : "suggest for me"}
                </button>
              </div>

              {ideas.length ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {ideas.map((idea) => (
                    <li key={idea}>
                      <button
                        type="button"
                        onClick={() => {
                          void addKeyword({ term: idea });
                          setIdeas((s) => s.filter((i) => i !== idea));
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-rule bg-paper py-1.5 pl-2.5 pr-3 text-[13px] transition-colors hover:border-ink"
                      >
                        <span aria-hidden className="text-pin">
                          +
                        </span>
                        {idea}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[13px] leading-relaxed text-muted">
                  Built from what you sell and where you serve.
                </p>
              )}
            </div>
          </>
        ) : null}

        {tab === "hours" ? (
          <>
            <h1 className="text-[1.75rem]">when are you open?</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
              Wrong hours are the fastest way to lose a walk-in. Check every
              day.
            </p>

            <ul className="mt-6 divide-y divide-rule-soft border-y border-rule">
              {hours.map((row) => (
                <li key={row.day} className="flex items-center gap-3 py-2.5">
                  <span className="w-[76px] flex-none text-[14px] font-semibold">
                    {DAYS[row.day]}
                  </span>

                  {row.closed ? (
                    <span className="flex-1 font-mono text-[12px] text-muted">
                      closed
                    </span>
                  ) : (
                    <span className="flex flex-1 items-center gap-1.5">
                      <input
                        type="time"
                        value={row.open ?? "10:00"}
                        onChange={(e) =>
                          patchHour(row.day, { open: e.target.value })
                        }
                        className="w-[92px] rounded-[10px] border border-rule bg-paper-2 px-2 py-1.5 font-mono text-[12px] outline-none"
                      />
                      <span aria-hidden className="text-muted">
                        –
                      </span>
                      <input
                        type="time"
                        value={row.close ?? "20:00"}
                        onChange={(e) =>
                          patchHour(row.day, { close: e.target.value })
                        }
                        className="w-[92px] rounded-[10px] border border-rule bg-paper-2 px-2 py-1.5 font-mono text-[12px] outline-none"
                      />
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => patchHour(row.day, { closed: !row.closed })}
                    className="flex-none font-mono text-[11px] text-muted underline underline-offset-4 hover:text-pin"
                  >
                    {row.closed ? "open" : "closed"}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {tab === "attributes" ? (
          <>
            <h1 className="text-[1.75rem]">what else should people know?</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
              Small things that decide between you and the shop down the road.
            </p>

            <ul className="mt-6 space-y-2">
              {data.attributeChoices.map((choice) => {
                const on = enabled.has(choice.key);
                return (
                  <li key={choice.key}>
                    <button
                      type="button"
                      onClick={() =>
                        void toggleAttribute({
                          key: choice.key,
                          label: choice.label,
                          enabled: !on,
                        })
                      }
                      aria-pressed={on}
                      className={`flex w-full items-center gap-3 rounded-[12px] border px-3.5 py-3 text-left text-[14px] transition-colors ${
                        on
                          ? "border-open bg-open-soft"
                          : "border-rule bg-paper-2 hover:border-ink"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`grid h-5 w-5 flex-none place-items-center rounded-[6px] border text-[11px] ${
                          on
                            ? "border-open bg-open text-paper-2"
                            : "border-rule text-transparent"
                        }`}
                      >
                        ✓
                      </span>
                      {choice.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-[12px] border border-pin bg-pin-soft px-4 py-3 text-[14px] leading-snug"
          >
            {error}
          </p>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => void next()}
        disabled={busy}
        className="btn btn-primary mt-8 w-full disabled:opacity-40"
      >
        {tab === "hours"
          ? "save hours & next"
          : tab === "attributes"
            ? busy
              ? "saving…"
              : "save & finish setup"
            : "save & next"}
      </button>
    </main>
  );
}
