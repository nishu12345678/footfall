"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Steps } from "@/components/steps";

type Background = "black" | "white";

export default function OthersPage() {
  const data = useQuery(api.branding.get);
  const generateUploadUrl = useMutation(api.branding.generateUploadUrl);
  const saveLogo = useMutation(api.branding.saveLogo);
  const setBackground = useMutation(api.branding.setLogoBackground);
  const finish = useMutation(api.branding.finishOnboarding);
  const findLogos = useAction(api.branding.findLogoCandidates);
  const useLogoFromUrl = useAction(api.branding.useLogoFromUrl);

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [candidates, setCandidates] = useState<string[] | null>(null);
  const [finding, setFinding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (data === undefined) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="font-mono text-[12px] text-muted">loading…</p>
      </main>
    );
  }

  if (data === null) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
        <h1 className="text-[1.8rem]">connect google first</h1>
        <a href="/app/connect" className="btn btn-primary mt-6 w-full">
          connect google
        </a>
      </main>
    );
  }

  const { business } = data;
  const background = (business.logoBackground as Background) ?? "white";
  const headline = data.offerings[0]?.label ?? business.primaryCategory ?? "";

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Pick an image file — a PNG or JPG of your logo.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const url = await generateUploadUrl({});
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error(`Upload failed (${res.status}).`);
      const { storageId } = await res.json();
      await saveLogo({ storageId, background });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  async function findFromWebsite() {
    setFinding(true);
    setError(null);
    try {
      const found = await findLogos({});
      setCandidates(found);
      if (found.length === 0) {
        setError("We couldn't find a logo on your website. Upload one instead.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFinding(false);
    }
  }

  async function pickCandidate(url: string) {
    setUploading(true);
    setError(null);
    try {
      await useLogoFromUrl({ url, background });
      setCandidates(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  async function done() {
    setBusy(true);
    setError(null);
    try {
      await finish({});
      window.location.href = "/app";
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10">
      <Steps current={6} />

      <div className="mt-7 flex-1">
        <h1 className="text-[1.75rem]">your logo</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          We put this on every image we post to your listing, so your posts
          look like yours.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />

        {business.website ? (
          <div className="mt-6 rounded-[14px] border border-ink bg-paper-2 p-4 shadow-[3px_3px_0_var(--color-ink)]">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 font-display text-[14px] font-bold">
                <span aria-hidden className="text-pin">
                  ✦
                </span>
                find it from my website
              </p>
              <button
                type="button"
                onClick={() => void findFromWebsite()}
                disabled={finding || uploading}
                className="font-mono text-[11px] underline underline-offset-4 hover:text-pin disabled:opacity-50"
              >
                {finding ? "looking…" : candidates ? "look again" : "find my logo"}
              </button>
            </div>

            {candidates && candidates.length > 0 ? (
              <>
                <ul className="mt-3 grid grid-cols-4 gap-2">
                  {candidates.map((src) => (
                    <li key={src}>
                      <button
                        type="button"
                        onClick={() => void pickCandidate(src)}
                        disabled={uploading}
                        className="grid aspect-square w-full place-items-center rounded-[10px] border border-rule bg-white p-1.5 transition-colors hover:border-ink disabled:opacity-50"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt=""
                          className="max-h-full max-w-full object-contain"
                        />
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted">
                  tap the one that&rsquo;s yours. some of these will be the
                  website builder&rsquo;s logo, not yours — ignore those.
                </p>
              </>
            ) : (
              <p className="mt-2 text-[13px] leading-relaxed text-muted">
                We&rsquo;ll read {business.website} and show you what we find.
              </p>
            )}
          </div>
        ) : null}

        {business.logoUrl ? (
          <>
            <p className="eyebrow mt-7">background</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {(["black", "white"] as const).map((bg) => (
                <button
                  key={bg}
                  type="button"
                  onClick={() => void setBackground({ background: bg })}
                  aria-pressed={background === bg}
                  className={`rounded-[14px] border-2 p-3 transition-colors ${
                    background === bg ? "border-pin" : "border-rule"
                  }`}
                >
                  <span
                    className={`grid h-20 w-full place-items-center rounded-[10px] border border-ink ${
                      bg === "black" ? "bg-ink" : "bg-white"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={business.logoUrl}
                      alt=""
                      className="max-h-14 max-w-[70%] object-contain"
                    />
                  </span>
                  <span className="mt-2 block text-center font-mono text-[11px] text-muted">
                    {bg} background
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mt-3 font-mono text-[11px] underline underline-offset-4 hover:text-pin"
            >
              {uploading ? "uploading…" : "replace logo"}
            </button>

            <p className="eyebrow mt-8">preview</p>
            <p className="mt-1 font-mono text-[10px] text-muted">
              * image is for representation only
            </p>

            <div className="mt-3 overflow-hidden rounded-[14px] border border-ink shadow-[3px_4px_0_var(--color-ink)]">
              <div className="relative aspect-[4/3] bg-gradient-to-br from-paper-3 via-paper-2 to-paper">
                <span
                  aria-hidden
                  className="absolute left-1/2 top-1/2 h-32 w-32 -translate-x-1/2 -translate-y-[60%] rounded-full bg-open/10"
                />
                <span
                  aria-hidden
                  className="absolute bottom-8 left-1/2 h-8 w-44 -translate-x-1/2 rounded-[50%] bg-ink/10"
                />

                <div className="absolute inset-0 flex flex-col justify-center px-6">
                  <p className="font-display text-[22px] font-bold leading-tight text-ink">
                    {business.orgName}
                  </p>
                  {headline ? (
                    <p className="mt-1 font-display text-[15px] italic text-open">
                      {headline}
                    </p>
                  ) : null}
                  <p className="mt-2 max-w-[62%] text-[11px] leading-snug text-ink-soft">
                    {business.city
                      ? `Visit us in ${business.city}.`
                      : "Visit us today."}{" "}
                    {business.phone ? `Call ${business.phone}` : ""}
                  </p>
                </div>

                <span
                  className={`absolute right-3 top-3 grid h-12 w-12 place-items-center rounded-[10px] border border-ink ${
                    background === "black" ? "bg-ink" : "bg-white"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={business.logoUrl}
                    alt=""
                    className="max-h-8 max-w-[80%] object-contain"
                  />
                </span>
              </div>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="mt-4 flex w-full flex-col items-center gap-2 rounded-[14px] border-2 border-dashed border-rule bg-paper-2 px-6 py-10 transition-colors hover:border-ink disabled:opacity-50"
          >
            <span aria-hidden className="text-[24px]">
              ⬆
            </span>
            <span className="font-display text-[15px] font-semibold">
              {uploading ? "uploading…" : "upload your logo"}
            </span>
            <span className="font-mono text-[10px] text-muted">
              png or jpg · square works best
            </span>
          </button>
        )}

        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-[12px] border border-pin bg-pin-soft px-4 py-3 text-[14px] leading-snug"
          >
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => void done()}
          disabled={busy}
          className="btn btn-ghost disabled:opacity-40"
        >
          not now
        </button>
        <button
          type="button"
          onClick={() => void done()}
          disabled={busy}
          className="btn btn-primary disabled:opacity-40"
        >
          {busy ? "finishing…" : "save & finish"}
        </button>
      </div>
    </main>
  );
}
