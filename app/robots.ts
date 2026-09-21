import type { MetadataRoute } from "next";

/**
 * The generated shop sites are meant to be indexed. The product itself is
 * not — every /app route is behind a login and has nothing for a crawler.
 *
 * /admin/ is the internal analytics dashboard. Excluding it is tidiness,
 * not security: proxy.ts redirects a signed-out visitor and every backing
 * query refuses a non-admin with "Not found.", so a crawler that ignores
 * this file still gets nothing. app/admin/layout.tsx also sends
 * `robots: noindex` on the page itself, which is the instruction a crawler
 * that has somehow reached the URL will actually act on.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/s/"],
        disallow: ["/app/", "/admin/", "/api/"],
      },
    ],
  };
}
