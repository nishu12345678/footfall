"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { AppScreen, Loading, NeedsConnect } from "@/components/app-shell";
import { Working } from "@/components/working";
import { square } from "@/lib/images";
import type { Id } from "@/convex/_generated/dataModel";

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
  const approveReply = useAction(api.reviews.approveReply);
  const rewriteReply = useAction(api.reviews.rewriteReply);
  const discardDraft = useMutation(api.reviews.discardDraft);

  const pulled = useRef(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<Id<"reviews"> | null>(null);
  const [editing, setEditing] = useState<Id<"reviews"> | null>(null);
  const [editText, setEditText] = useState("");

  async function send(id: Id<"reviews">, text?: string) {
    setBusy(id);
    setError(null);
    setNote(null);
    try {
      const r = await approveReply({ id, text });
      if (r.ok) {
        setNote("Reply is live on your listing.");
        setEditing(null);
      } else {
        setError(r.error ?? "Google wouldn't take it.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function rewrite(id: Id<"reviews">) {
    setBusy(id);
    setError(null);
    setNote(null);
    try {
      const text = await rewriteReply({ id });
      if (text && editing === id) setEditText(text);
      if (!text) setError("Couldn't write another one just now.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

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
  const held = rows.filter((r) => r.replyNeedsApproval && r.replyText);

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
          <>
            <div className="mt-3.5 flex gap-2">
              <span className="flex-1 rounded-[10px] border border-rule bg-paper px-3 py-2">
                <span className="block font-display text-[17px] font-bold leading-none">
                  {summary.replyRate ?? 0}%
                </span>
                <span className="mt-1 block font-mono text-[9px] uppercase tracking-wider text-muted">
                  replied
                </span>
              </span>
              <span className="flex-1 rounded-[10px] border border-rule bg-paper px-3 py-2">
                <span className="block font-display text-[17px] font-bold leading-none">
                  {summary.medianReplyHours === null
                    ? "—"
                    : summary.medianReplyHours < 24
                      ? `${summary.medianReplyHours}h`
                      : `${Math.round(summary.medianReplyHours / 24)}d`}
                </span>
                <span className="mt-1 block font-mono text-[9px] uppercase tracking-wider text-muted">
                  typical wait
                </span>
              </span>
            </div>

            <p
              className={`mt-2.5 rounded-[10px] border px-3 py-2 text-[12.5px] leading-snug ${
                summary.awaiting === 0
                  ? "border-open bg-open-soft"
                  : "border-star bg-star/20"
              }`}
            >
              {summary.awaiting === 0
                ? "Every review has a reply. We answer new ones within a few hours, on their own."
                : `${summary.awaiting} still without a reply. Four stars and up we answer automatically; anything lower waits for you.`}
            </p>
          </>
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

      {note ? (
        <p className="mt-4 rounded-[12px] border border-open bg-open-soft px-3.5 py-2.5 text-[13px] leading-snug">
          {note}
        </p>
      ) : null}

      {/* ------------------------ waiting for you ------------------------ */}
      {held.length > 0 ? (
        <section className="mt-7">
          <h2 className="font-display text-[15px] font-bold">
            Waiting for you to send
          </h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">
            We&rsquo;ve written a reply to each of these. A low rating goes out
            under your name only when you say so.
          </p>

          <ul className="mt-3 space-y-3">
            {held.map((row) => (
              <li
                key={row._id}
                className="rounded-[14px] border border-ink bg-paper-2 p-4 shadow-[3px_3px_0_var(--color-ink)]"
              >
                <div className="flex items-center gap-2">
                  <Stars rating={row.rating} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
                    {row.authorName ?? "A customer"}
                  </span>
                  <span className="flex-none font-mono text-[10px] text-muted">
                    {ago(row.createdAt)}
                  </span>
                </div>

                {row.comment ? (
                  <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">
                    {row.comment}
                  </p>
                ) : null}

                {editing === row._id ? (
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={6}
                    className="mt-3 w-full resize-none rounded-[10px] border border-ink bg-paper p-3 text-[13px] leading-relaxed outline-none"
                  />
                ) : (
                  <p className="mt-3 whitespace-pre-wrap rounded-[10px] border-l-2 border-star bg-paper px-3 py-2 text-[13px] leading-relaxed">
                    {row.replyText}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void send(
                        row._id,
                        editing === row._id ? editText : undefined,
                      )
                    }
                    disabled={busy !== null}
                    className="btn btn-primary btn-sm disabled:opacity-40"
                  >
                    {busy === row._id ? "sending…" : "send it"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(row._id);
                      setEditText(row.replyText ?? "");
                    }}
                    className="btn btn-ghost btn-sm"
                  >
                    edit
                  </button>
                  <button
                    type="button"
                    onClick={() => void rewrite(row._id)}
                    disabled={busy !== null}
                    className="btn btn-ghost btn-sm disabled:opacity-40"
                  >
                    write another
                  </button>
                  <button
                    type="button"
                    onClick={() => void discardDraft({ id: row._id })}
                    className="ml-auto font-mono text-[10px] text-muted underline underline-offset-4 hover:text-pin"
                  >
                    leave it
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
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
              ) : row.replyError ? (
                <p className="mt-3 break-words rounded-[10px] border border-pin bg-pin-soft px-3 py-2 font-mono text-[10px] leading-snug">
                  {row.replyError}
                </p>
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
