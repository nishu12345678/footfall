"use client";

import { useAction, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { AppScreen, Loading, NeedsConnect } from "@/components/app-shell";
import { Working } from "@/components/working";
import { square } from "@/lib/images";

function ago(timestamp: number): string {
  const days = Math.floor((Date.now() - timestamp) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function Stars({ rating }: { rating: number }) {
  return (
    <span
      aria-label={`${rating} out of 5`}
      className="flex-none font-mono text-[11px] tracking-tight text-star"
    >
      {"★".repeat(rating)}
      <span className="text-rule">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export default function ReviewsPage() {
  const data = useQuery(api.lists.reviews);
  const syncFromGoogle = useAction(api.reviews.syncFromGoogle);

  const pulled = useRef(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reviews are the thing the owner most wants to be current. Fetch on open.
  useEffect(() => {
    if (!data || pulled.current) return;
    pulled.current = true;
    setSyncing(true);
    void syncFromGoogle({})
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setSyncing(false));
  }, [data, syncFromGoogle]);

  if (data === undefined) return <Loading />;
  if (data === null) return <NeedsConnect />;

  const { business, rows, summary } = data;

  return (
    <AppScreen
      name={business.orgName}
      location={business.locationName ?? business.city}
      logoUrl={business.logoUrl}
    >
      <h1 className="text-[1.6rem]">reviews</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        Every review on your Google listing, newest first.
      </p>

      {/* --------------------------- summary ---------------------------- */}
      <div className="mt-5 rounded-[14px] border border-ink bg-paper-2 p-4 shadow-[3px_3px_0_var(--color-ink)]">
        <div className="flex items-end gap-4">
          <div>
            <p className="font-display text-[2rem] font-bold leading-none">
              {summary.average ?? "—"}
            </p>
            <div className="mt-1.5">
              <Stars rating={Math.round(summary.average ?? 0)} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold leading-snug">
              {summary.total} review{summary.total === 1 ? "" : "s"}
            </p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted">
              {summary.fiveStar} at five stars
              {summary.lowRated > 0
                ? ` · ${summary.lowRated} at three or below`
                : ""}
            </p>
            {summary.newest ? (
              <p className="mt-0.5 font-mono text-[10px] text-muted">
                last one {ago(summary.newest)}
              </p>
            ) : null}
          </div>
        </div>

        {summary.total > 0 ? (
          <p
            className={`mt-3.5 rounded-[10px] border px-3 py-2 text-[12.5px] leading-snug ${
              summary.awaiting === 0
                ? "border-open bg-open-soft"
                : "border-star bg-star/20"
            }`}
          >
            {summary.awaiting === 0
              ? "Every review has a reply. Google reads replies, and so does the next customer."
              : `${summary.awaiting} still without a reply. Replying is the cheapest trust signal you have.`}
          </p>
        ) : null}
      </div>

      {syncing ? (
        <div className="mt-4">
          <Working label="Reading your reviews from Google" />
        </div>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-4 break-words rounded-[12px] border border-pin bg-pin-soft px-3.5 py-2.5 font-mono text-[12px] leading-snug"
        >
          {error}
        </p>
      ) : null}

      {/* ---------------------------- the list --------------------------- */}
      {rows.length === 0 ? (
        <p className="mt-6 rounded-[14px] border border-dashed border-rule px-4 py-10 text-center text-[13px] leading-relaxed text-muted">
          {syncing
            ? "Checking…"
            : "Nothing on your listing yet. The first few reviews move a new listing more than anything else you can do."}
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((row) => (
            <li
              key={row._id}
              className="rounded-[14px] border border-rule bg-paper-2 p-4"
            >
              <div className="flex items-center gap-2.5">
                {row.authorPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={square(row.authorPhoto, 64)}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 flex-none rounded-full border border-rule object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="grid h-8 w-8 flex-none place-items-center rounded-full border border-rule font-display text-[13px] font-bold"
                  >
                    {(row.authorName ?? "?").slice(0, 1).toUpperCase()}
                  </span>
                )}

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold leading-tight">
                    {row.authorName ?? "A customer"}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <Stars rating={row.rating} />
                    <span className="font-mono text-[10px] text-muted">
                      {ago(row.createdAt)}
                    </span>
                  </span>
                </span>
              </div>

              {row.comment ? (
                <p className="mt-2.5 whitespace-pre-wrap text-[13.5px] leading-relaxed">
                  {row.comment}
                </p>
              ) : (
                <p className="mt-2.5 text-[13px] italic leading-relaxed text-muted">
                  Rating only — they didn&rsquo;t write anything.
                </p>
              )}

              {row.replyText ? (
                <div className="mt-3 rounded-[10px] border-l-2 border-open bg-paper px-3 py-2">
                  <p className="font-mono text-[9px] uppercase tracking-wider text-muted">
                    Your reply
                    {row.repliedAt ? ` · ${ago(row.repliedAt)}` : ""}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">
                    {row.replyText}
                  </p>
                </div>
              ) : (
                <p className="mt-3 font-mono text-[10px] text-muted">
                  No reply yet.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {summary.total > rows.length ? (
        <p className="mt-4 text-center font-mono text-[10px] text-muted">
          Showing the newest {rows.length} of {summary.total}.
        </p>
      ) : null}
    </AppScreen>
  );
}
