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

      <main className="mx-auto max-w-[1280px] px-6 pt-16 pb-16 sm:px-10 sm:pt-24 sm:pb-24 lg:px-14">
        <nav aria-label="Breadcrumb" className="text-[12px] text-muted">
          <a href={base} className="hover:text-pin">
            Home
          </a>
          <span aria-hidden> / </span>
          <span>About</span>
        </nav>

        <h1 className="mt-5 text-[clamp(2.4rem,5.5vw,4rem)]">
          About {business.orgName}
        </h1>
        <p className="mt-6 max-w-3xl text-[18px] leading-relaxed text-ink-soft">
          {site.about}
        </p>

        {/* Only real, checkable numbers go here. */}
        <ul className="mt-14 grid gap-6 sm:grid-cols-3 lg:gap-8">
          {rating !== null ? (
            <li className="card rounded-[22px] p-8 text-center">
              <p className="text-[40px] font-extrabold leading-none tracking-[-0.03em]">
                {rating}
                <span className="text-star"> ★</span>
              </p>
              <p className="mt-2 text-[13px] text-muted">
                from {reviewCount} Google review{reviewCount === 1 ? "" : "s"}
              </p>
            </li>
          ) : null}
          {site.services.length ? (
            <li className="card rounded-[22px] p-8 text-center">
              <p className="text-[40px] font-extrabold leading-none tracking-[-0.03em]">
                {site.services.length}
              </p>
              <p className="mt-2 text-[13px] text-muted">services offered</p>
            </li>
          ) : null}
          {areas.length ? (
            <li className="card rounded-[22px] p-8 text-center">
              <p className="text-[40px] font-extrabold leading-none tracking-[-0.03em]">
                {areas.length}
              </p>
              <p className="mt-2 text-[13px] text-muted">areas served</p>
            </li>
          ) : null}
        </ul>

        {photos.length ? (
          <section className="mt-16 sm:mt-24">
            <h2 className="text-[clamp(1.8rem,3.5vw,2.6rem)]">Inside {business.orgName}</h2>
            <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {photos.slice(0, 8).map((photo, i) =>
                photo.url ? (
                  <li key={photo._id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={photo.caption ?? `${business.orgName} photo ${i + 1}`}
                      loading="lazy"
                      className="aspect-square w-full rounded-[18px] object-cover shadow-card"
                    />
                  </li>
                ) : null,
              )}
            </ul>
          </section>
        ) : null}

        <div className="mt-16 sm:mt-24">
          <ContactBand data={data} />
        </div>
      </main>

      <SiteFooter data={data} />
    </>
  );
}
