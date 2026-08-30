import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

async function load(slug: string) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  const client = new ConvexHttpClient(url);
  return await client.query(api.site.bySlug, { slug });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) return { title: "Not found" };

  const { site, business } = data;
  return {
    title: site.metaTitle,
    description: site.metaDescription,
    alternates: { canonical: `/s/${site.slug}` },
    openGraph: {
      title: site.metaTitle,
      description: site.metaDescription,
      type: "website",
      images: business.logoUrl ? [business.logoUrl] : undefined,
    },
  };
}

export default async function SitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await load(slug);
  if (!data) notFound();

  const { site, business, hours, areas, reviews } = data;

  // LocalBusiness structured data — how Google reads a small business page.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business.orgName,
    description: site.metaDescription,
    ...(business.logoUrl ? { image: business.logoUrl, logo: business.logoUrl } : {}),
    ...(business.phone ? { telephone: business.phone } : {}),
    ...(business.email ? { email: business.email } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: business.streetAddress ?? undefined,
      addressLocality: business.city ?? undefined,
      postalCode: business.pinCode ?? undefined,
      addressCountry: "IN",
    },
    ...(business.lat && business.lng
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: business.lat,
            longitude: business.lng,
          },
        }
      : {}),
    ...(business.mapsUri ? { hasMap: business.mapsUri } : {}),
    ...(areas.length
      ? { areaServed: areas.map((a) => ({ "@type": "Place", name: a })) }
      : {}),
    ...(hours.length
      ? {
          openingHoursSpecification: hours
            .filter((h) => !h.closed && h.open && h.close)
            .map((h) => ({
              "@type": "OpeningHoursSpecification",
              dayOfWeek: `https://schema.org/${DAYS[h.day]}`,
              opens: h.open,
              closes: h.close,
            })),
        }
      : {}),
    ...(site.faqs.length
      ? {
          mainEntityOfPage: {
            "@type": "FAQPage",
            mainEntity: site.faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
        }
      : {}),
  };

  const tel = business.phone?.replace(/\s+/g, "");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="mx-auto w-full max-w-2xl px-5 py-10">
        {/* hero */}
        <header className="flex items-start gap-4">
          {business.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.logoUrl}
              alt={`${business.orgName} logo`}
              className="h-14 w-14 flex-none rounded-[12px] border border-ink bg-white object-contain p-1"
            />
          ) : null}
          <div className="min-w-0">
            <h1 className="text-[clamp(1.8rem,6vw,2.6rem)]">{site.headline}</h1>
            {site.subhead ? (
              <p className="mt-2 font-display text-[16px] font-medium text-ink-soft">
                {site.subhead}
              </p>
            ) : null}
          </div>
        </header>

        <div className="mt-6 flex flex-wrap gap-2">
          {tel ? (
            <a href={`tel:${tel}`} className="btn btn-primary">
              Call {business.phone}
            </a>
          ) : null}
          {business.mapsUri ? (
            <a
              href={business.mapsUri}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost"
            >
              Get directions
            </a>
          ) : null}
        </div>

        {business.streetAddress ? (
          <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
            {business.streetAddress}
            {business.pinCode ? ` — ${business.pinCode}` : ""}
          </p>
        ) : null}

        {/* about */}
        {site.about ? (
          <section className="mt-10">
            <h2 className="text-[1.5rem]">About us</h2>
            <p className="mt-3 text-[16px] leading-relaxed text-ink-soft">
              {site.about}
            </p>
          </section>
        ) : null}

        {/* services */}
        {site.services.length ? (
          <section className="mt-10">
            <h2 className="text-[1.5rem]">What we offer</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {site.services.map((s) => (
                <li
                  key={s.name}
                  className="rounded-[14px] border border-ink bg-paper-2 p-4 shadow-[3px_3px_0_var(--color-ink)]"
                >
                  <h3 className="text-[1.05rem]">{s.name}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                    {s.body}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* hours */}
        {hours.length ? (
          <section className="mt-10">
            <h2 className="text-[1.5rem]">Opening hours</h2>
            <ul className="mt-4 divide-y divide-rule-soft border-y border-rule">
              {hours.map((h) => (
                <li
                  key={h.day}
                  className="flex items-center justify-between gap-3 py-2.5 text-[15px]"
                >
                  <span className="font-semibold">{DAYS[h.day]}</span>
                  <span className="font-mono text-[13px] text-ink-soft">
                    {h.closed ? "Closed" : `${h.open} – ${h.close}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* areas */}
        {areas.length ? (
          <section className="mt-10">
            <h2 className="text-[1.5rem]">Areas we serve</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {areas.map((a) => (
                <li
                  key={a}
                  className="rounded-full border border-ink bg-paper-2 px-3 py-1.5 text-[14px]"
                >
                  {a}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* reviews */}
        {reviews.length ? (
          <section className="mt-10">
            <h2 className="text-[1.5rem]">What customers say</h2>
            <ul className="mt-4 space-y-3">
              {reviews.map((r) => (
                <li
                  key={r._id}
                  className="rounded-[14px] border border-rule bg-paper-2 p-4"
                >
                  <p className="text-star" aria-label={`${r.rating} out of 5`}>
                    {"★".repeat(Math.round(r.rating))}
                  </p>
                  {r.comment ? (
                    <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                      {r.comment}
                    </p>
                  ) : null}
                  <p className="mt-2 font-mono text-[11px] text-muted">
                    {r.authorName ?? "A customer"}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* faqs */}
        {site.faqs.length ? (
          <section className="mt-10">
            <h2 className="text-[1.5rem]">Questions we get asked</h2>
            <div className="mt-4 divide-y divide-rule border-y border-rule">
              {site.faqs.map((f) => (
                <details key={f.q} className="group py-1">
                  <summary className="flex cursor-pointer list-none items-start gap-3 py-3.5 [&::-webkit-details-marker]:hidden">
                    <span className="flex-1 font-display text-[16px] font-semibold">
                      {f.q}
                    </span>
                    <span
                      aria-hidden
                      className="mt-0.5 font-mono text-pin transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-4 pr-8 text-[15px] leading-relaxed text-ink-soft">
                    {f.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        <footer className="mt-12 border-t border-rule pt-6">
          <p className="text-[15px] font-semibold">{business.orgName}</p>
          {business.streetAddress ? (
            <p className="mt-1 text-[14px] leading-relaxed text-ink-soft">
              {business.streetAddress}
            </p>
          ) : null}
          {business.phone ? (
            <p className="mt-1 font-mono text-[13px] text-ink-soft">
              {business.phone}
            </p>
          ) : null}
          <p className="mt-4 font-mono text-[10px] text-muted">
            Site by footfall
          </p>
        </footer>
      </main>
    </>
  );
}
