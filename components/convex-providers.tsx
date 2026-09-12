"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexQueryCacheProvider } from "convex-helpers/react/cache";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { Paywall } from "./paywall";
import { NavTracker } from "./nav-tracker";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const client = convexUrl ? new ConvexReactClient(convexUrl) : null;

/**
 * Wraps only the /app routes. The marketing page at / stays a static page
 * with no Convex dependency, so a backend problem can never take it down.
 */
export function ConvexProviders({ children }: { children: ReactNode }) {
  if (!client) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <div className="card p-6">
          <h1 className="text-[1.6rem]">Backend not connected</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            <code className="font-mono text-[13px]">NEXT_PUBLIC_CONVEX_URL</code>{" "}
            is not set, so the app can&rsquo;t reach its database.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            run <span className="font-mono text-pin">npx convex dev</span> and reload
          </p>
        </div>
      </main>
    );
  }

  return (
    <ConvexAuthNextjsProvider client={client}>
      {/* Keeps query subscriptions warm for 5 minutes after a screen
          unmounts, so switching tabs shows the last data instantly and
          updates in place instead of flashing "loading". */}
      <ConvexQueryCacheProvider>
        <NavTracker />
        <Paywall>{children}</Paywall>
      </ConvexQueryCacheProvider>
    </ConvexAuthNextjsProvider>
  );
}
