"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { gaId, shouldTrack } from "@/lib/analytics";

/**
 * Google Analytics 4, on the marketing page and the product only.
 *
 * Mounted once in the root layout. Renders nothing at all — no script tag,
 * no request to Google — unless NEXT_PUBLIC_GA_ID is set, so localhost and
 * preview builds stay out of the numbers. Shop microsites are excluded by
 * host and by path (see lib/analytics.ts for why).
 *
 * Two things this does differently from the copy-paste snippet, on purpose:
 *
 * 1. The App Router navigates client-side, so gtag's own automatic
 *    page_view fires only on the first full load; every navigation after
 *    that would go uncounted. `send_page_view: false` turns the automatic
 *    one off, and the effect below sends exactly one per pathname change,
 *    the first load included.
 *
 * 2. Nothing calls window.gtag. Every command is pushed straight onto
 *    window.dataLayer — which is all gtag() does anyway — so the order is
 *    fixed (js, config, then page_views) no matter whether gtag.js has
 *    finished downloading. The library drains the queue when it arrives.
 *    Pushing an `arguments` object, not an array, is load-bearing: gtag.js
 *    ignores plain arrays.
 *
 * Search params are deliberately not read: useSearchParams would force
 * the static marketing page into dynamic rendering, and nothing in the
 * query string is worth that.
 *
 * Privacy: GA4 does not store IP addresses and Google Signals is not
 * enabled, so this is visits, pages and rough geography — nothing that
 * identifies a person. The privacy policy (§7, §13) says exactly this; if
 * the configuration here changes, so must those sections.
 *
 * CSP (when next.config.ts grows one): allow script-src and connect-src
 * for https://www.googletagmanager.com and https://*.google-analytics.com,
 * or this silently stops reporting.
 */

const ID = gaId();

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

// `function`, not an arrow: `arguments` is the whole point. The typed rest
// parameter exists only so call sites typecheck; the body must not use it.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function gtag(...args: unknown[]) {
  // eslint-disable-next-line prefer-rest-params
  (window.dataLayer ??= []).push(arguments);
}

const noop = () => () => {};
const readHost = () => window.location.host;
const serverHost = () => null;

// Module-level rather than refs: React's dev-mode double-invoked effects
// would otherwise send the first page_view twice.
let initialised = false;
let lastPath: string | null = null;

export function Analytics() {
  const pathname = usePathname();
  // The server cannot see the host, so it cannot know whether this is a
  // shop subdomain. useSyncExternalStore gives null on the server and during
  // hydration, then the real host — so both renders agree, there is no
  // hydration mismatch, and the script attaches one render later, which
  // afterInteractive was going to do anyway.
  const host = useSyncExternalStore(noop, readHost, serverHost);

  const allowed = ID !== null && host !== null && shouldTrack(host, pathname);

  useEffect(() => {
    if (!allowed || !ID || lastPath === pathname) return;
    lastPath = pathname;
    if (!initialised) {
      initialised = true;
      gtag("js", new Date());
      gtag("config", ID, { send_page_view: false });
    }
    gtag("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [allowed, pathname]);

  if (!allowed || !ID) return null;

  return (
    <Script
      id="ga-loader"
      src={`https://www.googletagmanager.com/gtag/js?id=${ID}`}
      strategy="afterInteractive"
    />
  );
}
