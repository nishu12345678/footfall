import type { MetadataRoute } from "next";

/**
 * The generated shop sites are meant to be indexed. The product itself is
 * not — every /app route is behind a login and has nothing for a crawler.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/s/"],
        disallow: ["/app/", "/api/"],
      },
    ],
  };
}
