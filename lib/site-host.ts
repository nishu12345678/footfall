/**
 * Where a shop's free site actually lives.
 *
 * The address is <slug>.footfall.zone, served by the /s/<slug> pages through
 * the host rewrite in next.config.ts.
 *
 * The subdomain form is used only when this deployment is itself served
 * from that domain. On localhost, and on a preview deployment, the app is
 * somewhere else entirely, and a subdomain link would leave the environment
 * being tested and land on production. Those environments get the
 * /s/<slug> path on their own host instead: the same pages, reached the
 * plain way. A canonical tag aimed at a host that does not resolve is worse
 * for the shop than no subdomain at all.
 */
const DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN;

/** The app's own address. app/layout.tsx falls back the same way. */
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://footfall.zone")
  .replace(/\/+$/, "");

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

const OWN_HOST = hostOf(SITE_URL);

/** True once the subdomain is real and this deployment is served from it. */
export const SUBDOMAIN_LIVE =
  Boolean(DOMAIN) &&
  OWN_HOST !== null &&
  (OWN_HOST === DOMAIN || OWN_HOST.endsWith(`.${DOMAIN}`));

/** The address to show an owner and to point canonical tags at. */
export function shopUrl(slug: string, path = "") {
  return SUBDOMAIN_LIVE
    ? `https://${slug}.${DOMAIN}${path}`
    : `${SITE_URL}/s/${slug}${path}`;
}

/**
 * An internal link within one shop's site, correct on either host.
 *
 * On the live domain the shop is served from <slug>.footfall.zone, where a
 * path-form link like /s/<slug>/services would be rewritten into
 * /s/<slug>/s/<slug>/services — a 404. The absolute subdomain URL is right
 * there, and equally right when the same page is viewed at /s/<slug> on the
 * main host. Off the live domain (localhost, previews) the path form keeps
 * navigation inside the environment being tested.
 */
export function shopPath(slug: string, path = "") {
  return SUBDOMAIN_LIVE ? shopUrl(slug, path) : `/s/${slug}${path}`;
}

/** The same thing without the scheme, for printing on a page. */
export function shopHost(slug: string) {
  return SUBDOMAIN_LIVE
    ? `${slug}.${DOMAIN}`
    : `${OWN_HOST ?? "footfall.zone"}/s/${slug}`;
}
