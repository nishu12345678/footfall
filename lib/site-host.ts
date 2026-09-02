/**
 * Where a shop's free site actually lives.
 *
 * The address is <slug>.footfall.site, served by the /s/<slug> pages through
 * the host rewrite in next.config.ts.
 *
 * It only switches over once NEXT_PUBLIC_SITE_DOMAIN is set. Until the DNS
 * for that domain actually points here, every shop keeps its footfall.zone
 * path — a canonical tag aimed at a host that does not resolve is worse for
 * the shop than no subdomain at all.
 */
const DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN;

/** True once the subdomain is real and safe to advertise. */
export const SUBDOMAIN_LIVE = Boolean(DOMAIN);

/** The address to show an owner and to point canonical tags at. */
export function shopUrl(slug: string, path = "") {
  return DOMAIN ? `https://${slug}.${DOMAIN}${path}` : `/s/${slug}${path}`;
}

/** The same thing without the scheme, for printing on a page. */
export function shopHost(slug: string) {
  return DOMAIN ? `${slug}.${DOMAIN}` : `footfall.zone/s/${slug}`;
}
