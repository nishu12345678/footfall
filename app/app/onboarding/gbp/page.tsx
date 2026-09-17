"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAction, useMutation } from "convex/react";
import { useQuery } from "convex-helpers/react/cache";
import { useEffect, useRef, useState } from "react";
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

/** One place the map knows about near the shop. */
type AreaIdea = {
  name: string;
  km: number;
  kind: string;
  lat: number;
  lng: number;
};

const DEFAULT_HOURS: HourRow[] = DAYS.map((_, day) => ({
  day,
  open: "10:00",
  close: "20:00",
  closed: false,
}));

/** One phrase the research came back with. */
type Researched = {
  term: string;
  score: number;
  why: string;
  demand: number;
  source: string;
  reviews?: number;
  volume?: number | null;
  competition?: string | null;
  measured: string;
};

/**
 * Turn the raw score into something a shop owner can act on.
 *
 * "4 pts" told the owner nothing, and quietly misled: most of those four
 * points are the flat +4 every "near me" phrase receives in
 * convex/keywords.ts, not measured demand. Two phrases scoring 4 and 0.5
 * can differ only in whether they contain the words "near me" — a fact
 * about the phrasing, not about how many people search it.
 *
 * Thresholds are read off that scoring, not guessed:
 *
 *   0.5   names the city, nothing measurable   ("cafe in agra")
 *   4.0   says "near me", nothing measurable   (the bonus alone)
 *   5.5+  names the city AND has real demand
 *   9.0+  says "near me" AND has real demand
 *
 * So 5 is the first score that cannot be reached by phrasing alone, and
 * is the honest floor for calling something strong.
 *
 * The bottom tier says "Still worth it" rather than "Long shot": a phrase
 * with no national search volume is normal for one shop in one city, not
 * a bad bet — and in testing every suggestion landed there, so a
 * discouraging word would have been the only thing the owner saw.
 */
function pickLabel(score: number): { label: string; tone: string } {
  if (score >= 9) return { label: "Best pick", tone: "bg-open-soft text-open-deep" };
  if (score >= 5) return { label: "Strong pick", tone: "bg-open-soft text-open-deep" };
  if (score >= 3.5) return { label: "Ready to buy", tone: "bg-pin-soft text-pin" };
  return { label: "Still worth it", tone: "bg-paper-3 text-ink-soft" };
}

/**
 * The research explains itself in its own vocabulary — "is too niche for
 * Trends to measure", "scores 34 on Trends". That is the tool's language,
 * not the owner's. Rewrite the common cases; anything unrecognised falls
 * through unchanged rather than being hidden.
 */
