import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ContactBand,
  SiteFooter,
  SiteNav,
  UtilityBar,
  WhatsAppIcon,
} from "@/components/site-chrome";
import {
  DAYS,
  directionsLink,
  enquiryMessage,
  loadSite,
  whatsappLink,
} from "@/lib/site-data";
import { buildJsonLd } from "@/lib/site-schema";
import { shopUrl, shopPath } from "@/lib/site-host";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadSite(slug);
  if (!data) return { title: "Not found" };

  return {
    title: data.site.metaTitle,
    description: data.site.metaDescription.slice(0, 155),
    alternates: { canonical: shopUrl(data.site.slug, "") },
    openGraph: {
      title: data.site.metaTitle,
      description: data.site.metaDescription.slice(0, 155),
      type: "website",
      images: data.photos[0]?.url
        ? [data.photos[0].url]
        : data.business.logoUrl
          ? [data.business.logoUrl]
          : undefined,
    },
  };
}

export default async function SiteHome({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadSite(slug);
  if (!data) notFound();

  const { site, business, hours, areas, reviews, photos, rating, reviewCount } =
    data;
  const base = shopPath(site.slug);
  const wa = whatsappLink(
    data.whatsapp,
    `Hi ${business.orgName}, I found you on your website and I'd like to know more.`,
  );
  const directions = directionsLink(business);
  const withText = reviews.filter((r) => r.comment);
  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(buildJsonLd(data, `/s/${site.slug}`)),
        }}
      />

      <UtilityBar data={data} />
      <SiteNav data={data} />

      <main>
        {/* hero */}
        <section className="mx-auto max-w-[1280px] px-6 pt-16 pb-16 sm:px-10 sm:pt-24 sm:pb-24 lg:px-14">
          <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-16">
            <div>
              {business.primaryCategory ? (
                <p className="chip">
                  <span className="h-1.5 w-1.5 rounded-full bg-open" aria-hidden />
                  {business.primaryCategory}
                  {business.city ? ` · ${business.city}` : ""}
                </p>
              ) : null}

              <h1 className="mt-6 text-[clamp(2.4rem,5.5vw,4rem)]">
                {site.headline}
              </h1>
              {site.subhead ? (
                <p className="mt-4 font-display text-[18px] font-medium text-ink-soft">
                  {site.subhead}
                </p>
              ) : null}
              <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-soft">
                {site.about}
              </p>

              <div className="mt-9 flex flex-wrap gap-3">
                {wa ? (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary"
                  >
                    <WhatsAppIcon />
                    Message on WhatsApp
                  </a>
                ) : null}
                <a href={`${base}/services`} className="btn btn-ghost">
                  What we offer
                </a>
              </div>

              {rating !== null ? (
                <p className="mt-7 flex items-center gap-2 text-[14px]">
                  <span className="text-star" aria-hidden>
                    {"★".repeat(Math.round(rating))}
                  </span>
                  <span className="font-semibold">{rating}</span>
                  <span className="text-muted">
                    from {reviewCount} Google review{reviewCount === 1 ? "" : "s"}
                  </span>
                </p>
              ) : null}
            </div>

            {photos[0]?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photos[0].url}
                alt={`${business.orgName}`}
                className="aspect-[4/3] w-full rounded-[24px] object-cover shadow-lift"
              />
            ) : null}
          </div>
        </section>

        {/* services */}
        {site.services.length ? (
          <section className="mx-auto max-w-[1280px] px-6 py-16 sm:px-10 sm:py-24 lg:px-14">
            <h2 className="text-[clamp(1.8rem,3.5vw,2.6rem)]">
              What we offer
              {business.city ? ` in ${business.city}` : ""}
            </h2>
            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {site.services.map((service) => {
                const link = whatsappLink(
                  data.whatsapp,
                  enquiryMessage(service.name, business.orgName),
                );
                return (
                  <li
                    key={service.name}
                    className="card flex flex-col rounded-[22px] p-8"
                  >
                    <h3 className="text-[1.25rem]">{service.name}</h3>
                    <p className="mt-2.5 flex-1 text-[15px] leading-relaxed text-ink-soft">
                      {service.body}
                    </p>
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-ghost btn-sm mt-6 w-full"
                      >
                        <WhatsAppIcon />
                        Ask about this
                      </a>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {/* gallery */}
        {photos.length > 1 ? (
          <section className="mx-auto max-w-[1280px] px-6 py-16 sm:px-10 sm:py-24 lg:px-14">
            <h2 className="text-[clamp(1.8rem,3.5vw,2.6rem)]">Have a look</h2>
            <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
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

        {/* reviews */}
        {withText.length ? (
          <section className="mx-auto max-w-[1280px] px-6 py-16 sm:px-10 sm:py-24 lg:px-14">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-[clamp(1.8rem,3.5vw,2.6rem)]">
                What customers say
              </h2>
              {business.reviewUri ? (
                <a
                  href={business.reviewUri}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[14px] font-medium text-pin hover:underline"
                >
                  Leave a review
                </a>
              ) : null}
            </div>

            <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {withText.slice(0, 6).map((review) => (
                <li
                  key={review._id}
                  className="card rounded-[22px] p-8"
                >
                  <p className="text-star" aria-label={`${review.rating} out of 5`}>
                    {"★".repeat(review.rating)}
                    <span className="text-rule">
                      {"★".repeat(5 - review.rating)}
                    </span>
                  </p>
                  <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
                    {review.comment}
                  </p>
                  <p className="mt-3 text-[13px] font-medium text-muted">
                    {review.authorName ?? "A customer"} ·{" "}
                    {new Date(review.createdAt).toLocaleDateString("en-IN", {
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* hours + areas */}
        {hours.length || areas.length ? (
          <section className="mx-auto max-w-[1280px] px-6 py-16 sm:px-10 sm:py-24 lg:px-14">
            <div className="grid gap-10 sm:grid-cols-2 lg:gap-16">
              {hours.length ? (
                <div>
                  <h2 className="text-[1.6rem]">Opening hours</h2>
                  <ul className="mt-6 divide-y divide-black/8">
                    {hours.map((h) => (
                      <li
                        key={h.day}
                        className={`flex items-center justify-between gap-3 py-2.5 text-[15px]${h.day === todayIdx ? " font-semibold text-open-deep" : ""}`}
                      >
                        <span className="font-semibold">{DAYS[h.day]}</span>
                        <span
                          className={`text-[14px]${h.day === todayIdx ? " font-semibold text-open-deep" : " text-ink-soft"}`}
                        >
                          {h.closed ? "Closed" : `${h.open} – ${h.close}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {areas.length ? (
                <div>
                  <h2 className="text-[1.6rem]">Areas we serve</h2>
                  <ul className="mt-6 flex flex-wrap gap-2">
                    {areas.slice(0, 14).map((area) => (
                      <li key={area} className="chip">
                        {area}
                      </li>
                    ))}
                  </ul>
                  {directions ? (
                    <a
                      href={directions}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-ghost btn-sm mt-5"
                    >
                      Get directions
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* faqs */}
        {site.faqs.length ? (
          <section className="mx-auto max-w-[1280px] px-6 py-16 sm:px-10 sm:py-24 lg:px-14">
            <h2 className="text-[clamp(1.8rem,3.5vw,2.6rem)]">
              Questions we get asked
            </h2>
            <div className="mt-8 divide-y divide-black/8">
              {site.faqs.map((faq) => (
                <details key={faq.q} className="group py-1">
                  <summary className="flex cursor-pointer list-none items-start gap-3 py-5 [&::-webkit-details-marker]:hidden">
                    <h3 className="flex-1 font-display text-[17px] font-semibold">
                      {faq.q}
                    </h3>
                    <span
                      aria-hidden
                      className="mt-0.5 text-[17px] font-medium text-pin transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="pb-4 pr-8 text-[15px] leading-relaxed text-ink-soft">
                    {faq.a}
                  </p>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        <div className="py-16 sm:py-24">
          <ContactBand data={data} />
        </div>
      </main>

      <SiteFooter data={data} />
    </>
  );
}
