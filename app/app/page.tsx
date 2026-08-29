"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * Placeholder home. Routes the owner to whatever they haven't done yet.
 * The real dashboard — review card, agent status, counters, timeline,
 * actions feed — replaces this.
 */
export default function AppHome() {
  const { signOut } = useAuthActions();
  const business = useQuery(api.businesses.mine);

  if (business === undefined) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="font-mono text-[12px] text-muted">loading…</p>
      </main>
    );
  }

  if (business === null) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
        <div className="rounded-[14px] border border-ink bg-paper-2 p-6 shadow-[3px_4px_0_var(--color-ink)]">
          <span className="chip">
            <span className="h-1.5 w-1.5 rounded-full bg-pin" aria-hidden />
            not connected
          </span>
          <h1 className="mt-4 text-[1.8rem]">one step left</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            Connect your Google Business Profile and we can start working on
            it today.
          </p>
          <a href="/app/connect" className="btn btn-primary mt-6 w-full">
            connect google
          </a>
          <button
            type="button"
            onClick={() => void signOut()}
            className="btn btn-ghost mt-3 w-full"
          >
            sign out
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-6 py-10">
      <div className="rounded-[14px] border border-ink bg-paper-2 p-6 shadow-[3px_4px_0_var(--color-ink)]">
        <span className="chip">
          <span className="h-1.5 w-1.5 rounded-full bg-open" aria-hidden />
          connected
        </span>

        <h1 className="mt-4 text-[1.8rem]">{business.orgName}</h1>
        {business.streetAddress ? (
          <p className="mt-2 text-[14px] leading-snug text-ink-soft">
            {business.streetAddress}
          </p>
        ) : null}

        <dl className="mt-5 space-y-2 border-t border-rule-soft pt-4">
          {[
            ["category", business.primaryCategory],
            ["phone", business.phone],
            ["website", business.website],
            ["listing", business.gbpLocationName],
          ].map(([k, val]) =>
            val ? (
              <div key={k} className="flex gap-3 text-[13px]">
                <dt className="w-20 flex-none font-mono text-[11px] text-muted">
                  {k}
                </dt>
                <dd className="min-w-0 break-words text-ink-soft">{val}</dd>
              </div>
            ) : null,
          )}
        </dl>

        <a
          href="/app/onboarding/location"
          className="btn btn-primary mt-6 w-full"
        >
          continue setup
        </a>
        <button
          type="button"
          onClick={() => void signOut()}
          className="btn btn-ghost mt-3 w-full"
        >
          sign out
        </button>
      </div>
    </main>
  );
}
