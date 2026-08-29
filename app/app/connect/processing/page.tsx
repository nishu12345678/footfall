"use client";

import { useAction } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Steps } from "@/components/steps";

type Location = {
  name: string;
  title: string;
  address?: string;
  city?: string;
  pinCode?: string;
  phone?: string;
  website?: string;
  category?: string;
  lat?: number;
  lng?: number;
  accountName: string;
};

type Phase = "working" | "choose" | "linked" | "empty" | "error";

export default function ProcessingPage() {
  const listLocations = useAction(api.google.listLocations);
  const linkLocation = useAction(api.google.linkLocation);

  const [phase, setPhase] = useState<Phase>("working");
  const [locations, setLocations] = useState<Location[]>([]);
  const [linked, setLinked] = useState<Location | null>(null);
  const [message, setMessage] = useState("Reading your Google listing…");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const link = useCallback(
    async (location: Location) => {
      setPhase("working");
      setMessage("Linking your profile…");
      try {
        await linkLocation({ location });
        setLinked(location);
        setPhase("linked");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    },
    [linkLocation],
  );

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      try {
        const found = (await listLocations({})) as Location[];
        if (found.length === 0) {
          setPhase("empty");
          return;
        }
        if (found.length === 1) {
          await link(found[0]);
          return;
        }
        setLocations(found);
        setPhase("choose");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    })();
  }, [listLocations, link]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10">
      <Steps current={phase === "linked" ? 2 : 1} />

      <div className="mt-10 flex flex-1 flex-col justify-center">
        {phase === "working" ? (
          <div className="text-center">
            <span
              aria-hidden
              className="mx-auto block h-9 w-9 animate-spin rounded-full border-2 border-rule border-t-pin"
            />
            <h1 className="mt-6 text-[1.9rem]">processing</h1>
            <p className="mt-3 text-[15px] text-ink-soft">{message}</p>
            <p className="mt-1 font-mono text-[11px] text-muted">
              please don&rsquo;t close or refresh this window
            </p>
          </div>
        ) : null}

        {phase === "choose" ? (
          <div>
            <h1 className="text-[1.9rem]">which one is yours?</h1>
            <p className="mt-3 text-[15px] text-ink-soft">
              This Google account manages {locations.length} listings. Pick the
              one you want us to run.
            </p>
            <ul className="mt-6 space-y-3">
              {locations.map((loc) => (
                <li key={loc.name}>
                  <button
                    type="button"
                    onClick={() => void link(loc)}
                    className="w-full rounded-[14px] border border-ink bg-paper-2 p-4 text-left shadow-[3px_3px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
                  >
                    <span className="block font-display text-[16px] font-bold">
                      {loc.title}
                    </span>
                    {loc.address ? (
                      <span className="mt-1 block text-[13px] leading-snug text-ink-soft">
                        {loc.address}
                      </span>
                    ) : null}
                    {loc.category ? (
                      <span className="mt-2 inline-block font-mono text-[10px] uppercase tracking-wider text-muted">
                        {loc.category}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {phase === "linked" ? (
          <div className="text-center">
            <span
              aria-hidden
              className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-ink bg-open text-[30px] text-paper-2 shadow-[3px_3px_0_var(--color-ink)]"
            >
              ✓
            </span>
            <h1 className="mt-6 text-[2rem]">linked successfully</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              <strong>{linked?.title}</strong> is connected. We can now improve
              your ranking and reply to your reviews.
            </p>
            <a href="/app/onboarding/location" className="btn btn-primary mt-8 w-full">
              continue setup
            </a>
          </div>
        ) : null}

        {phase === "empty" ? (
          <div>
            <h1 className="text-[1.9rem]">no listings on that account</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              That Google account doesn&rsquo;t manage any business profiles.
              This usually means the listing sits with whoever did your
              marketing before, or you signed in with a different Google
              account.
            </p>
            <a href="/app/connect" className="btn btn-ghost mt-7 w-full">
              try another google account
            </a>
          </div>
        ) : null}

        {phase === "error" ? (
          <div>
            <h1 className="text-[1.9rem]">that didn&rsquo;t work</h1>
            <p className="mt-3 rounded-[12px] border border-pin bg-pin-soft px-4 py-3 font-mono text-[12px] leading-relaxed break-words">
              {error}
            </p>
            <a href="/app/connect" className="btn btn-primary mt-7 w-full">
              try again
            </a>
          </div>
        ) : null}
      </div>
    </main>
  );
}
