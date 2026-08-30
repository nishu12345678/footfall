"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { AppScreen, Loading, NeedsConnect } from "@/components/app-shell";
import { Working } from "@/components/working";
import type { Id } from "@/convex/_generated/dataModel";
import { thumb } from "@/lib/images";

export default function PhotosPage() {
  const data = useQuery(api.lists.photos);
  const syncFromGoogle = useAction(api.photos.syncFromGoogle);
  const publishPhoto = useAction(api.photos.publishPhoto);
  const generateUploadUrl = useMutation(api.photos.generateUploadUrl);
  const savePhoto = useMutation(api.photos.savePhoto);
  const removePhoto = useMutation(api.photos.removePhoto);

  const fileRef = useRef<HTMLInputElement>(null);
  const synced = useRef(false);
  const [syncing, setSyncing] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [publishing, setPublishing] = useState<Id<"photos"> | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pull what's already on the listing so the owner sees everything at once.
  useEffect(() => {
    if (!data || synced.current) return;
    synced.current = true;
    setSyncing(true);
    void syncFromGoogle({})
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setSyncing(false));
  }, [data, syncFromGoogle]);

  if (data === undefined) return <Loading />;
  if (data === null) return <NeedsConnect />;

  const { business, rows } = data;
  const live = rows.filter((p) => p.status === "published");
  const queued = rows.filter((p) => p.status === "bucket");
  const failed = rows.filter((p) => p.status === "failed");

  async function upload(files: FileList) {
    setError(null);
    setNote(null);
    const images = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) {
      setError("Pick photos — JPG or PNG.");
      return;
    }

    setUploading(images.length);
    let done = 0;
    try {
      for (const file of images) {
        const url = await generateUploadUrl({});
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error(`Upload failed (${res.status}).`);
        const { storageId } = await res.json();
        await savePhoto({ storageId });
        done += 1;
        setUploading(images.length - done);
      }
      setNote(
        `${done} photo${done === 1 ? "" : "s"} added. We'll put one on your listing a day.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(0);
    }
  }

  async function publishNow(id: Id<"photos">) {
    setPublishing(id);
    setError(null);
    setNote(null);
    try {
      const r = await publishPhoto({ id });
      if (r.ok) setNote("Published to your Google listing.");
      else setError(r.error ?? "Google refused the photo.");
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
      <h1 className="text-[1.6rem]">photos</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        A listing with new photos looks like a shop someone is running. Add
        yours and we&rsquo;ll put one up a day, so it never goes stale.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void upload(e.target.files);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading > 0}
        className="btn btn-primary mt-5 w-full disabled:opacity-40"
      >
        {uploading > 0
          ? `uploading… ${uploading} left`
          : "add photos from your phone"}
      </button>

      {syncing ? (
        <div className="mt-4">
          <Working label="Reading the photos already on your listing" />
        </div>
      ) : null}

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

      {/* waiting to go up */}
      <section className="mt-7">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[15px] font-bold">
            Waiting to go up
          </h2>
          <span className="flex-none font-mono text-[10px] text-muted">
            {queued.length} queued
          </span>
        </div>

        {queued.length === 0 ? (
          <p className="mt-3 rounded-[14px] border border-dashed border-rule px-4 py-8 text-center text-[13px] leading-relaxed text-muted">
            Nothing waiting. Add a few photos and we&rsquo;ll drip them onto
            your listing.
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {queued.map((photo) => (
              <li key={photo._id} className="relative">
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb(photo.url, 400)}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="aspect-square w-full rounded-[10px] border border-ink object-cover"
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => void removePhoto({ id: photo._id })}
                  aria-label="remove photo"
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full border border-ink bg-paper-2 font-mono text-[11px]"
                >
                  ×
                </button>
                <button
                  type="button"
                  onClick={() => void publishNow(photo._id)}
                  disabled={publishing !== null}
                  className="mt-1 w-full font-mono text-[9px] underline underline-offset-2 hover:text-pin disabled:opacity-50"
                >
                  {publishing === photo._id ? "sending…" : "post now"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* already on google */}
      <section className="mt-7">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[15px] font-bold">On your listing</h2>
          <span className="flex-none font-mono text-[10px] text-muted">
            {live.length} live
          </span>
        </div>

        {live.length === 0 ? (
          <p className="mt-3 rounded-[14px] border border-dashed border-rule px-4 py-8 text-center text-[13px] leading-relaxed text-muted">
            {syncing
              ? "Checking…"
              : "No photos on your Google listing yet. That's one of the first things customers look for."}
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {live.map((photo) => (
              <li key={photo._id}>
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb(photo.url, 400)}
                    alt={photo.caption ?? ""}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="aspect-square w-full rounded-[10px] border border-rule object-cover"
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {failed.length > 0 ? (
        <section className="mt-7">
          <h2 className="font-display text-[15px] font-bold text-pin">
            Google wouldn&rsquo;t take these
          </h2>
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {failed.map((photo) => (
              <li key={photo._id}>
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb(photo.url, 400)}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="aspect-square w-full rounded-[10px] border border-pin object-cover opacity-60"
                  />
                ) : null}
                <button
                  type="button"
                  onClick={() => void publishNow(photo._id)}
                  className="mt-1 w-full font-mono text-[9px] underline underline-offset-2 hover:text-pin"
                >
                  try again
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AppScreen>
  );
}
