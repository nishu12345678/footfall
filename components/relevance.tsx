"use client";

import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { friendlyError } from "@/lib/errors";

/**
 * Relevance is the first of Google's three local ranking factors, and it is
 * the only one a shop can change today: the category it picks, and the
 * services it lists. This panel shows what the listing says, what the shops
 * ranking above it say, and the gap between the two.
 */
export function Relevance() {
  const data = useQuery(api.lists.relevance);
  const pushServices = useAction(api.google.pushServices);

  const [pushing, setPushing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!data) return null;

  const {
    primaryCategory,
    extraCategories,
    missingCategories,
    competitorsChecked,
    offeringCount,
    servicesPushedAt,
  } = data;

  async function push() {
    setPushing(true);
    setNote(null);
    setError(null);
    try {
      const r = await pushServices({});
      if (r.error) setError(r.error);
      else setNote(`${r.pushed} services written to your Google listing.`);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setPushing(false);
    }
  }

  return (
    <section className="mt-10">
      <h2 className="font-display text-[15px] font-bold">
        What Google thinks you do
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
        Google matches searches to your category and services before anything
        else. This is what your listing currently claims.
      </p>

      <div className="mt-4 rounded-[16px] bg-paper-2 p-5">
        <p className="text-[13px] font-medium text-muted">
          Main category
        </p>
        <p className="mt-1 text-[15px] font-semibold">
          {primaryCategory ?? "Not set on Google"}
        </p>

        {extraCategories.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {extraCategories.map((c) => (
              <li
                key={c.id}
                className="rounded-full bg-paper-3 px-2 py-0.5 text-[11px] font-medium"
              >
                {c.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[13px] leading-snug text-muted">
            No extra categories. Google lets you add up to nine, and each one is
            a search you become eligible for.
          </p>
        )}
      </div>

      {missingCategories.length > 0 ? (
        <div className="mt-4 rounded-[16px] bg-pin-soft p-5">
          <p className="text-[13px] font-semibold leading-snug">
            Shops ahead of you claim categories you don&rsquo;t
          </p>
          <ul className="mt-3 divide-y divide-black/10">
            {missingCategories.map((c) => (
              <li key={c.name} className="flex items-baseline gap-3 py-2">
                <span className="min-w-0 flex-1 text-[14px]">{c.name}</span>
                <span className="flex-none text-[11px] font-medium text-muted">
                  {c.used} of {competitorsChecked}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-soft">
            Add the ones you actually do, in Google Business Profile &rarr; Edit
            profile &rarr; Category. Never claim work you don&rsquo;t do: Google
            suspends listings for it.
          </p>
        </div>
      ) : competitorsChecked > 0 ? (
        <p className="mt-4 rounded-[12px] bg-open-soft px-4 py-3 text-[13px] leading-snug text-open-deep">
          Your categories match the shops ranking around you.
        </p>
      ) : null}

      {/* services */}
      <div className="mt-4 rounded-[16px] bg-paper-2 p-5">
        <p className="text-[13px] font-semibold leading-snug">
          Your services on Google
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
          {servicesPushedAt
            ? `${offeringCount} services sent on ${new Date(servicesPushedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}. We keep them in step every week.`
            : `You told us ${offeringCount} things you do. Google can list every one of them, and each is a phrase you can match.`}
        </p>

        <button
          type="button"
          onClick={() => void push()}
          disabled={pushing || offeringCount === 0}
          className="btn btn-primary mt-3 w-full disabled:opacity-40"
        >
          {pushing
            ? "sending…"
            : servicesPushedAt
              ? "send them again"
              : "put my services on Google"}
        </button>

        {note ? (
          <p className="mt-3 rounded-[12px] bg-open-soft px-3.5 py-2.5 text-[13px] leading-snug text-open-deep">
            {note}
          </p>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mt-3 break-words rounded-[12px] bg-pin-soft px-3.5 py-2.5 text-[13px] leading-snug"
          >
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
