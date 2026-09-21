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
 * The one screen shown when the backend address is missing, shared by
 * every provider below so a misconfigured deploy fails the same way
 * everywhere instead of rendering a blank page or a stack trace.
 */
function NotConnected() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10 sm:px-6">
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

/**
 * Wraps only the /app routes. The marketing page at / stays a static page
 * with no Convex dependency, so a backend problem can never take it down.
 */
export function ConvexProviders({ children }: { children: ReactNode }) {
  if (!client) return <NotConnected />;

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

/**
 * The same Convex session, for the internal dashboard at /admin.
 *
 * Deliberately thinner than ConvexProviders, and the differences are the
 * point rather than an oversight:
 *
 * - **No Paywall.** The paywall asks `api.billing.status` on every screen
 *   and bounces a lapsed owner to /app/report. An operator reading the
 *   dashboard may have no subscription at all — admin is an employee, not
 *   a customer — so a plan check here would lock the staff out of their
 *   own numbers, and would ask a billing question on a route that has
 *   nothing to do with billing.
 *
 * - **No ConvexQueryCacheProvider.** Its job is keeping a customer's
 *   subscriptions warm for five minutes across tab switches. This route is
 *   a handful of deliberately bounded reads over the whole customer base;
 *   holding them open after the operator navigates away keeps server work
 *   alive for a screen nobody is looking at, and the dashboard would
 *   rather refetch than serve a stale funnel.
 *
 * - **No NavTracker.** It exists so the customer app's Back button knows
 *   whether history is in-app; the dashboard is one page.
 *
 * What this is NOT is authorisation. It only establishes a session so the
 * browser can ask who it is. Every query that returns data is an
 * `adminQuery` in convex/access.ts and re-checks the verified email
 * server-side, answering "Not found." to everyone else.
 */
export function AdminConvexProviders({ children }: { children: ReactNode }) {
  if (!client) return <NotConnected />;

  return (
    <ConvexAuthNextjsProvider client={client}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
