"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
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

export default function PostsPage() {
  const data = useQuery(api.lists.posts);
  const writePost = useAction(api.posts.writePost);
  const planPosts = useAction(api.posts.planPosts);
  const ensurePlan = useAction(api.posts.ensurePlan);
  const publishPost = useAction(api.posts.publishPost);
  const updateDraft = useMutation(api.posts.updateDraft);
  const removePost = useMutation(api.posts.removePost);

  const [brief, setBrief] = useState("");
  const [writing, setWriting] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [publishing, setPublishing] = useState<Id<"posts"> | null>(null);
  const [editing, setEditing] = useState<Id<"posts"> | null>(null);
  const [editText, setEditText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [filling, setFilling] = useState(false);
  const asked = useRef(false);

  // A fortnight of posts should already be waiting when the screen opens.
  // Nothing here needs pressing; the list below is for looking at.
  useEffect(() => {
    if (!data || asked.current) return;
    asked.current = true;
    const pending = data.rows.filter((p) => p.status === "scheduled").length;
    if (pending >= 7) return;
    setFilling(true);
    void ensurePlan({ want: 7 })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setFilling(false));
  }, [data, ensurePlan]);

  if (data === undefined) return <Loading />;
  if (data === null) return <NeedsConnect />;

  const { business, rows } = data;
  const scheduled = rows
    .filter((p) => p.status === "scheduled")
    .sort((a, b) => (a.scheduledFor ?? 0) - (b.scheduledFor ?? 0));
  const drafts = rows.filter(
    (p) => p.status === "draft" || p.status === "failed",
  );
  const published = rows
    .filter((p) => p.status === "published")
    .sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));

  async function plan() {
    setPlanning(true);
    setError(null);
    setNote(null);
    try {
      const r = await planPosts({ count: 6 });
      setNote(
        `${r.planned} posts planned and scheduled — three a week for the next fortnight.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPlanning(false);
    }
  }

  async function write() {
    setWriting(true);
    setError(null);
    setNote(null);
    try {
      await writePost({ brief: brief.trim() || undefined });
      setBrief("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWriting(false);
    }
  }

  async function publish(id: Id<"posts">) {
    setPublishing(id);
    setError(null);
    setNote(null);
    try {
      const r = await publishPost({ id });
      if (r.ok) setNote("Published to your Google listing.");
      else setError(r.error ?? "Google refused the post.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(null);
    }
  }

  function PostBody({
    post,
    muted = false,
  }: {
    post: (typeof rows)[number];
    muted?: boolean;
  }) {
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
                <span
                  aria-hidden
                  className="mt-px flex-none text-[10px] font-medium"
                >
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
          <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">
            {post.body}
          </p>
        )}
      </>
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
        This runs by itself. Three posts a week, on weekdays, planned a
        fortnight ahead and topped up every Sunday. You don&rsquo;t need to do
        anything — everything below is just so you can see what&rsquo;s coming
        and change it if you want.
      </p>

      <div className="mt-6 rounded-[12px] bg-open-soft px-4 py-3.5">
        <p className="flex items-center gap-2 text-[13px] font-semibold">
          <span
            aria-hidden
            className="h-1.5 w-1.5 flex-none rounded-full bg-open"
          />
          {business.agentActive
            ? "Posting automatically · Mon, Wed and Fri"
            : "Paused — turn the agent on to start posting"}
        </p>
        <p className="mt-1 text-[12px] leading-snug text-ink-soft">
          Google posts fade after about a week, so three a week keeps the
          listing active. Posting daily pushes your best content down.
        </p>
      </div>

      {planning ? (
        <div className="mt-5">
          <Working label="Working out what to post about" />
        </div>
      ) : null}

      {note ? (
        <p className="mt-5 rounded-[12px] bg-open-soft px-4 py-3 text-[13px] leading-snug">
          {note}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-5 break-words rounded-[12px] bg-pin-soft px-4 py-3 text-[13px] leading-snug"
        >
          {error}
        </p>
      ) : null}

      {/* ---------------------------- coming up --------------------------- */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-ink">Coming up</h2>
          <span className="flex-none text-[11px] text-muted">
            {scheduled.length} written{filling ? " · adding more" : ""}
          </span>
        </div>

        {scheduled.length === 0 ? (
          <div className="card mt-4 px-5 py-10 text-center">
            {filling ? (
              <Working label="Writing your next two weeks of posts" />
            ) : (
              <p className="text-[13px] leading-relaxed text-muted">
                Nothing scheduled yet. Finish setup and the plan writes itself.
              </p>
            )}
          </div>
        ) : (
          <ul className="mt-4 space-y-4">
            {scheduled.map((post) => (
              <li
                key={post._id}
                className="card p-5"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="flex-none whitespace-nowrap rounded-full bg-star/15 px-2.5 py-1 text-[11px] font-medium leading-none text-[#8a5a13]">
                    {when(post.scheduledFor)}
                  </span>
                  {post.title ? (
                    <span className="min-w-0 truncate text-[12px] text-muted">
                      {post.title}
                    </span>
                  ) : null}
                </div>

                <PostBody post={post} />

                <div className="mt-4 flex flex-wrap gap-2">
                  {editing === post._id ? (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          await updateDraft({ id: post._id, body: editText });
                          setEditing(null);
                        }}
                        className="btn btn-ghost btn-sm"
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
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => void publish(post._id)}
                        disabled={publishing !== null}
                        className="btn btn-ghost btn-sm disabled:opacity-40"
                      >
                        {publishing === post._id
                          ? "publishing…"
                          : "post it now"}
                      </button>
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
                      <button
                        type="button"
                        onClick={() => void removePost({ id: post._id })}
                        className="ml-auto text-[13px] font-medium text-pin hover:opacity-80"
                      >
                        skip this one
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ----------------------------- drafts ----------------------------- */}
      {drafts.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-[15px] font-semibold text-ink">
            Waiting for you
          </h2>
          <ul className="mt-4 space-y-4">
            {drafts.map((post) => (
              <li
                key={post._id}
                className="card p-5"
              >
                <PostBody post={post} />

                {post.status === "failed" && post.error ? (
                  <p className="mt-3 break-words rounded-[12px] bg-pin-soft px-3 py-2 text-[12px] leading-snug">
                    {post.error}
                  </p>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void publish(post._id)}
                    disabled={publishing !== null}
                    className="btn btn-primary btn-sm disabled:opacity-40"
                  >
                    {publishing === post._id ? "publishing…" : "publish now"}
                  </button>
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
                  <button
                    type="button"
                    onClick={() => void removePost({ id: post._id })}
                    className="ml-auto text-[13px] font-medium text-pin hover:opacity-80"
                  >
                    delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---------------------------- published --------------------------- */}
      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-ink">
            On your listing
          </h2>
          <span className="flex-none text-[11px] text-muted">
            {published.length} published
          </span>
        </div>

        {published.length === 0 ? (
          <p className="card mt-4 px-5 py-10 text-center text-[13px] leading-relaxed text-muted">
            Nothing on your listing yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {published.map((post) => (
              <li
                key={post._id}
                className="card p-5"
              >
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

      {/* ------------------------- write one yourself --------------------- */}
      <section className="card mt-10 p-5">
        <button
          type="button"
          onClick={() => void plan()}
          disabled={planning}
          className="btn btn-ghost btn-sm mb-4 w-full disabled:opacity-40"
        >
          {planning ? "researching topics…" : "plan more posts now"}
        </button>

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
          onClick={() => void write()}
          disabled={writing}
          className="btn btn-ghost btn-sm mt-3 w-full disabled:opacity-40"
        >
          {writing ? "writing…" : "write one now"}
        </button>
      </section>
    </AppScreen>
  );
}
