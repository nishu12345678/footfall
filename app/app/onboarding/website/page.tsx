"use client";

import { useAction, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Steps } from "@/components/steps";
import { Working } from "@/components/working";

export default function WebsiteStepPage() {
  const data = useQuery(api.site.mine);
  const generate = useAction(api.site.generateSite);

  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  // A shop with no website is exactly who this is for, so we build it
  // without being asked. Shops that already have one are offered it.
  useEffect(() => {
    if (!data || started.current) return;
    if (data.site) {
      started.current = true;
      return;
    }
    if (data.business.website) return; // they have one; let them choose
    started.current = true;
    setBuilding(true);
    void generate({})
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBuilding(false));
  }, [data, generate]);

  async function build() {
    setBuilding(true);
    setError(null);
    try {
      await generate({});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBuilding(false);
    }
  }

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

  const { business, site } = data;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10">
      <Steps current={5} />

      <div className="mt-7 flex-1">
        <h1 className="text-[1.75rem]">
          {site ? "your website is live" : "we're making you a website"}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          {site
            ? "Built from your Google listing, so your name, address, phone and hours match Google exactly. That match is one of the few things you fully control that Google actually rewards."
            : business.website
              ? "You already have one. You can still make a simple page that matches your Google listing exactly — some owners send customers here instead."
              : "One page with your services, hours, phone and directions — built from your Google listing. Nothing to write, nothing to host, no yearly fee."}
        </p>

        {building ? (
          <div className="mt-6">
            <Working label="Writing your website from your listing" />
          </div>
        ) : null}

        {site && !building ? (
          <>
            <div className="mt-6 overflow-hidden rounded-[14px] border border-ink shadow-[3px_4px_0_var(--color-ink)]">
              <div className="flex items-center gap-2 border-b border-ink bg-paper-3 px-3 py-2">
                <span className="h-2.5 w-2.5 rounded-full border border-ink bg-pin" />
                <span className="h-2.5 w-2.5 rounded-full border border-ink bg-star" />
                <span className="h-2.5 w-2.5 rounded-full border border-ink bg-open" />
                <span className="truncate font-mono text-[10px] text-ink-soft">
                  /s/{site.slug}
                </span>
              </div>

              <div className="bg-paper-2 p-4">
                <p className="font-display text-[17px] font-bold leading-tight">
                  {site.headline}
                </p>
                {site.subhead ? (
                  <p className="mt-1 text-[13px] text-ink-soft">
                    {site.subhead}
                  </p>
                ) : null}
                <p className="mt-3 line-clamp-3 text-[13px] leading-relaxed text-ink-soft">
                  {site.about}
                </p>

                <ul className="mt-3 flex flex-wrap gap-1.5">
                  {site.services.slice(0, 4).map((s) => (
                    <li
                      key={s.name}
                      className="rounded-full border border-rule bg-paper px-2 py-0.5 text-[11px]"
                    >
                      {s.name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <ul className="mt-4 space-y-1.5 text-[13px] leading-snug text-ink-soft">
              <li>· {site.services.length} services, written for local search</li>
              <li>· {site.faqs.length} questions customers actually ask</li>
              <li>· your hours, phone and directions straight from Google</li>
              <li>· structured data so Google can read the page properly</li>
            </ul>

            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href={`/s/${site.slug}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost btn-sm"
              >
                open it
              </a>
              <button
                type="button"
                onClick={() => void build()}
                disabled={building}
                className="font-mono text-[11px] underline underline-offset-4 hover:text-pin disabled:opacity-50"
              >
                rewrite it
              </button>
            </div>
          </>
        ) : null}

        {!site && !building ? (
          <button
            type="button"
            onClick={() => void build()}
            className="btn btn-primary mt-6 w-full"
          >
            <span aria-hidden>✦</span> make my website
          </button>
        ) : null}

        {error ? (
          <p
            role="alert"
            className="mt-5 break-words rounded-[12px] border border-pin bg-pin-soft px-3.5 py-2.5 font-mono text-[12px] leading-snug"
          >
            {error}
          </p>
        ) : null}
      </div>

      <a
        href="/app/onboarding/others"
        className={`btn mt-8 w-full ${site ? "btn-primary" : "btn-ghost"}`}
      >
        {site ? "next" : "skip for now"}
      </a>
    </main>
  );
}
