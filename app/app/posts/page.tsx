"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { AppScreen, Loading, NeedsConnect } from "@/components/app-shell";
import { Working } from "@/components/working";
import type { Id } from "@/convex/_generated/dataModel";
import { thumb } from "@/lib/images";

function when(timestamp?: number) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const days = Math.round((timestamp - Date.now()) / 86_400_000);
  const label = date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  if (days <= 0) return `${label} · due`;
  if (days === 1) return `${label} · tomorrow`;
  return `${label} · in ${days} days`;
}

/** "2026-09-09T10:30" in local time, for <input type="datetime-local">. */
function localInputValue(ms: number) {
  const d = new Date(ms - new Date().getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}

type Post = {
  _id: Id<"posts">;
  title?: string;
  body: string;
  imageUrl?: string;
  imageSource?: string;
  imageNote?: string;
  status: string;
  scheduledFor?: number;
  publishedAt?: number;
  error?: string;
  approvedAt?: number;
};

export default function PostsPage() {
  const data = useQuery(api.lists.posts);
  const run = useQuery(api.posts.generationStatus);

  const startGeneration = useMutation(api.posts.startGeneration);
  const stopGeneration = useMutation(api.posts.stopGeneration);
  const approvePost = useMutation(api.posts.approvePost);
  const unapprovePost = useMutation(api.posts.unapprovePost);
  const schedulePost = useMutation(api.posts.schedulePost);
  const unschedulePost = useMutation(api.posts.unschedulePost);
  const publishPost = useAction(api.posts.publishPost);
  const updateDraft = useMutation(api.posts.updateDraft);
  const removePost = useMutation(api.posts.removePost);

  const [brief, setBrief] = useState("");
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [acting, setActing] = useState<Id<"posts"> | null>(null);
  const [editing, setEditing] = useState<Id<"posts"> | null>(null);
  const [editText, setEditText] = useState("");
  const [picking, setPicking] = useState<Id<"posts"> | null>(null);
  const [pickAt, setPickAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const generating = run?.status === "running";
  const stoppingNow = generating && (stopping || Boolean(run?.stopping));

  // What the last run came to. `generationStatus` keeps a finished run
  // around for a minute and a half, so this says its piece and goes.
  const runNote =
    run && run.status !== "running"
      ? run.status === "done"
        ? run.produced === 1
          ? "1 post written. Read it below and approve it when you're happy."
          : `${run.produced} posts written. Read them below and approve the ones you like.${run.error ? ` (${run.error})` : ""}`
        : run.status === "cancelled"
          ? run.produced > 0
            ? `Stopped. ${run.produced} post${run.produced === 1 ? "" : "s"} had already been written — they're below.`
            : "Stopped before anything was written."
          : null
      : null;
  const runError =
    run && run.status === "timed_out"
      ? "Generating took too long and was stopped. Anything written is below; try again for the rest."
      : run && run.status === "failed"
        ? (run.error ?? "Couldn't write posts just now. Try again.")
        : null;

  if (data === undefined) return <Loading />;
  if (data === null) return <NeedsConnect />;

  const { business, rows } = data;
  const posts = rows as Post[];
  const drafts = posts.filter((p) => p.status === "draft" || p.status === "failed");
  const approved = posts.filter((p) => p.status === "approved");
  const scheduled = posts
    .filter((p) => p.status === "scheduled")
    .sort((a, b) => (a.scheduledFor ?? 0) - (b.scheduledFor ?? 0));
  const published = posts
    .filter((p) => p.status === "published")
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));

  async function withPost(id: Id<"posts">, fn: () => Promise<string | void>) {
    if (acting) return;
    setActing(id);
    setError(null);
    setNote(null);
    try {
      const msg = await fn();
      if (msg) setNote(msg);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActing(null);
    }
  }

  async function generate(mode: "plan" | "single") {
    if (starting || generating) return;
    setStarting(true);
    setError(null);
    setNote(null);
    try {
      await startGeneration({
        mode,
        count: mode === "plan" ? 6 : undefined,
        brief: mode === "single" ? brief.trim() || undefined : undefined,
      });
      if (mode === "single") setBrief("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  }

  async function stop() {
    if (!run || stopping) return;
    setStopping(true);
    try {
      await stopGeneration({ id: run.id });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStopping(false);
    }
  }

  function PostBody({ post, muted = false }: { post: Post; muted?: boolean }) {
    return (
      <>
        {post.imageUrl && editing !== post._id ? (
          <figure className="mb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumb(post.imageUrl, 800)}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              className={`aspect-[4/3] w-full rounded-[12px] object-cover ${
                muted ? "opacity-90" : ""
              }`}
            />
            {post.imageNote ? (
              <figcaption className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-snug text-muted">
                <span aria-hidden className="mt-px flex-none text-[10px] font-medium">
                  {post.imageSource === "listing" ? "yours" : "made"}
                </span>
                <span className="min-w-0">{post.imageNote}</span>
              </figcaption>
            ) : null}
          </figure>
        ) : null}

        {editing === post._id ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={12}
            className="w-full resize-none rounded-[12px] border border-rule bg-white p-3 text-[13px] leading-relaxed outline-none focus:border-pin"
          />
        ) : (
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{post.body}</p>
        )}
      </>
    );
  }

  function EditButtons({ post }: { post: Post }) {
    if (editing === post._id) {
      return (
        <>
          <button
            type="button"
            disabled={acting !== null}
            onClick={() =>
              void withPost(post._id, async () => {
                await updateDraft({ id: post._id, body: editText });
                setEditing(null);
              })
            }
            className="btn btn-primary btn-sm disabled:opacity-40"
          >
            save
          </button>
          <button
            type="button"
            onClick={() => setEditing(null)}
            className="btn btn-ghost btn-sm"
          >
            cancel
          </button>
        </>
      );
    }
    return (
      <button
        type="button"
        onClick={() => {
          setEditing(post._id);
          setEditText(post.body);
        }}
        className="btn btn-ghost btn-sm"
      >
        edit
      </button>
    );
  }

  function SchedulePicker({ post }: { post: Post }) {
    if (picking !== post._id) return null;
    return (
      <div className="mt-3 flex flex-wrap items-end gap-2 rounded-[12px] bg-paper-2 p-3">
        <label className="min-w-0 flex-1">
          <span className="eyebrow">pick a time</span>
          <input
            type="datetime-local"
            value={pickAt}
            min={localInputValue(Date.now())}
            onChange={(e) => setPickAt(e.target.value)}
            className="mt-2 w-full rounded-[10px] border border-rule bg-white px-3 py-2 text-[14px] outline-none focus:border-pin"
          />
        </label>
        <button
          type="button"
          disabled={!pickAt || acting !== null}
          onClick={() =>
            void withPost(post._id, async () => {
              const at = new Date(pickAt).getTime();
              const r = await schedulePost({ id: post._id, at });
              setPicking(null);
              return `Scheduled for ${when(r.scheduledFor ?? undefined)}.`;
            })
          }
          className="btn btn-primary btn-sm disabled:opacity-40"
        >
          set
        </button>
        <button type="button" onClick={() => setPicking(null)} className="btn btn-ghost btn-sm">
          cancel
        </button>
      </div>
    );
  }

  return (
    <AppScreen
      name={business.orgName}
      location={business.locationName ?? business.city}
      logoUrl={business.logoUrl}
    >
      <h1 className="text-[clamp(1.8rem,5vw,2.2rem)]">posts</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        We write, you approve. Generate a fortnight of posts, read them,
        approve the ones you like, and give each a slot — or post it right
        away. Nothing goes on your listing without your say-so.
      </p>

      <div className="mt-6 rounded-[12px] bg-open-soft px-4 py-3.5">
        <p className="flex items-center gap-2 text-[13px] font-semibold">
          <span aria-hidden className="h-1.5 w-1.5 flex-none rounded-full bg-open" />
          {business.agentActive
            ? "Scheduled posts go up automatically · Mon, Wed and Fri"
            : "Paused — turn the agent on and scheduled posts will go up"}
        </p>
        <p className="mt-1 text-[12px] leading-snug text-ink-soft">
          Google posts fade after about a week, so three a week keeps the
          listing active. Every Sunday we draft more for you to approve.
        </p>
      </div>

      {/* ---------------------------- generate ---------------------------- */}
      <section className="card mt-6 p-5">
        {generating ? (
          <>
            <Working
              label={
                stoppingNow
                  ? "Stopping after this post"
                  : run.mode === "single"
                    ? "Writing your post"
                    : run.produced === 0
                      ? "Working out what to post about"
                      : `Writing post ${Math.min(run.produced + 1, run.requested)} of ${run.requested}`
              }
            />
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-[12px] text-muted">
                {run.produced} of {run.requested} written
                {run.source === "cron" ? " · started by the weekly plan" : ""}
              </span>
              <button
                type="button"
                onClick={() => void stop()}
                disabled={stoppingNow}
                className="btn btn-ghost btn-sm disabled:opacity-50"
              >
                {stoppingNow ? "stopping…" : "stop generating"}
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void generate("plan")}
              disabled={starting}
              className="btn btn-primary w-full disabled:opacity-40"
            >
              {starting ? "starting…" : "generate the next two weeks of posts"}
            </button>
            <p className="mt-2 text-center text-[12px] text-muted">
              Six posts, each on a different topic, written as drafts for you to approve.
            </p>

            <div className="mt-6">
              <label htmlFor="brief" className="eyebrow">
                want something specific posted?
              </label>
              <input
                id="brief"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder="e.g. we now stock Kajaria tiles"
                className="mt-2 w-full rounded-[12px] border border-rule bg-white px-3.5 py-2.5 text-[16px] outline-none placeholder:text-muted/60 focus:border-pin"
              />
              <button
                type="button"
                onClick={() => void generate("single")}
                disabled={starting}
                className="btn btn-ghost btn-sm mt-3 w-full disabled:opacity-40"
              >
                {starting ? "starting…" : "write one now"}
              </button>
            </div>
          </>
        )}
      </section>

      {note ?? runNote ? (
        <p className="mt-5 rounded-[12px] bg-open-soft px-4 py-3 text-[13px] leading-snug">
          {note ?? runNote}
        </p>
      ) : null}
      {error ?? runError ? (
        <p
          role="alert"
          className="mt-5 break-words rounded-[12px] bg-pin-soft px-4 py-3 text-[13px] leading-snug"
        >
          {error ?? runError}
        </p>
      ) : null}

      {/* ----------------------------- drafts ----------------------------- */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-ink">Waiting for your approval</h2>
          <span className="flex-none text-[11px] text-muted">{drafts.length} to read</span>
        </div>

        {drafts.length === 0 ? (
          <p className="card mt-4 px-5 py-8 text-center text-[13px] leading-relaxed text-muted">
            {generating
              ? "Posts will appear here as they're written."
              : "Nothing to read. Generate some posts above."}
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {drafts.map((post) => (
              <li key={post._id} className="card p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span
                    className={`flex-none whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium leading-none ${
                      post.status === "failed"
                        ? "bg-pin-soft text-pin"
                        : "bg-paper-3 text-ink-soft"
                    }`}
                  >
                    {post.status === "failed" ? "google refused it" : "draft"}
                  </span>
                  {post.title ? (
                    <span className="min-w-0 truncate text-[12px] text-muted">{post.title}</span>
                  ) : null}
                </div>

                <PostBody post={post} />

                {post.status === "failed" && post.error ? (
                  <p className="mt-3 break-words rounded-[12px] bg-pin-soft px-3 py-2 text-[12px] leading-snug">
                    {post.error}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {editing !== post._id ? (
                    <button
                      type="button"
                      disabled={acting !== null}
                      onClick={() =>
                        void withPost(post._id, async () => {
                          await approvePost({ id: post._id });
                          return "Approved. Now give it a slot, or post it now.";
                        })
                      }
                      className="btn btn-primary btn-sm disabled:opacity-40"
                    >
                      {acting === post._id ? "…" : "approve"}
                    </button>
                  ) : null}
                  <EditButtons post={post} />
                  {editing !== post._id ? (
                    <button
                      type="button"
                      disabled={acting !== null}
                      onClick={() =>
                        void withPost(post._id, async () => {
                          await removePost({ id: post._id });
                        })
                      }
                      className="ml-auto text-[13px] font-medium text-pin hover:opacity-80 disabled:opacity-40"
                    >
                      delete
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------------------- approved ---------------------------- */}
      {approved.length > 0 ? (
        <section className="mt-10">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-semibold text-ink">Approved, not yet scheduled</h2>
            <span className="flex-none text-[11px] text-muted">{approved.length}</span>
          </div>
          <ul className="mt-4 space-y-4">
            {approved.map((post) => (
              <li key={post._id} className="card p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="flex-none whitespace-nowrap rounded-full bg-open-soft px-2.5 py-1 text-[11px] font-medium leading-none text-open-deep">
                    ✓ approved
                  </span>
                  {post.title ? (
                    <span className="min-w-0 truncate text-[12px] text-muted">{post.title}</span>
                  ) : null}
                </div>

                <PostBody post={post} />

                <div className="mt-4 flex flex-wrap gap-2">
                  {editing !== post._id ? (
                    <>
                      <button
                        type="button"
                        disabled={acting !== null}
                        onClick={() =>
                          void withPost(post._id, async () => {
                            const r = await schedulePost({ id: post._id });
                            return `Scheduled for ${when(r.scheduledFor ?? undefined)}.`;
                          })
                        }
                        className="btn btn-primary btn-sm disabled:opacity-40"
                      >
                        {acting === post._id ? "…" : "schedule next slot"}
                      </button>
                      <button
                        type="button"
                        disabled={acting !== null}
                        onClick={() => {
                          setPicking(picking === post._id ? null : post._id);
                          setPickAt("");
                        }}
                        className="btn btn-ghost btn-sm disabled:opacity-40"
                      >
                        pick a time
                      </button>
                      <button
                        type="button"
                        disabled={acting !== null}
                        onClick={() =>
                          void withPost(post._id, async () => {
                            const r = await publishPost({ id: post._id });
                            if (!r.ok) throw new Error(r.error ?? "Google refused the post.");
                            return "Published to your Google listing.";
                          })
                        }
                        className="btn btn-ghost btn-sm disabled:opacity-40"
                      >
                        {acting === post._id ? "publishing…" : "post it now"}
                      </button>
                    </>
                  ) : null}
                  <EditButtons post={post} />
                  {editing !== post._id ? (
                    <button
                      type="button"
                      disabled={acting !== null}
                      onClick={() =>
                        void withPost(post._id, async () => {
                          await unapprovePost({ id: post._id });
                        })
                      }
                      className="ml-auto text-[13px] font-medium text-pin hover:opacity-80 disabled:opacity-40"
                    >
                      back to drafts
                    </button>
                  ) : null}
                </div>
                <SchedulePicker post={post} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---------------------------- coming up --------------------------- */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-ink">Coming up</h2>
          <span className="flex-none text-[11px] text-muted">{scheduled.length} scheduled</span>
        </div>

        {scheduled.length === 0 ? (
          <p className="card mt-4 px-5 py-8 text-center text-[13px] leading-relaxed text-muted">
            Nothing scheduled. Approve a post and give it a slot.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {scheduled.map((post) => (
              <li key={post._id} className="card p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="flex-none whitespace-nowrap rounded-full bg-star/15 px-2.5 py-1 text-[11px] font-medium leading-none text-[#8a5a13]">
                    {when(post.scheduledFor)}
                  </span>
                  {post.title ? (
                    <span className="min-w-0 truncate text-[12px] text-muted">{post.title}</span>
                  ) : null}
                </div>

                <PostBody post={post} />

                <div className="mt-4 flex flex-wrap gap-2">
                  {editing !== post._id ? (
                    <>
                      <button
                        type="button"
                        disabled={acting !== null}
                        onClick={() =>
                          void withPost(post._id, async () => {
                            const r = await publishPost({ id: post._id });
                            if (!r.ok) throw new Error(r.error ?? "Google refused the post.");
                            return "Published to your Google listing.";
                          })
                        }
                        className="btn btn-ghost btn-sm disabled:opacity-40"
                      >
                        {acting === post._id ? "publishing…" : "post it now"}
                      </button>
                      <button
                        type="button"
                        disabled={acting !== null}
                        onClick={() => {
                          setPicking(picking === post._id ? null : post._id);
                          setPickAt(post.scheduledFor ? localInputValue(post.scheduledFor) : "");
                        }}
                        className="btn btn-ghost btn-sm disabled:opacity-40"
                      >
                        change time
                      </button>
                    </>
                  ) : null}
                  <EditButtons post={post} />
                  {editing !== post._id ? (
                    <button
                      type="button"
                      disabled={acting !== null}
                      onClick={() =>
                        void withPost(post._id, async () => {
                          await unschedulePost({ id: post._id });
                          return "Taken off the calendar. It's still approved.";
                        })
                      }
                      className="ml-auto text-[13px] font-medium text-pin hover:opacity-80 disabled:opacity-40"
                    >
                      unschedule
                    </button>
                  ) : null}
                </div>
                <SchedulePicker post={post} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------------------- published --------------------------- */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-ink">On your listing</h2>
          <span className="flex-none text-[11px] text-muted">{published.length} published</span>
        </div>

        {published.length === 0 ? (
          <p className="card mt-4 px-5 py-10 text-center text-[13px] leading-relaxed text-muted">
            Nothing on your listing yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {published.map((post) => (
              <li key={post._id} className="card p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 rounded-full bg-open-soft px-2.5 py-0.5 text-[11px] font-medium text-open-deep">
                    <span aria-hidden>✓</span> live
                  </span>
                  <span className="flex-none text-[12px] text-muted">
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })
                      : ""}
                  </span>
                </div>

                <PostBody post={post} muted />

                {business.mapsUri ? (
                  <a
                    href={business.mapsUri}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-[13px] font-medium text-pin hover:opacity-80"
                  >
                    see it on your listing →
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppScreen>
  );
}
