import type { NextConfig } from "next";

/**
 * Shop sites answer on their own subdomain.
 *
 * A shop's free site lives at <slug>.footfall.zone and is served by the
 * same /s/<slug> pages. This is a host rewrite rather than middleware on
 * purpose: middleware here is wired to Convex Auth, and a shop's website
 * must not depend on the auth system being up. A rewrite is pure routing.
 *
 * The apex — footfall.zone itself — carries no subdomain label, so it never
 * matches and the marketing page is untouched. Reserved labels are excluded
 * so www and friends can never be claimed by an awkwardly named business.
 */
const SITE_DOMAIN = (process.env.NEXT_PUBLIC_SITE_DOMAIN ?? "footfall.zone")
  .replace(/\./g, "\\.");

const RESERVED = [
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
];

const SHOP_HOST = `(?<slug>(?!(?:${RESERVED.join("|")})\\.)[a-z0-9][a-z0-9-]{0,61})\\.${SITE_DOMAIN}`;

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        // The page rewrite must run before the marketing page at `/`, but it
        // must leave Next's generated CSS/JS and public assets alone. Without
        // this exclusion a shop host rewrites `/_next/static/...` to
        // `/s/<slug>/_next/...` and loads as unstyled HTML.
        {
          source:
            "/:path((?!_next/static|_next/image|brand/|favicon\\.ico$|manifest\\.webmanifest$|robots\\.txt$).*)",
          has: [{ type: "host", value: SHOP_HOST }],
          destination: "/s/:slug/:path",
        },
      ],
      // Browsers and link previewers still ask for /favicon.ico by
      // convention. Serve the one in public/brand rather than keeping a
      // second copy at the root.
      afterFiles: [{ source: "/favicon.ico", destination: "/brand/favicon.ico" }],
      fallback: [],
    };
  },
};

export default nextConfig;
