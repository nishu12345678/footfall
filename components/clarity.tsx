"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { clarityId, shouldTrackClarity } from "@/lib/analytics";

/**
 * Microsoft Clarity, for product-behavior research only.
 *
 * It is intentionally separate from the Convex analytics ledger and GA4:
 * Clarity gives us recordings and heatmaps, not accounting or funnel truth.
 * The project id is production configuration, so this component renders no
 * script at all until NEXT_PUBLIC_CLARITY_ID is present.
 *
 * The host/path gate also means a customer's shop microsite never loads our
 * recorder. The admin dashboard is excluded because it is staff-only and can
 * display customer-wide data. We do not call clarity.identify or pass custom
 * account, business, email, phone or Convex identifiers.
 */

const ID = clarityId();

// Match Analytics' hydration-safe host check: the server has no browser host,
// then the real host arrives after hydration without a markup mismatch.
const noop = () => () => {};
const readHost = () => window.location.host;
const serverHost = () => null;

type ClarityWindow = Window & {
  clarity?: (...args: unknown[]) => void;
};

/**
 * The official Clarity bootstrap queues commands until the vendor script has
 * loaded. Keeping it inline lets Next's afterInteractive strategy load it once
 * from the root layout without adding a runtime dependency.
 */
function clarityBootstrap(id: string) {
  return `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","${id}");`;
}

export function Clarity() {
  const pathname = usePathname();
  const host = useSyncExternalStore(noop, readHost, serverHost);
  const allowed = ID !== null && host !== null && shouldTrackClarity(host, pathname);

  useEffect(() => {
    // A root layout survives client navigation. If Clarity was already
    // initialized and the user moves into /admin or a shop path, explicitly
    // opt the recorder out for the rest of this document instead of allowing
    // the old script to keep observing the excluded surface.
    if (allowed) return;
    (window as ClarityWindow).clarity?.("consent", false);
  }, [allowed]);

  if (!allowed || !ID) return null;

  return (
    <Script id="clarity-loader" strategy="afterInteractive">
      {clarityBootstrap(ID)}
    </Script>
  );
}