function plainWhy(r: Researched, city?: string | null): string {
  const where = city ?? "your area";
  if (r.measured === "volume" && r.volume) {
    return `About ${r.volume.toLocaleString("en-IN")} searches a month in ${where}.`;
  }
  const nearMe = /near me|nearby/.test(r.term);
  if (/too niche for Trends/i.test(r.why)) {
    /* What actually happened: Google Trends was asked about the product
       word — "smoothies", not "smoothies in agra" — across the whole
       state, and returned zero. Trends only reports terms with enough
       nationwide volume to chart, so zero means "below its threshold",
       NOT "nobody searches this".

       So the honest line is that we could not measure it, and why that
       is unsurprising for one shop's phrase. An earlier draft said
       "people here do search it" — that was an invention: we have no
       evidence either way, which is the whole point. */
    return nearMe
      ? "We can't measure this one — Google only reports busier searches. Worth tracking: it's how people nearby look for a shop like yours."
      : "We can't measure this one — Google only reports busier searches. Track it and we'll show you where you rank.";
  }
  if (/scores \d/i.test(r.why)) {
    /* Trends gives relative interest, not a count, so it cannot be
       reported as "N searches". "Steady interest" is the strongest claim
       the number supports. */
    return nearMe
      ? `People in ${where} search this, and it's typed by someone ready to walk in.`
      : `People in ${where} search this.`;
  }
  return r.why;
}

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
  const [researched, setResearched] = useState<Researched[]>([]);
  /* Terms the owner has just tapped. Convex round-trips in a moment, but
     a suggestion that sits inert until it does feels broken — and with a
     list this long the owner loses their place. Marking it instantly and
     letting the real data confirm keeps the tap responsive. */
  const [justAdded, setJustAdded] = useState<Record<string, boolean>>({});
  const [thinking, setThinking] = useState(false);
  const [hours, setLocalHours] = useState<HourRow[]>(DEFAULT_HOURS);
  const [hoursLoaded, setHoursLoaded] = useState(false);
  /* Results keyed by radius, so going 20 → 10 → 20 does not re-fetch what
     has already been fetched. The map lookup is a network round trip to
     Overpass measured at several seconds; without this, every visit to a
     radius already looked at costs that again. */
  const [areasByRadius, setAreasByRadius] = useState<Record<number, AreaIdea[]>>(
    {},
  );
  const [radiusKm, setRadiusKm] = useState(20);
  const [autoRan, setAutoRan] = useState<Record<string, boolean>>({});
  const [seen, setSeen] = useState<Record<string, boolean>>({ areas: true });
  const [areasSeeded, setAreasSeeded] = useState(false);
  const [findingAreas, setFindingAreas] = useState(false);
  /* Which radius the owner is actually looking at. A lookup that finishes
     after the owner has moved on must not paint its results. */
  const latestRadius = useRef(20);
  /* Radii whose lookup failed, so an empty list is not mistaken for an
     empty map. Cleared on retry. */
  const [failedRadii, setFailedRadii] = useState<Record<number, boolean>>({});
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
        <h1 className="text-[clamp(1.8rem,5vw,2.2rem)]">Connect Google first</h1>
        <Link href="/app/connect" className="btn btn-primary mt-8 w-full">
          Connect Google
        </Link>
      </main>
    );
  }

  const enabled = new Set(
    data.attributes.filter((a) => a.enabled).map((a) => a.key),
  );

  /* What to draw right now. If this radius has not loaded yet, keep showing
     the closest radius that HAS loaded rather than emptying the list: the
     places within 10km are all within 20km too, so the carried-over chips
     are never wrong, just incomplete — and the section keeps its height
     instead of collapsing and reflowing the page under the owner's thumb. */
  const loadedRadii = Object.keys(areasByRadius).map(Number);
  const fallbackRadius = loadedRadii.length
    ? loadedRadii.reduce((best, r) =>
        Math.abs(r - radiusKm) < Math.abs(best - radiusKm) ? r : best,
      )
    : null;
  const areaIdeas: AreaIdea[] =
    areasByRadius[radiusKm] ??
    (fallbackRadius !== null ? areasByRadius[fallbackRadius] : []) ??
    [];
  /* Only a radius with nothing to show at all gets the spinner. */
  const showAreaSpinner = findingAreas && areaIdeas.length === 0;
  /* "The map has nothing here" and "we could not read the map" look
     identical from an empty list, and telling an owner in a real town
     that there is nothing near them is worse than saying we failed. Only
     claim emptiness when the lookup actually succeeded. */
  const areaLookupFailed = failedRadii[radiusKm] === true;

  const tracked = new Set(data.keywords.map((k) => k.term.toLowerCase()));

  /* What is actually on offer: research results minus anything already
     tracked, best first.

     The old panel listed everything the research returned, tracked or
     not — in testing, four of eight rows were already-added phrases the
     owner could do nothing with, each still taking a full card. Since
     several near-me phrases add themselves during setup, that is the
     normal case rather than an edge one.

     `justAdded` is included so a tapped phrase leaves the list at once,
     without waiting for the Convex round trip to remove it. */
  const suggestions = researched
    .filter((r) => !tracked.has(r.term.toLowerCase()) && !justAdded[r.term])
    .sort((a, b) => b.score - a.score);

  function patchHour(day: number, patch: Partial<HourRow>) {
    setLocalHours((rows) =>
      rows.map((r) => (r.day === day ? { ...r, ...patch } : r)),
    );
  }

  /**
   * Look up the places within `km` of the shop.
   *
   * Three things keep this from feeling janky, all of which matter
   * because the lookup is a multi-second network call:
   *
   *  · A radius already fetched returns instantly from cache, so moving
   *    between 10 / 20 / 30 is free after the first visit to each.
   *  · Results are stored per radius, so the chips and map pins for the
   *    old radius stay on screen while the new one loads instead of the
   *    list emptying and the section collapsing.
   *  · A request is only allowed to write its result if it is still the
   *    radius the owner is looking at. Without that, clicking 30 then
   *    quickly 10 could leave 30's slower answer on screen under a "10km"
   *    label.
   */
  async function findAreas(km: number) {
    if (areasByRadius[km]) return; // already known — nothing to wait for
    latestRadius.current = km;
    setFindingAreas(true);
    setError(null);
    setFailedRadii((prev) => ({ ...prev, [km]: false }));
    try {
      const found = await nearbyAreas({ radiusKm: km });
      if (latestRadius.current !== km) return; // a newer click won
      setAreasByRadius((prev) => ({ ...prev, [km]: found }));
    } catch {
      if (latestRadius.current !== km) return;
      /* Remember the failure so the empty list can say "we couldn't read
         the map" rather than "there is nothing near you", which is a
         different and much more discouraging claim.

         Deliberately NOT setError: that banner renders at the bottom of
         the step, far from the area list, and would repeat what the
         inline message already says — the owner would read the same
         failure twice and still have to scroll back up to retry. The
         shared banner stays for the other tabs, which have nowhere
         better to put it. */
      setFailedRadii((prev) => ({ ...prev, [km]: true }));
    } finally {
      if (latestRadius.current === km) setFindingAreas(false);
    }
  }

  /** Track a suggested phrase, marking it added before the server replies. */
  function trackTerm(term: string) {
    setJustAdded((prev) => ({ ...prev, [term]: true }));
    void addKeyword({ term }).catch((e) => {
      setJustAdded((prev) => {
        const next = { ...prev };
        delete next[term];
        return next;
      });
      setError(friendlyError(e));
    });
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

      <div className="no-scrollbar mt-9 flex snap-x gap-5 overflow-x-auto border-b border-rule">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setSeen((s) => ({ ...s, [t.id]: true }));
              setDraft("");
            }}
            className={`-mb-px flex-none snap-start border-b-2 pb-2.5 pt-2 text-[13px] font-semibold transition-colors ${
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
              Where do your customers come from?
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
                Add
              </button>
            </form>

            <div className="mt-8 border-t border-rule-soft pt-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-[15px] font-semibold text-ink">
                  Areas near you
                </p>
                <div className="flex flex-none items-center gap-1 rounded-full bg-paper-3 p-0.5">
                  {[10, 20, 30].map((km) => (
                    <button
                      key={km}
                      type="button"
                      onClick={() => {
                        if (km === radiusKm) return;
                        /* Set before the await so an in-flight lookup for
                           the old radius knows it has been superseded. */
                        latestRadius.current = km;
                        setRadiusKm(km);
                        setError(null);
                        void setServiceRadius({ radiusKm: km });
                        void findAreas(km);
                      }}
                      aria-pressed={radiusKm === km}
                      className={`rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                        radiusKm === km
                          ? "bg-white text-ink shadow-card"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      {km}km
                    </button>
                  ))}
                </div>
              </div>
              {showAreaSpinner ? (
                <div className="mt-3">
                  <Working label={`Reading the map ${radiusKm}km around you`} />
                </div>
              ) : areaIdeas.length ? (
                /* Dimmed rather than replaced while a new radius loads, so
                   the list keeps its place on the page and the owner can
                   still read it. Pointer events go off so a chip cannot be
                   tapped while it is about to be replaced. */
                <ul
                  className={`mt-3 flex flex-wrap gap-2 transition-opacity duration-200 ${
                    findingAreas ? "pointer-events-none opacity-50" : ""
                  }`}
                >
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
                          aria-label={
                            added
                              ? `${area.name}, already added`
                              : `add ${area.name}, ${area.km}km away`
                          }
                          className={`pressable inline-flex items-center gap-1.5 rounded-full py-1.5 pl-2.5 pr-3 text-[13px] transition-colors ${
                            added
                              ? "bg-pin-soft text-pin"
                              : "bg-paper-2 hover:bg-paper-3"
                          }`}
                        >
                          <span aria-hidden className="text-pin">
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
              ) : areaLookupFailed ? (
                /* Not the same as an empty map — say so, and offer the one
                   action that might work, since the failure is usually a
                   busy map server rather than anything about this shop. */
                <p className="mt-2 text-[12px] leading-relaxed text-muted">
                  Couldn&rsquo;t read the map just now — this usually clears in
                  a moment.{" "}
                  <button
                    type="button"
                    onClick={() => void findAreas(radiusKm)}
                    className="font-semibold text-pin underline underline-offset-2"
                  >
                    Try again
                  </button>
                  , or type an area name above.
                </p>
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
                      className="-my-1 grid h-6 w-6 place-items-center rounded-full text-pin hover:bg-pin hover:text-white"
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
              What do people search?
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
                Add
              </button>
            </form>

            {/* Chips, not full-width rows. Ten keywords used ten stacked
                bars and pushed the suggestions — the part that needs a
                decision — about a thousand pixels down the page. Wrapped
                chips show the same list in a few lines, so what is already
                tracked and what is on offer are visible together. */}
            {data.keywords.length ? (
              <>
                <div className="mt-7 flex items-baseline justify-between gap-3">
                  <p className="text-[15px] font-semibold text-ink">
                    Tracking {data.keywords.length}
                  </p>
                </div>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {data.keywords.map((kw) => (
                    <li key={kw._id}>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-pin-soft py-1.5 pl-3 pr-1.5 text-[13px] font-medium text-pin">
                        {kw.term}
                        <button
                          type="button"
                          onClick={() => void removeKeyword({ id: kw._id })}
                          aria-label={`Remove ${kw.term}`}
                          className="-my-1 grid h-6 w-6 place-items-center rounded-full text-pin hover:bg-pin hover:text-white"
                        >
                          ×
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <div className="mt-8 border-t border-rule-soft pt-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-[15px] font-semibold text-ink">
                  Suggestions for you
                </p>
                {suggestions.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => suggestions.forEach((r) => trackTerm(r.term))}
                    className="-my-2 flex-none py-2 text-[13px] font-medium text-pin hover:opacity-80"
                  >
                    Add all {suggestions.length}
                  </button>
                ) : null}
              </div>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                What people near you type when they want what you sell. Tap one
                to start tracking your position for it.
              </p>

              {thinking ? (
                <div className="mt-3">
                  <Working label="Finding what your customers search for" />
                </div>
              ) : suggestions.length ? (
                /* One tappable row per phrase. The whole row is the target
                   rather than a 28px circle beside it — this is a phone
                   screen and the old hit area was the smallest thing on
                   the page. Already-tracked phrases are filtered out
                   entirely: half of the eight results were rows the owner
                   could do nothing with. */
                <ul className="mt-4 space-y-2">
                  {suggestions.map((r) => {
                    const pick = pickLabel(r.score);
                    return (
                      <li key={r.term}>
                        <button
                          type="button"
                          onClick={() => trackTerm(r.term)}
                          aria-label={`Track ${r.term}`}
                          className="pressable flex w-full items-start gap-3 rounded-[12px] bg-paper-2 p-3.5 text-left transition-colors hover:bg-paper-3"
                        >
                          <span
                            aria-hidden
                            className="mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-full bg-pin text-[15px] leading-none text-white"
                          >
                            +
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-[14px] font-medium text-ink">
                                {r.term}
                              </span>
                              <span
                                className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-medium ${pick.tone}`}
                              >
                                {pick.label}
                              </span>
                            </span>
                            <span className="mt-1 block text-[12px] leading-snug text-muted">
                              {plainWhy(r, data.business.city)}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : researched.length ? (
                /* Every suggestion has been taken. Saying so beats an
                   empty space that looks like a failed load. */
                <p className="mt-3 rounded-[12px] bg-paper-2 px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
                  You&rsquo;re tracking every phrase we found. Add your own
                  above, or check the competition for tougher ones.
                </p>
              ) : (
                <p className="mt-3 text-[12px] leading-relaxed text-muted">
                  Nothing came back. Add a phrase above, or try the deeper
                  check below.
                </p>
              )}

              {/* Moved below the list and given its consequence. As a bare
                  "check competition" link in the header it sat beside the
                  heading like a tab, gave no hint that it costs time, and
                  competed for attention with the phrases themselves. */}
              {!thinking ? (
                <button
                  type="button"
                  onClick={() => void runResearch(true)}
                  className="mt-4 w-full rounded-[12px] border border-rule px-4 py-3 text-[13px] font-medium text-ink-soft transition-colors hover:border-pin hover:text-pin"
                >
                  Check how strong the competition is
                  <span className="mt-0.5 block text-[11px] font-normal text-muted">
                    Reads the top 3 on the map for each phrase. Takes longer.
                  </span>
                </button>
              ) : null}
            </div>
          </>
        ) : null}

        {tab === "hours" ? (
          <>
            <h1 className="text-[clamp(1.8rem,5vw,2.1rem)]">
              When are you open?
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              Wrong hours are the fastest way to lose a walk-in. Check every
              day.
            </p>

            <ul className="inset-group mt-8">
              {hours.map((row) => (
                <li
                  key={row.day}
                  className="inset-row flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3.5 sm:flex-nowrap"
                >
                  <span className="w-[76px] flex-none text-[14px] font-semibold">
                    {DAYS[row.day]}
                  </span>

                  {row.closed ? (
                    <span className="flex-1 text-[13px] text-muted">
                      closed
                    </span>
                  ) : (
                    <span className="order-last flex w-full items-center gap-1.5 sm:order-none sm:w-auto sm:flex-1">
                      <input
                        type="time"
                        value={row.open ?? "10:00"}
                        onChange={(e) =>
                          patchHour(row.day, { open: e.target.value })
                        }
                        className="min-w-0 flex-1 rounded-[10px] border border-rule bg-white px-2 py-2.5 text-[13px] outline-none focus:border-pin sm:w-[92px] sm:flex-none sm:py-1.5"
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
                        className="min-w-0 flex-1 rounded-[10px] border border-rule bg-white px-2 py-2.5 text-[13px] outline-none focus:border-pin sm:w-[92px] sm:flex-none sm:py-1.5"
                      />
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => patchHour(row.day, { closed: !row.closed })}
                    className="-my-2 ml-auto flex-none py-2 text-[13px] font-medium text-pin hover:opacity-80 sm:ml-0"
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
              What else should people know?
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
          ? "Save hours & next"
          : tab === "attributes"
            ? busy
              ? "saving…"
              : edit
                ? "save changes"
                : "Save & make my website"
            : "Save & next"}
      </button>

      <Link
        href={edit ? "/app/settings" : ONBOARDING_STEPS[4].href}
        className="mt-2 block py-2 text-center text-[13px] font-medium text-pin hover:opacity-80"
      >
        {edit ? "Back to settings without saving the rest" : "Skip the rest of this step"}
      </Link>
    </main>
  );
}
