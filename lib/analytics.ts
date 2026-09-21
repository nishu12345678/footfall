/**
 * Which pages Google Analytics is allowed to measure.
 *
 * Three surfaces share one root layout: the marketing page, the product
 * under /app, and the shop microsites at <slug>.footfall.zone (served by
 * /s/<slug> through the host rewrite). The first two are ours to measure.
 * The third is a customer's own website with their own visitors, on a
 * domain that carries their name — measuring it would pour strangers'
 * traffic into our property without the shop owner ever having agreed to
 * it, and would make the privacy policy's "we do not track shop sites"
 * line false. So the gate is deny-by-default on anything that looks like
 * a shop site, on either address it can be reached at.
 *
 * This is deliberately a pure function with the two inputs passed in, so
 * it can be pinned down by a test rather than by clicking around.
 */

/** Domain shop sites live under. Same var next.config.ts uses. */
const SITE_DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN ?? "footfall.zone";

/** Hosts under the site domain that are never shop sites. Mirrors the
 *  RESERVED list in next.config.ts; keep them in step. */
const RESERVED = new Set([
  "www",
  "app",
  "api",
  "admin",
  "mail",
  "static",
  "cdn",
  "dev",
  "stage",
  "staging",
]);

export function isShopHost(host: string | null | undefined, domain = SITE_DOMAIN) {
  const h = (host ?? "").split(":")[0].toLowerCase();
  if (!h || h === domain || !h.endsWith(`.${domain}`)) return false;
  const label = h.slice(0, -(domain.length + 1));
  // One label only: `a.b.footfall.zone` is not a shop.
  if (label.includes(".")) return false;
  return !RESERVED.has(label);
}

export function isShopPath(pathname: string | null | undefined) {
  const p = pathname ?? "";
  return p === "/s" || p.startsWith("/s/");
}

/** True when a pageview on this host+path may be sent to GA. */
export function shouldTrack(
  host: string | null | undefined,
  pathname: string | null | undefined,
  domain = SITE_DOMAIN,
) {
  return !isShopHost(host, domain) && !isShopPath(pathname);
}

/** The GA4 measurement id, or null when analytics is switched off. */
export function gaId(): string | null {
  const id = (process.env.NEXT_PUBLIC_GA_ID ?? "").trim();
  return /^G-[A-Z0-9]+$/.test(id) ? id : null;
}
