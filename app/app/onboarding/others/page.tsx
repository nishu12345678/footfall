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
        <p className="text-[13px] text-muted">loading…</p>
      </main>
    );
  }

  if (data === null) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6">
        <h1 className="text-[clamp(1.8rem,5vw,2.2rem)]">connect google first</h1>
        <a href="/app/connect" className="btn btn-primary mt-8 w-full">
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
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col px-6 py-12">
      <Steps current={6} />

      <div className="mt-9 flex-1">
        <h1 className="text-[clamp(1.8rem,5vw,2.1rem)]">your logo</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
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
          <div className="card mt-8 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="flex items-center gap-1.5 text-[15px] font-semibold text-ink">
                <span aria-hidden className="text-pin">
                  ✦
                </span>
                find it from my website
              </p>
              <button
                type="button"
                onClick={() => void findFromWebsite()}
                disabled={finding || uploading}
                className="text-[13px] font-medium text-pin hover:opacity-80 disabled:opacity-50"
              >
                {finding ? "looking…" : candidates ? "look again" : "find my logo"}
              </button>
            </div>

            {candidates && candidates.length > 0 ? (
              <>
                <ul className="mt-4 grid grid-cols-4 gap-2.5">
                  {candidates.map((src) => (
                    <li key={src}>
                      <button
                        type="button"
                        onClick={() => void pickCandidate(src)}
                        disabled={uploading}
                        className="pressable grid aspect-square w-full place-items-center rounded-[12px] bg-paper-2 p-1.5 transition-colors hover:bg-paper-3 disabled:opacity-50"
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
                <p className="mt-2 text-[12px] leading-relaxed text-muted">
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
            <p className="eyebrow mt-9">background</p>
            <div className="mt-4 grid grid-cols-2 gap-4">
              {(["black", "white"] as const).map((bg) => (
                <button
                  key={bg}
                  type="button"
                  onClick={() => void setBackground({ background: bg })}
                  aria-pressed={background === bg}
                  className={`pressable rounded-[14px] p-4 transition-colors ${
                    background === bg ? "bg-pin-soft" : "bg-paper-2"
                  }`}
                >
                  <span
                    className={`grid h-20 w-full place-items-center rounded-[10px] shadow-card ${
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
                  <span
                    className={`mt-2 block text-center text-[12px] font-medium ${
                      background === bg ? "text-pin" : "text-muted"
                    }`}
                  >
                    {bg} background
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mt-4 text-[13px] font-medium text-pin hover:opacity-80"
            >
              {uploading ? "uploading…" : "replace logo"}
            </button>

            <p className="eyebrow mt-10">preview</p>
            <p className="mt-1.5 text-[11px] text-muted">
              * image is for representation only
            </p>

            <div className="window mt-4">
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
                  <p className="text-[22px] font-bold leading-tight tracking-[-0.02em] text-ink">
                    {business.orgName}
                  </p>
                  {headline ? (
                    <p className="mt-1 text-[15px] italic text-open-deep">
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
                  className={`absolute right-3 top-3 grid h-12 w-12 place-items-center rounded-[10px] shadow-card ${
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
            className="pressable mt-6 flex w-full flex-col items-center gap-2.5 rounded-[18px] bg-paper-2 px-6 py-12 transition-colors hover:bg-paper-3 disabled:opacity-50"
          >
            <span aria-hidden className="text-[24px]">
              ⬆
            </span>
            <span className="text-[15px] font-semibold">
              {uploading ? "uploading…" : "upload your logo"}
            </span>
            <span className="text-[12px] text-muted">
              png or jpg · square works best
            </span>
          </button>
        )}

        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-[12px] bg-pin-soft px-4 py-3 text-[14px] leading-snug"
          >
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-10 grid grid-cols-2 gap-4">
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
