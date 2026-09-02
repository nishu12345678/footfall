import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ContactBand,
  SiteFooter,
  SiteNav,
  UtilityBar,
} from "@/components/site-chrome";
import { loadSite } from "@/lib/site-data";
import { breadcrumbs } from "@/lib/site-schema";
import { shopUrl } from "@/lib/site-host";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadSite(slug);
  if (!data) return { title: "Not found" };

  return {
    title: `About ${data.business.orgName}${data.business.city ? ` — ${data.business.city}` : ""}`,
    description: data.site.about.slice(0, 155),
    alternates: { canonical: shopUrl(slug, "/about") },
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadSite(slug);
  if (!data) notFound();

  const { site, business, areas, photos, rating, reviewCount } = data;
  const base = `/s/${site.slug}`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbs(base, [
              { name: "Home", href: "" },
              { name: "About", href: "/about" },
            ]),
          ),
        }}
      />

      <UtilityBar data={data} />
      <SiteNav data={data} />

      <main className="mx-auto max-w-5xl px-5 pt-12 pb-10">
        <nav aria-label="Breadcrumb" className="font-mono text-[11px] text-muted">
          <a href={base} className="hover:text-pin">
            Home
          </a>
          <span aria-hidden> / </span>
          <span>About</span>
        </nav>

        <h1 className="mt-4 text-[clamp(2rem,6vw,3rem)]">
          About {business.orgName}
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-ink-soft">
          {site.about}
        </p>

        {/* Only real, checkable numbers go here. */}
        <ul className="mt-8 grid gap-3 sm:grid-cols-3">
          {rating !== null ? (
            <li className="rounded-[14px] border border-ink bg-paper-2 p-5 text-center shadow-[3px_4px_0_var(--color-ink)]">
              <p className="font-display text-[2rem] font-bold leading-none">
                {rating}
                <span className="text-star"> ★</span>
              </p>
              <p className="mt-1 text-[13px] text-muted">
                from {reviewCount} Google review{reviewCount === 1 ? "" : "s"}
              </p>
            </li>
          ) : null}
          {site.services.length ? (
            <li className="rounded-[14px] border border-ink bg-paper-2 p-5 text-center shadow-[3px_4px_0_var(--color-ink)]">
              <p className="font-display text-[2rem] font-bold leading-none">
                {site.services.length}
              </p>
              <p className="mt-1 text-[13px] text-muted">services offered</p>
            </li>
          ) : null}
          {areas.length ? (
            <li className="rounded-[14px] border border-ink bg-paper-2 p-5 text-center shadow-[3px_4px_0_var(--color-ink)]">
              <p className="font-display text-[2rem] font-bold leading-none">
                {areas.length}
              </p>
              <p className="mt-1 text-[13px] text-muted">areas served</p>
            </li>
          ) : null}
        </ul>

        {photos.length ? (
          <section className="mt-12">
            <h2 className="text-[1.5rem]">Inside {business.orgName}</h2>
            <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {photos.slice(0, 8).map((photo, i) =>
                photo.url ? (
                  <li key={photo._id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.caption ?? `${business.orgName} photo ${i + 1}`}
                      loading="lazy"
                      className="aspect-square w-full rounded-[10px] border border-rule object-cover"
                    />
                  </li>
                ) : null,
              )}
            </ul>
          </section>
        ) : null}

        <div className="mt-12">
          <ContactBand data={data} />
        </div>
      </main>

      <SiteFooter data={data} />
    </>
  );
}
