"use client";

import { useQuery } from "convex/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { api } from "@/convex/_generated/api";

/**
 * Keeps a free user on the free part of the app.
 *
 * There are two kinds of signed-in user. A free one connects their Google
 * profile and reads the report on it — that is all. A paid one gets the
 * agent: posts published, reviews answered, enquiries picked up.
 *
 * This is a courtesy, not the lock. The real enforcement is in
 * convex/access.ts, which refuses the data itself; this only saves a free
 * owner from walking into a screen full of errors.
 */
const FREE_PATHS = [
  "/app/login",
  "/app/billing",
  "/app/report",
  "/app/connect",
];

export function Paywall({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const status = useQuery(api.billing.status);

  const free = FREE_PATHS.some((p) => pathname?.startsWith(p));
  const blocked =
    !free && status !== undefined && status.signedIn && !status.active;

  useEffect(() => {
    if (blocked) router.replace("/app/report");
  }, [blocked, router]);

  if (free) return <>{children}</>;

  // Held back until we know, so a paid owner never sees a flash of the
  // report on a slow connection.
  if (status === undefined || blocked) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-5">
        <p className="text-[16px] text-muted">Loading…</p>
      </main>
    );
  }

  return <>{children}</>;
}
