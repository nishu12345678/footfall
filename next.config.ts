import type { NextConfig } from "next";

/**
 * Shop sites answer on their own subdomain.
 *
 * A shop's free site lives at <slug>.footfall.site and is served by the
 * same /s/<slug> pages. This is a host rewrite rather than middleware on
 * purpose: middleware here is wired to Convex Auth, and a shop's website
 * must not depend on the auth system being up. A rewrite is pure routing.
 *
 * Reserved labels are excluded so www.footfall.site and friends can never
 * be claimed by a business called "WWW".
 */
const SITE_DOMAIN = (process.env.NEXT_PUBLIC_SITE_DOMAIN ?? "footfall.site")
  .replace(/\./g, "\\.");

const RESERVED = ["www", "app", "api", "admin", "mail", "static", "cdn", "dev"];

const SHOP_HOST = `(?<slug>(?!(?:${RESERVED.join("|")})\\.)[a-z0-9][a-z0-9-]{0,61})\\.${SITE_DOMAIN}`;

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/",
          has: [{ type: "host", value: SHOP_HOST }],
          destination: "/s/:slug",
        },
        {
          source: "/:path*",
          has: [{ type: "host", value: SHOP_HOST }],
          destination: "/s/:slug/:path*",
        },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
