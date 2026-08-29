"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";

/**
 * Placeholder home. The real dashboard — review card, agent status,
 * counters, timeline, actions feed — lands on top of this.
 * For now it exists to prove the sign-in loop round-trips.
 */
export default function AppHome() {
  const { signOut } = useAuthActions();
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="font-mono text-[12px] text-muted">loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-md px-6 py-12">
      <div className="rounded-[14px] border border-ink bg-paper-2 p-6 shadow-[3px_4px_0_var(--color-ink)]">
        <span className="chip">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isAuthenticated ? "bg-open" : "bg-pin"
            }`}
            aria-hidden
          />
          {isAuthenticated ? "signed in" : "signed out"}
        </span>

        <h1 className="mt-4 text-[1.8rem]">you&rsquo;re in</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
          Sign-in works. Next: connect your Google Business Profile, then the
          5-step setup.
        </p>

        <button
          type="button"
          onClick={() => void signOut()}
          className="btn btn-ghost mt-6 w-full"
        >
          sign out
        </button>
      </div>
    </main>
  );
}
