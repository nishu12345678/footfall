"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { AppScreen, Loading, NeedsConnect } from "@/components/app-shell";
import { Working } from "@/components/working";
import type { Id } from "@/convex/_generated/dataModel";
import { square } from "@/lib/images";

/* The agent puts one item on the listing a day, at 17:00 IST. That makes
   the queue a schedule: the first waiting photo goes up on the next run,
   the second the day after, and so on. We show that rather than a pile. */
const DROP_HOUR_IST = 17;

function nextDropDate(): Date {
  const now = new Date();
  // 17:00 IST is 11:30 UTC.
  const drop = new Date(now);
  drop.setUTCHours(11, 30, 0, 0);
  if (drop.getTime() <= now.getTime()) drop.setUTCDate(drop.getUTCDate() + 1);
  return drop;
}

function mondayOf(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - day);
  return d.getTime();
}

function weekLabel(monday: number): string {
  const thisWeek = mondayOf(new Date());
  const week = 7 * 86_400_000;
  if (monday === thisWeek) return "This week";
  if (monday === thisWeek + week) return "Next week";
  return `Week of ${new Date(monday).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  })}`;
}

function dayLabel(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** Checks a file against Google's stated limits before we upload it. */
async function reject(file: File): Promise<string | null> {
  const isVideo = file.type.startsWith("video/");
  const limitMb = isVideo ? 75 : 5;
  if (file.size > limitMb * 1024 * 1024) {
    return `${file.name} is over ${limitMb}MB.`;
  }

  if (isVideo) {
    const seconds = await new Promise<number>((resolve) => {
      const el = document.createElement("video");
      el.preload = "metadata";
      el.onloadedmetadata = () => resolve(el.duration);
      el.onerror = () => resolve(0);
      el.src = URL.createObjectURL(file);
    });
    if (seconds > 30) {
      return `${file.name} runs ${Math.round(seconds)}s. Google takes 30s or less.`;
    }
    return null;
  }

  if (!/image\/(jpeg|png)$/.test(file.type)) {
    return `${file.name} isn't a JPG or PNG.`;
  }
  if (file.size < 10 * 1024) {
    return `${file.name} is under 10KB, which Google treats as too small.`;
  }

  const size = await new Promise<{ w: number; h: number }>((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = URL.createObjectURL(file);
  });
  if (size.w && Math.min(size.w, size.h) < 250) {
    return `${file.name} is ${size.w}x${size.h}. Google needs at least 250px.`;
  }
  return null;
}

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
  const [showAll, setShowAll] = useState(false);
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

  // Oldest first: that's the order the agent works through them.
  const upcoming = [...queued].sort(
    (a, b) => a._creationTime - b._creationTime,
  );

  const drop = nextDropDate();
  const weeks = new Map<
    number,
    { date: Date; item: (typeof rows)[number] }[]
  >();
  upcoming.forEach((item, i) => {
    const date = new Date(drop);
    date.setDate(date.getDate() + i);
    const monday = mondayOf(date);
    const bucket = weeks.get(monday) ?? [];
    bucket.push({ date, item });
    weeks.set(monday, bucket);
  });

  const shown = showAll ? live : live.slice(0, 9);

  async function upload(files: FileList) {
    setError(null);
    setNote(null);
    const picked = Array.from(files).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
    );
    if (picked.length === 0) {
      setError("Pick photos or videos — JPG, PNG or MP4.");
      return;
    }

    setUploading(picked.length);
    let done = 0;
    try {
      for (const file of picked) {
        const isVideo = file.type.startsWith("video/");
        const problem = await reject(file);
        if (problem) throw new Error(problem);

        const url = await generateUploadUrl({});
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!res.ok) throw new Error(`Upload failed (${res.status}).`);
        const { storageId } = await res.json();
        await savePhoto({
          storageId,
          mediaType: isVideo ? "video" : "photo",
        });
        done += 1;
        setUploading(picked.length - done);
      }
      setNote(
        `${done} added. We'll put one on your listing a day, so the profile never goes quiet.`,
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
      else setError(r.error ?? "Google refused it.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPublishing(null);
    }
  }

  function Tile({
    item,
    className = "",
  }: {
    item: (typeof rows)[number];
    className?: string;
  }) {
    if (item.mediaType === "video") {
      return (
        <video
          src={item.url}
          muted
          playsInline
          preload="metadata"
          className={`aspect-square w-full rounded-[10px] border object-cover ${className}`}
        />
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={square(item.url, 400)}
        alt={item.caption ?? ""}
        loading="lazy"
        referrerPolicy="no-referrer"
        className={`aspect-square w-full rounded-[10px] border object-cover ${className}`}
      />
    );
  }

  return (
    <AppScreen
      name={business.orgName}
      location={business.locationName ?? business.city}
      logoUrl={business.logoUrl}
    >
      <h1 className="text-[1.6rem]">photos</h1>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
        Add everything once. We put one up a day so your listing always looks
        like a shop someone is running.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,video/mp4,image/*,video/*"
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
          : "add photos and videos"}
      </button>

      {/* ------------------------------ why ------------------------------ */}
      <details className="group mt-3 rounded-[14px] border border-rule bg-paper-2">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[14px] font-semibold">
          Why publish photos and videos?
          <span
            aria-hidden
            className="flex-none font-mono text-[11px] text-muted transition-transform group-open:rotate-90"
          >
            ›
          </span>
        </summary>
        <ul className="space-y-2.5 border-t border-rule-soft px-4 py-3.5">
          {[
            [
              "People trust a business they can see",
              "A listing with photos gets far more calls and direction requests than one without.",
            ],
            [
              "An active profile ranks higher",
              "Google reads regular uploads as a sign the business is being run. Thirty photos with a few added this month beat a hundred added years ago.",
            ],
            [
              "Upload in bulk and forget",
              "Add everything you have in one go. We space them out for you.",
            ],
            [
              "Your profile stays active",
              "One a day, every day, without you opening the app.",
            ],
          ].map(([title, detail]) => (
            <li key={title} className="flex gap-2.5">
              <span
                aria-hidden
                className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-open"
              />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold leading-snug">
                  {title}
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-soft">
                  {detail}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </details>

      {syncing ? (
        <div className="mt-4">
          <Working label="Reading what's already on your listing" />
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

      {/* ------------------------ your photos ---------------------------- */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[15px] font-bold">
            Your photos and videos
          </h2>
          {live.length > 9 ? (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              className="flex-none font-mono text-[10px] underline underline-offset-4 hover:text-pin"
            >
              {showAll ? "show less" : `view all ${live.length}`}
            </button>
          ) : (
            <span className="flex-none font-mono text-[10px] text-muted">
              {live.length} live
            </span>
          )}
        </div>

        {live.length === 0 ? (
          <p className="mt-3 rounded-[14px] border border-dashed border-rule px-4 py-8 text-center text-[13px] leading-relaxed text-muted">
            {syncing
              ? "Checking…"
              : "Nothing on your listing yet. Photos are one of the first things a customer looks at."}
          </p>
        ) : (
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {shown.map((item) => (
              <li key={item._id}>
                <Tile item={item} className="border-rule" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --------------------------- scheduled --------------------------- */}
      <section className="mt-8">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-[15px] font-bold">
            Scheduled photos and videos
          </h2>
          <span className="flex-none font-mono text-[10px] text-muted">
            {upcoming.length} waiting
          </span>
        </div>

        {upcoming.length === 0 ? (
          <p className="mt-3 rounded-[14px] border border-dashed border-rule px-4 py-8 text-center text-[13px] leading-relaxed text-muted">
            Nothing scheduled. Add a batch and we&rsquo;ll spread them out, one
            a day.
          </p>
        ) : (
          <div className="mt-3 space-y-5">
            {[...weeks.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([monday, items]) => (
                <div key={monday}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                      {weekLabel(monday)}
                    </p>
                    <p className="flex-none font-mono text-[10px] text-muted">
                      {items.length} going up
                    </p>
                  </div>

                  <ul className="mt-2 divide-y divide-rule-soft border-y border-rule">
                    {items.map(({ date, item }) => (
                      <li
                        key={item._id}
                        className="flex items-center gap-3 py-2.5"
                      >
                        <span className="w-16 flex-none">
                          <Tile item={item} className="border-ink" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold leading-snug">
                            {dayLabel(date)}
                          </span>
                          <span className="mt-0.5 block font-mono text-[10px] text-muted">
                            {item.mediaType === "video" ? "video" : "photo"} ·{" "}
                            {DROP_HOUR_IST}:00
                          </span>
                          <button
                            type="button"
                            onClick={() => void publishNow(item._id)}
                            disabled={publishing !== null}
                            className="mt-1 font-mono text-[10px] underline underline-offset-4 hover:text-pin disabled:opacity-50"
                          >
                            {publishing === item._id
                              ? "sending…"
                              : "post it now"}
                          </button>
                        </span>
                        <button
                          type="button"
                          onClick={() => void removePhoto({ id: item._id })}
                          aria-label="remove"
                          className="grid h-6 w-6 flex-none place-items-center rounded-full border border-rule font-mono text-[12px] text-muted hover:border-pin hover:text-pin"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        )}
      </section>

      {failed.length > 0 ? (
        <section className="mt-8">
          <h2 className="font-display text-[15px] font-bold text-pin">
            Google wouldn&rsquo;t take these
          </h2>
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {failed.map((item) => (
              <li key={item._id}>
                <Tile item={item} className="border-pin opacity-60" />
                <button
                  type="button"
                  onClick={() => void publishNow(item._id)}
                  className="mt-1 w-full font-mono text-[9px] underline underline-offset-2 hover:text-pin"
                >
                  try again
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* -------------------------- guidelines --------------------------- */}
      <details className="group mt-8 rounded-[14px] border border-rule bg-paper-2">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[14px] font-semibold">
          What Google accepts
          <span
            aria-hidden
            className="flex-none font-mono text-[11px] text-muted transition-transform group-open:rotate-90"
          >
            ›
          </span>
        </summary>
        <div className="space-y-3.5 border-t border-rule-soft px-4 py-3.5">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Photos
            </p>
            <ul className="mt-1.5 space-y-1 text-[13px] leading-relaxed">
              <li>JPG or PNG</li>
              <li>At least 250 px on the shorter side, 720 px preferred</li>
              <li>Between 10 KB and 5 MB</li>
            </ul>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
              Videos
            </p>
            <ul className="mt-1.5 space-y-1 text-[13px] leading-relaxed">
              <li>Under 30 seconds</li>
              <li>720p HD or better</li>
              <li>Up to 75 MB</li>
            </ul>
          </div>
          <p className="text-[12.5px] leading-relaxed text-ink-soft">
            Google also asks that the picture be in focus, well lit and
            unfiltered &mdash; it should look like the place really looks.
          </p>
        </div>
      </details>
    </AppScreen>
  );
}
