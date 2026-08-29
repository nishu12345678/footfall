"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import { AppScreen, Loading, NeedsConnect } from "@/components/app-shell";
import type { Id } from "@/convex/_generated/dataModel";

export default function PostsPage() {
  const data = useQuery(api.lists.posts);
  const writePost = useAction(api.posts.writePost);
  const publishPost = useAction(api.posts.publishPost);
  const updateDraft = useMutation(api.posts.updateDraft);
  const removePost = useMutation(api.posts.removePost);

  const [brief, setBrief] = useState("");
  const [writing, setWriting] = useState(false);
  const [publishing, setPublishing] = useState<Id<"posts"> | null>(null);
  const [editing, setEditing] = useState<Id<"posts"> | null>(null);
  const [editText, setEditText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  if (data === undefined) return <Loading />;
  if (data === null) return <NeedsConnect />;

  const { business, rows } = data;
  const drafts = rows.filter((p) => p.status !== "published");
  const published = rows.filter((p) => p.status === "published");

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

  return (
    <AppScreen
      name={business.orgName}
      location={business.locationName ?? business.city}
      logoUrl={business.logoUrl}
    >
      <h1 className="text-[1.6rem]">posts</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        Google quietly rewards a listing that&rsquo;s alive. Write one, check
        it, publish it.
      </p>

      <div className="mt-5 rounded-[14px] border border-ink bg-paper-2 p-4 shadow-[3px_4px_0_var(--color-ink)]">
        <label htmlFor="brief" className="eyebrow">
          anything specific? (optional)
        </label>
        <input
          id="brief"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="e.g. monsoon offer on floor tiles"
          className="mt-2 w-full rounded-[12px] border border-rule bg-paper px-3.5 py-2.5 text-[14px] outline-none placeholder:text-muted/50"
        />
        <button
          type="button"
          onClick={() => void write()}
          disabled={writing}
          className="btn btn-primary mt-3 w-full disabled:opacity-40"
        >
          <span aria-hidden>✦</span>
          {writing ? "writing…" : "write a post"}
        </button>
      </div>

      {note ? (
        <p className="mt-4 rounded-[12px] border border-open bg-open-soft px-3.5 py-2.5 text-[13px] leading-snug">
          {note}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-4 break-words rounded-[12px] border border-pin bg-pin-soft px-3.5 py-2.5 font-mono text-[12px] leading-snug"
        >
          {error}
        </p>
      ) : null}

      {drafts.length > 0 ? (
        <section className="mt-7">
          <h2 className="font-display text-[15px] font-bold">
            Ready to publish
          </h2>
          <ul className="mt-3 space-y-3">
            {drafts.map((post) => (
              <li
                key={post._id}
                className="rounded-[14px] border border-ink bg-paper-2 p-4 shadow-[3px_3px_0_var(--color-ink)]"
              >
                {editing === post._id ? (
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={7}
                    className="w-full resize-none rounded-[10px] border border-rule bg-paper p-3 text-[14px] leading-relaxed outline-none"
                  />
                ) : (
                  <p className="whitespace-pre-wrap text-[14px] leading-relaxed">
                    {post.body}
                  </p>
                )}

                {post.status === "failed" && post.error ? (
                  <p className="mt-3 break-words rounded-[10px] border border-pin bg-pin-soft px-3 py-2 font-mono text-[11px] leading-snug">
                    {post.error}
                  </p>
                ) : null}

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
                        className="btn btn-primary btn-sm disabled:opacity-40"
                      >
                        {publishing === post._id
                          ? "publishing…"
                          : "publish to google"}
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
                        className="ml-auto font-mono text-[11px] text-muted underline underline-offset-4 hover:text-pin"
                      >
                        delete
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-7">
        <h2 className="font-display text-[15px] font-bold">
          Published ({published.length})
        </h2>

        {published.length === 0 ? (
          <p className="mt-3 rounded-[14px] border border-dashed border-rule px-4 py-8 text-center text-[13px] leading-relaxed text-muted">
            Nothing on your listing yet. Write one above and publish it.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {published.map((post) => (
              <li
                key={post._id}
                className="rounded-[14px] border border-rule bg-paper-2 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 rounded-full border border-open bg-open-soft px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-open">
                    <span aria-hidden>✓</span> live on google
                  </span>
                  <span className="flex-none font-mono text-[10px] text-muted">
                    {post.publishedAt
                      ? new Date(post.publishedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })
                      : ""}
                  </span>
                </div>
                <p className="mt-2.5 whitespace-pre-wrap text-[14px] leading-relaxed">
                  {post.body}
                </p>
                {business.mapsUri ? (
                  <a
                    href={business.mapsUri}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block font-mono text-[11px] underline underline-offset-4 hover:text-pin"
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
