"use client";

import { useAction, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/convex/_generated/api";
import { Steps } from "@/components/steps";
import { Working } from "@/components/working";
import { shopUrl } from "@/lib/site-host";

type Check = { id: string; label: string; passed: boolean; detail: string };

export default function WebsiteStepPage() {
  const data = useQuery(api.site.mine);
  const generate = useAction(api.site.generateSite);
  const review = useAction(api.site.reviewExistingSite);

  const [building, setBuilding] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [audit, setAudit] = useState<{
    url: string;
    checks: Check[];
    advice: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  // Two different jobs depending on what the shop already has: build one for
  // a shop with no website, or tell a shop that has one what it's missing.
  useEffect(() => {
    if (!data || started.current) return;
    started.current = true;

    if (data.business.website) {
      setAuditing(true);
      void review({})
        .then(setAudit)
        .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        .finally(() => setAuditing(false));
      return;
    }
    if (data.site) return;

    setBuilding(true);
    void generate({})
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBuilding(false));
  }, [data, generate, review]);

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
  const hasOwnSite = Boolean(business.website);
  const failed = audit?.checks.filter((c) => !c.passed) ?? [];
  const passed = audit?.checks.filter((c) => c.passed) ?? [];

  /* ------------------------- they already have one ---------------------- */
  if (hasOwnSite) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10">
        <Steps current={5} />

        <div className="mt-7 flex-1">
          <h1 className="text-[1.75rem]">your website</h1>
          <p className="mt-2 break-all text-[13px] font-mono text-ink-soft">
            {business.website}
          </p>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            You already have a site, so we won&rsquo;t make you another one.
            Here&rsquo;s what it&rsquo;s missing that would help people nearby
            find you.
          </p>

          {auditing ? (
            <div className="mt-6">
              <Working label="Reading your website" />
            </div>
          ) : null}

          {audit ? (
            <>
              <div className="mt-6 flex items-baseline justify-between gap-3">
                <h2 className="font-display text-[15px] font-bold">
                  {failed.length === 0
                    ? "Nothing missing"
                    : `${failed.length} thing${failed.length === 1 ? "" : "s"} to fix`}
                </h2>
                <span className="flex-none font-mono text-[10px] text-muted">
                  {passed.length}/{audit.checks.length} passing
                </span>
              </div>

              <ul className="mt-3 space-y-2">
                {[...failed, ...passed].map((check, i) => (
                  <li
                    key={check.id}
                    className={`rounded-[12px] border p-3 ${
                      check.passed
                        ? "border-rule bg-paper-2"
                        : "border-pin bg-pin-soft"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        aria-hidden
                        className={`mt-0.5 flex-none font-mono text-[12px] ${
                          check.passed ? "text-open" : "text-pin"
                        }`}
                      >
                        {check.passed ? "✓" : "✕"}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold leading-snug">
                          {check.label}
                        </span>
                        {!check.passed ? (
                          <span className="mt-1 block text-[13px] leading-snug text-ink-soft">
                            {audit.advice[i] ?? check.detail}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
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

        <a href="/app/onboarding/others" className="btn btn-primary mt-8 w-full">
          next
        </a>
      </main>
    );
  }

  /* --------------------------- no website yet --------------------------- */
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-6 py-10">
      <Steps current={5} />

      <div className="mt-7 flex-1">
        <h1 className="text-[1.75rem]">
          {site ? "your website is live" : "we’re making you a website"}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          {site
            ? "Built from your Google listing, so your name, address, phone and hours match Google exactly. That match is one of the few things you fully control that Google actually rewards."
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
                  <p className="mt-1 text-[13px] text-ink-soft">{site.subhead}</p>
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
                href={shopUrl(site.slug)}
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
