"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { metaPixelId, shouldTrackMetaPixel } from "@/lib/analytics";
import { paramsFromDataset } from "@/lib/ga";
import {
  contactParams,
  fbqPush,
  META_PIXEL_SRC,
  metaEvent,
  setMetaTracking,
} from "@/lib/meta-pixel";

/**
 * Meta Pixel base code, on the marketing page and the product only.
 *
 * This is the "paste between the header tags on every page" snippet from
 * Events Manager, rebuilt for the App Router. Mounted once in the root
 * layout, so it is on every page. It renders nothing at all — no script
 * tag, no request to Meta — unless NEXT_PUBLIC_META_PIXEL_ID is set, so
 * localhost and preview builds stay out of the ad audiences. Shop
 * microsites and /admin are excluded by host and by path (see
 * lib/analytics.ts for why).
 *
 * Two things this does differently from the copy-paste snippet, on purpose:
 *
 * 1. The App Router navigates client-side, so the snippet's one
 *    fbq('track','PageView') would fire only on the first full load and
 *    every navigation after that would go uncounted. The effect below
 *    sends exactly one PageView per pathname change, the first load
 *    included, after a single fbq('init').
 *
 * 2. The snippet's inline IIFE is replaced by lib/meta-pixel.ts
 *    (`ensureFbq`): the same queueing stub, installed from the effect, and
 *    fbevents.js loaded by Next's <Script>. Commands are queued before the
 *    library arrives and drained when it does, whichever order React
 *    mounts the script and runs the effects in.
 *
 * The snippet's <noscript><img> fallback is not rendered. The server
 * cannot see the request host, so it cannot tell a shop subdomain from
 * ours, and a server-rendered fallback would fire on a customer's site.
 * With JavaScript off nothing in this product works anyway, so there is
 * no conversion for it to miss.
 *
 * Custom events (Contact, Lead, InitiateCheckout, Purchase) go through
 * lib/meta-pixel.ts, which allowlists their parameters. This component
 * owns the switch: `setMetaTracking` is flipped on only when the pixel id
 * exists AND this host+path is ours to measure, so a data-analytics-*
 * attribute that somehow renders on a shop microsite still sends nothing.
 *
 * Privacy: no advanced matching, no fbq('init', id, { em, ph, ... }). The
 * pixel sees pages, the plan being bought and the amount — not who. The
 * privacy policy (§7, §13) says exactly that; if the configuration here
 * changes, so must those sections.
 *
 * CSP (when next.config.ts grows one): allow script-src and connect-src
 * for https://connect.facebook.net and img-src/connect-src for
 * https://www.facebook.com, or this silently stops reporting.
 */

const ID = metaPixelId();

// Module-level rather than refs: React's dev-mode double-invoked effects
// would otherwise send the first PageView twice.
let initialised = false;
let lastPath: string | null = null;

const noop = () => () => {};
const readHost = () => window.location.host;
const serverHost = () => null;

/**
 * A marketing CTA press is a Contact for ad optimisation.
 *
 * Same delegated-listener shape as components/analytics.tsx, and the same
 * markup: anything already carrying `data-analytics-event="cta_click"`
 * reports here too, with the cta id and location only. The GA parser is
 * reused for the dataset so the two cannot disagree about what a CTA is.
 * Deliberately its own listener rather than a hook into the GA one, so the
 * pixel keeps working on a build with no GA id at all.
 */
function onDocumentClick(e: MouseEvent) {
  if (e.button !== 0) return;
  const start = e.target;
  if (!(start instanceof Element)) return;
  const el = start.closest<HTMLElement>("[data-analytics-event]");
  if (!el) return;

  const tag = el.tagName;
  const role = el.getAttribute("role");
  if (tag !== "A" && tag !== "BUTTON" && role !== "button" && role !== "link") {
    return;
  }

  const parsed = paramsFromDataset({ ...el.dataset });
  if (!parsed || parsed.event !== "cta_click") return;

  const ctaId = parsed.params.cta_id;
  const location = parsed.params.location;
  if (typeof ctaId !== "string" || typeof location !== "string") return;

  metaEvent("Contact", contactParams({ ctaId, location }));
}

export function MetaPixel() {
  const pathname = usePathname();
  // The server cannot see the host, so it cannot know whether this is a
  // shop subdomain. useSyncExternalStore gives null on the server and during
  // hydration, then the real host — so both renders agree, there is no
  // hydration mismatch, and the script attaches one render later, which
  // afterInteractive was going to do anyway.
  const host = useSyncExternalStore(noop, readHost, serverHost);

  const allowed =
    ID !== null && host !== null && shouldTrackMetaPixel(host, pathname);

  useEffect(() => {
    // The gate every custom event reads. Flipped off again on a route that
    // is not ours, so a client-side navigation into /s/<slug> or /admin
    // stops sending as surely as a fresh load of it would.
    setMetaTracking(allowed);
  }, [allowed]);

  useEffect(() => {
    if (!allowed || !ID || lastPath === pathname) return;
    lastPath = pathname;
    if (!initialised) {
      initialised = true;
      fbqPush("init", ID);
    }
    fbqPush("track", "PageView");
  }, [allowed, pathname]);

  useEffect(() => {
    if (!allowed) return;
    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, [allowed]);

  if (!allowed || !ID) return null;

  return (
    <Script id="meta-pixel-loader" src={META_PIXEL_SRC} strategy="afterInteractive" />
  );
}
