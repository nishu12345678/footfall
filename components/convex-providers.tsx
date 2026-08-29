"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

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
        <div className="rounded-[14px] border border-ink bg-paper-2 p-6 shadow-[3px_4px_0_var(--color-ink)]">
          <h1 className="text-[1.6rem]">backend not connected</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
            <code className="font-mono text-[13px]">NEXT_PUBLIC_CONVEX_URL</code>{" "}
            is not set, so the app can&rsquo;t reach its database.
          </p>
          <p className="mt-3 font-mono text-[12px] leading-relaxed text-muted">
            run <span className="text-pin">npx convex dev</span> and reload
          </p>
        </div>
      </main>
    );
  }

  return (
    <ConvexAuthNextjsProvider client={client}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
