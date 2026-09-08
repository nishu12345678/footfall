"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAction, useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";
import { OnboardingTop, nextHref, useEditMode } from "@/components/onboarding-frame";
import { Working } from "@/components/working";
import { ONBOARDING_STEPS } from "@/lib/onboarding";
import dynamic from "next/dynamic";
import { friendlyError } from "@/lib/errors";

const AreaMap = dynamic(
  () => import("@/components/area-map").then((m) => m.AreaMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[248px] w-full animate-pulse rounded-[14px] bg-paper-3" />
    ),
  },
);

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
  const edit = useEditMode();
  const router = useRouter();
  const researchKeywords = useAction(api.keywords.research);
  const seedAreas = useMutation(api.gbp.seedServiceAreas);
  const nearbyAreas = useAction(api.gbp.nearbyAreas);
  const tuneRadius = useAction(api.businesses.tuneRadius);
  const setServiceRadius = useMutation(api.gbp.setServiceRadius);

  const [tab, setTab] = useState<Tab>("areas");
  const [draft, setDraft] = useState("");
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
  const [areaIdeas, setAreaIdeas] = useState<
    { name: string; km: number; kind: string; lat: number; lng: number }[]
  >([]);
  const [radiusKm, setRadiusKm] = useState(20);
  const [autoRan, setAutoRan] = useState<Record<string, boolean>>({});
  const [seen, setSeen] = useState<Record<string, boolean>>({ areas: true });
  const [areasSeeded, setAreasSeeded] = useState(false);
  const [findingAreas, setFindingAreas] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // The shop's own locality and city are already known from Google, so the
  // service area box should never start empty.
  useEffect(() => {
    if (!data || areasSeeded) return;
    setAreasSeeded(true);
    if (data.serviceAreas.length === 0) void seedAreas({});
  }, [data, areasSeeded, seedAreas]);

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

  // Shop owners shouldn't have to press "research". Opening the tab does it.
  useEffect(() => {
    if (!data) return;
    if (tab === "areas" && !autoRan.areas) {
      setAutoRan((s) => ({ ...s, areas: true }));
      void findAreas(radiusKm);
      // How far this trade is judged over — a clinic is not a tile showroom.
      void tuneRadius({}).catch(() => {});
    }
    if (tab === "keywords" && !autoRan.keywords) {
      setAutoRan((s) => ({ ...s, keywords: true }));
      void runResearch(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, data]);

  if (data === undefined) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="text-[13px] text-muted">loading…</p>
      </main>
    );
  }

  if (data === null) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6">
        <h1 className="text-[clamp(1.8rem,5vw,2.2rem)]">connect google first</h1>
        <Link href="/app/connect" className="btn btn-primary mt-8 w-full">
          connect google
        </Link>
      </main>
    );
  }

  const enabled = new Set(
    data.attributes.filter((a) => a.enabled).map((a) => a.key),
  );

  // The near-me phrases put themselves on the list, so the research panel
  // has to show what is already tracked rather than only what to add.
  const tracked = new Set(data.keywords.map((k) => k.term.toLowerCase()));

  function patchHour(day: number, patch: Partial<HourRow>) {
    setLocalHours((rows) =>
      rows.map((r) => (r.day === day ? { ...r, ...patch } : r)),
    );
  }

  async function findAreas(km: number) {
    setFindingAreas(true);
    setError(null);
    try {
      setAreaIdeas(await nearbyAreas({ radiusKm: km }));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setFindingAreas(false);
    }
  }

  async function runResearch(deep: boolean) {
    setThinking(true);
    setError(null);
    try {
      setResearched(await researchKeywords({ deep }));
    } catch (e) {
      setError(friendlyError(e));
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
      router.push(nextHref(4, edit));
    } catch (e) {
      setError(friendlyError(e));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-6 py-8 sm:py-12">
      <OnboardingTop step={4} edit={edit} />

      <div className="no-scrollbar mt-9 flex gap-5 overflow-x-auto border-b border-rule">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setSeen((s) => ({ ...s, [t.id]: true }));
              setDraft("");
            }}
            className={`-mb-px flex-none border-b-2 pb-2.5 text-[13px] font-semibold transition-colors ${
              tab === t.id
                ? "border-pin text-pin"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
            {seen[t.id] && tab !== t.id ? (
              <span aria-hidden className="ml-1 text-open-deep">
                ✓
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="mt-9 flex-1">
        {tab === "areas" ? (
          <>
            <h1 className="text-[clamp(1.8rem,5vw,2.1rem)]">
              where do your customers come from?
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              How far people travel to you. We measure your &ldquo;near
              me&rdquo; ranking across this whole area, not just at your door.
            </p>

            {data.business.lat && data.business.lng ? (
              <div className="mt-6">
                <AreaMap
                  lat={data.business.lat}
                  lng={data.business.lng}
                  radiusKm={radiusKm}
                  label={data.business.orgName}
                  pins={areaIdeas.map((a) => ({
                    name: a.name,
                    km: a.km,
                    lat: a.lat,
                    lng: a.lng,
                    added: data.serviceAreas.some(
                      (s) => s.name.toLowerCase() === a.name.toLowerCase(),
                    ),
                  }))}
                />
              </div>
            ) : null}

            <form
              className="mt-8 flex gap-2.5"
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
                className="min-w-0 flex-1 rounded-[12px] border border-rule bg-white px-4 py-3 text-[16px] outline-none placeholder:text-muted/60 focus:border-pin"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="btn btn-primary btn-sm flex-none disabled:opacity-40"
              >
                add
              </button>
            </form>

            <div className="mt-8 border-t border-rule-soft pt-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[15px] font-semibold text-ink">
                  Areas near you
                </p>
                <div className="flex flex-none items-center gap-1 rounded-full bg-paper-3 p-0.5">
                  {[10, 20, 30].map((km) => (
                    <button
                      key={km}
                      type="button"
                      onClick={() => {
                        setRadiusKm(km);
                        void setServiceRadius({ radiusKm: km });
                        void findAreas(km);
                      }}
                      aria-pressed={radiusKm === km}
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                        radiusKm === km
                          ? "bg-white text-ink shadow-card"
                          : "text-muted"
                      }`}
                    >
                      {km}km
                    </button>
                  ))}
                </div>
              </div>
              {findingAreas ? (
                <div className="mt-3">
                  <Working label={`Reading the map ${radiusKm}km around you`} />
                </div>
              ) : areaIdeas.length ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {areaIdeas.map((area) => {
                    const added = data.serviceAreas.some(
                      (s) => s.name.toLowerCase() === area.name.toLowerCase(),
                    );
                    return (
                      <li key={area.name}>
                        <button
                          type="button"
                          disabled={added}
                          onClick={() => void addArea({ name: area.name })}
                          className={`pressable inline-flex items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-3 text-[13px] transition-colors ${
                            added
                              ? "bg-pin-soft text-pin"
                              : "bg-paper-2 hover:bg-paper-3"
                          }`}
                        >
                          <span
                            aria-hidden
                            className={added ? "text-pin" : "text-pin"}
                          >
                            {added ? "✓" : "+"}
                          </span>
                          {area.name}
                          <span className="text-[11px] text-muted">
                            {area.km}km
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-[12px] leading-relaxed text-muted">
                  No towns or neighbourhoods on the map within {radiusKm}km. Try
                  a wider radius, or type an area name above.
                </p>
              )}
            </div>

            {data.business.scanRadiusKm ? (
              <div className="mt-5 rounded-[12px] bg-paper-2 p-4">
                <p className="text-[13px] font-semibold leading-snug">
                  We&rsquo;ll measure your &ldquo;near me&rdquo; ranking across{" "}
                  {data.business.scanRadiusKm}km
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">
                  {data.business.radiusReason
                    ? `${data.business.radiusReason} Ranking is measured over the distance customers actually travel, not the whole area you serve.`
                    : "Measured over the distance customers actually travel, not the whole area you serve."}
                </p>
              </div>
            ) : null}

            <p className="eyebrow mt-8">you serve</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {data.serviceAreas.map((area) => (
                <li key={area._id}>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-pin-soft py-1.5 pl-3 pr-1.5 text-[13px] font-medium text-pin">
                    {area.name}
                    <button
                      type="button"
                      onClick={() => void removeArea({ id: area._id })}
                      aria-label={`remove ${area.name}`}
                      className="grid h-4 w-4 place-items-center rounded-full text-pin hover:bg-pin hover:text-white"
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
            <h1 className="text-[clamp(1.8rem,5vw,2.1rem)]">
              what do people search?
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              We track your position for each of these every week, so you can
              see the ranking move.
            </p>

            <form
              className="mt-8 flex gap-2.5"
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
                className="min-w-0 flex-1 rounded-[12px] border border-rule bg-white px-4 py-3 text-[16px] outline-none placeholder:text-muted/60 focus:border-pin"
              />
              <button
                type="submit"
                disabled={!draft.trim()}
                className="btn btn-primary btn-sm flex-none disabled:opacity-40"
              >
                add
              </button>
            </form>

            <ul className="mt-6 space-y-2.5">
              {data.keywords.map((kw) => (
                <li
                  key={kw._id}
                  className="flex items-center justify-between gap-3 rounded-[12px] bg-paper-2 px-4 py-3"
                >
                  <span className="min-w-0 truncate text-[14px]">
                    {kw.term}
                  </span>
                  <button
                    type="button"
                    onClick={() => void removeKeyword({ id: kw._id })}
                    aria-label={`remove ${kw.term}`}
                    className="flex-none text-[13px] text-muted hover:text-pin"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>

            <div className="mt-8 border-t border-rule-soft pt-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[15px] font-semibold text-ink">
                  Researched from Google
                </p>
                <button
                  type="button"
                  onClick={() => void runResearch(true)}
                  disabled={thinking}
                  className="flex-none text-[13px] font-medium text-pin hover:opacity-80 disabled:opacity-50"
                >
                  check competition
                </button>
              </div>

              {thinking ? (
                <div className="mt-3">
                  <Working label="Finding what your customers search for" />
                </div>
              ) : researched.length ? (
                <ul className="mt-4 space-y-2.5">
                  {researched.map((r) => (
                    <li
                      key={r.term}
                      className="rounded-[12px] bg-paper-2 p-3.5"
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={
                            tracked.has(r.term)
                              ? `${r.term} is tracked`
                              : `add ${r.term}`
                          }
                          disabled={tracked.has(r.term)}
                          onClick={() => void addKeyword({ term: r.term })}
                          className={`pressable grid h-7 w-7 flex-none place-items-center rounded-full text-[15px] leading-none ${
                            tracked.has(r.term)
                              ? "bg-paper-3 text-pin"
                              : "bg-pin text-white"
                          }`}
                        >
                          {tracked.has(r.term) ? "✓" : "+"}
                        </button>
                        <span className="min-w-0 flex-1 text-[13px]">
                          {r.term}
                        </span>
                        {r.measured === "volume" && r.volume ? (
                          <span className="flex-none rounded-full bg-open-soft px-2 py-0.5 text-[11px] font-medium text-open-deep">
                            {r.volume.toLocaleString("en-IN")}/mo
                          </span>
                        ) : null}
                        <span
                          className={`flex-none rounded-full bg-paper-3 px-2 py-0.5 text-[11px] font-medium ${
                            r.demand > 0 ? "text-ink-soft" : "text-muted"
                          }`}
                          title="How worth chasing this search is for you: how many people type it, weighed against how hard the competition is to beat. Higher is better."
                        >
                          {r.score} pts
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-muted">
                        {r.why}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[12px] leading-relaxed text-muted">
                  Finds what people near you actually search for what you sell,
                  ranked by real monthly search volume where Google Ads measures
                  it, and Google Trends demand where it doesn&rsquo;t. &ldquo;+
                  competition&rdquo; also reads the map results to see how
                  strong the current top 3 are — slower, more credits.
                </p>
              )}
            </div>
          </>
        ) : null}

        {tab === "hours" ? (
          <>
            <h1 className="text-[clamp(1.8rem,5vw,2.1rem)]">
              when are you open?
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              Wrong hours are the fastest way to lose a walk-in. Check every
              day.
            </p>

            <ul className="inset-group mt-8">
              {hours.map((row) => (
                <li
                  key={row.day}
                  className="inset-row flex items-center gap-3 px-4 py-3.5"
                >
                  <span className="w-[76px] flex-none text-[14px] font-semibold">
                    {DAYS[row.day]}
                  </span>

                  {row.closed ? (
                    <span className="flex-1 text-[13px] text-muted">
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
                        className="w-[92px] rounded-[10px] border border-rule bg-white px-2 py-1.5 text-[13px] outline-none focus:border-pin"
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
                        className="w-[92px] rounded-[10px] border border-rule bg-white px-2 py-1.5 text-[13px] outline-none focus:border-pin"
                      />
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => patchHour(row.day, { closed: !row.closed })}
                    className="flex-none text-[13px] font-medium text-pin hover:opacity-80"
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
            <h1 className="text-[clamp(1.8rem,5vw,2.1rem)]">
              what else should people know?
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              Small things that decide between you and the shop down the road.
            </p>

            <ul className="mt-8 space-y-2.5">
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
                      className={`pressable flex w-full items-center gap-3 rounded-[12px] px-4 py-3.5 text-left text-[14px] transition-colors ${
                        on ? "bg-open-soft" : "bg-paper-2 hover:bg-paper-3"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`grid h-5 w-5 flex-none place-items-center rounded-[7px] text-[11px] ${
                          on
                            ? "bg-open text-white"
                            : "bg-paper-3 text-transparent"
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
            className="mt-5 rounded-[12px] bg-pin-soft px-4 py-3 text-[14px] leading-snug"
          >
            {error}
          </p>
        ) : null}
      </div>

      <p className="mt-10 text-center text-[12px] text-muted">
        step 4 of 6 · {TABS.filter((x) => seen[x.id]).length} of {TABS.length}{" "}
        sections done
      </p>

      <button
        type="button"
        onClick={() => void next()}
        disabled={busy}
        className="btn btn-primary mt-3 w-full disabled:opacity-40"
      >
        {tab === "hours"
          ? "save hours & next"
          : tab === "attributes"
            ? busy
              ? "saving…"
              : edit
                ? "save changes"
                : "save & make my website"
            : "save & next"}
      </button>

      <Link
        href={edit ? "/app/settings" : ONBOARDING_STEPS[4].href}
        className="mt-4 block text-center text-[13px] font-medium text-pin hover:opacity-80"
      >
        {edit ? "back to settings without saving the rest" : "skip the rest of this step"}
      </Link>
    </main>
  );
}
