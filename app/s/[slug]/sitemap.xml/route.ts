import { loadSite } from "@/lib/site-data";

/**
 * A sitemap per generated site. Small, but it tells Google the four pages
 * exist and when they last changed — the competitor's has no lastmod at all.
 */
export const GET = async (
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) => {
  const { slug } = await params;
  const data = await loadSite(slug);
  if (!data) return new Response("Not found", { status: 404 });

  const origin = new URL(request.url).origin;
  const base = `${origin}/s/${data.site.slug}`;
  const lastmod = new Date(data.site.updatedAt).toISOString();

  const urls = ["", "/services", "/about", "/contact"].map(
    (path) =>
      `  <url>\n    <loc>${base}${path}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n  </url>`,
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
