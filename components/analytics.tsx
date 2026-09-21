"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { gaId, shouldTrack } from "@/lib/analytics";
import { gaEvent, gaPush, paramsFromDataset, setGaTracking } from "@/lib/ga";

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
 *    ignores plain arrays. That push now lives in lib/ga.ts (`gaPush`) so
 *    the page_view path and the custom-event path share one transport.
 *
 * Custom events (cta_click, login_start, begin_checkout, purchase) go
 * through lib/ga.ts, which allowlists their parameters. This component
 * owns the switch: `setGaTracking` is flipped on only when the measurement
 * id exists AND this host+path is ours to measure, so a data-analytics-*
 * attribute that somehow renders on a shop microsite still sends nothing.
 *
 * Search params are deliberately not read: useSearchParams would force
 * the static marketing page into dynamic rendering, and nothing in the
 * query string is worth that.
 *
 * Privacy: GA4 does not store IP addresses and Google Signals is not
 * enabled, so this is visits, pages and rough geography — nothing that
 * identifies a person. No user_id is ever set and no Convex document id is
 * ever sent, so GA stays unconnected to an account exactly as the privacy
 * policy (§7, §13) says; if the configuration here changes, so must those
 * sections.
 *
 * CSP (when next.config.ts grows one): allow script-src and connect-src
 * for https://www.googletagmanager.com and https://*.google-analytics.com,
 * or this silently stops reporting.
 */

const ID = gaId();

// Module-level rather than refs: React's dev-mode double-invoked effects
// would otherwise send the first page_view twice.
let initialised = false;
let lastPath: string | null = null;

const noop = () => () => {};
const readHost = () => window.location.host;
const serverHost = () => null;

/**
 * One delegated listener for everything carrying data-analytics-event.
 *
 * Instrumenting a link should not turn a server component into a client
 * one, and forty onClick handlers are forty places for a payload to drift.
 * So the markup declares intent — `data-analytics-event="cta_click"` plus
 * `data-analytics-cta-id`, `data-analytics-location`,
 * `data-analytics-destination` — and this reads it.
 *
 * Capture phase, on the document, and `closest()` rather than the exact
 * target: a click usually lands on the <svg> or the text node inside the
 * button, and capture still fires when a handler on the element itself
 * calls stopPropagation. Nothing is prevented or delayed; the push is
 * synchronous onto the queue, which survives the navigation because
 * dataLayer is drained by gtag.js as soon as it loads on the next page.
 */
function onDocumentClick(e: MouseEvent) {
  // Only a plain primary click; a ctrl/cmd-click opening a new tab is a
  // real intent too, so those are kept — only auxiliary buttons are not.
  if (e.button !== 0) return;

  const start = e.target;
  if (!(start instanceof Element)) return;
  const el = start.closest<HTMLElement>("[data-analytics-event]");
  if (!el) return;

  // Anchors and buttons only. A div with the attribute is a mistake in the
  // markup, and silently honouring it invites "track this whole section".
  const tag = el.tagName;
  const role = el.getAttribute("role");
  if (tag !== "A" && tag !== "BUTTON" && role !== "button" && role !== "link") {
    return;
  }

  const parsed = paramsFromDataset({ ...el.dataset });
  if (!parsed) return;

  // A cta_click on an anchor knows its own destination; let the markup
  // override it, but never make a call site repeat the href.
  if (
    parsed.event === "cta_click" &&
    !parsed.params.destination &&
    el instanceof HTMLAnchorElement
  ) {
    const href = el.getAttribute("href");
    if (href) parsed.params.destination = href;
  }

  gaEvent(parsed.event, parsed.params);
}

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
    // The gate every custom event reads. Flipped off again on a route that
    // is not ours, so a client-side navigation into /s/<slug> stops
    // sending as surely as a fresh load of it would.
    setGaTracking(allowed);
  }, [allowed]);

  useEffect(() => {
    if (!allowed || !ID || lastPath === pathname) return;
    lastPath = pathname;
    if (!initialised) {
      initialised = true;
      gaPush("js", new Date());
      gaPush("config", ID, { send_page_view: false });
    }
    gaPush("event", "page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [allowed, pathname]);

  useEffect(() => {
    if (!allowed) return;
    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, [allowed]);

  if (!allowed || !ID) return null;

  return (
    <Script
      id="ga-loader"
      src={`https://www.googletagmanager.com/gtag/js?id=${ID}`}
      strategy="afterInteractive"
    />
  );
}
