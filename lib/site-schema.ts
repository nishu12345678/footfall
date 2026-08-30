import { DAYS, type SiteData } from "@/lib/site-data";

/**
 * Structured data for the generated site.
 *
 * Server-rendered on purpose. The competitor injects theirs client-side from
 * a third-party CDN, so any failure of that script means no schema at all,
 * and non-JS crawlers see nothing. This ships in the HTML.
 *
 * Everything here traces back to the Google listing. Nothing is invented —
 * no rating without reviews, no hours without hours.
 */
export function buildJsonLd(data: SiteData, pageUrl: string) {
  const { site, business, hours, areas, reviews, rating, reviewCount } = data;
  const orgId = `${pageUrl}#organization`;

  const open = hours.filter((h) => !h.closed && h.open && h.close);

  const localBusiness: Record<string, unknown> = {
    "@type": "LocalBusiness",
    "@id": `${pageUrl}#business`,
    parentOrganization: { "@id": orgId },
    name: business.orgName,
    url: pageUrl,
    description: site.metaDescription,
    ...(business.logoUrl ? { image: business.logoUrl, logo: business.logoUrl } : {}),
    ...(data.tel ? { telephone: data.tel } : {}),
    ...(business.email ? { email: business.email } : {}),
    address: {
      "@type": "PostalAddress",
      ...(business.streetAddress ? { streetAddress: business.streetAddress } : {}),
      // The locality, not just the city — it's what the copy targets and
      // what people actually search.
      ...(business.city ? { addressLocality: business.city } : {}),
      ...(business.state ? { addressRegion: business.state } : {}),
      ...(business.pinCode ? { postalCode: business.pinCode } : {}),
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
      ? { areaServed: areas.map((name) => ({ "@type": "Place", name })) }
      : {}),
    ...(open.length
      ? {
          openingHoursSpecification: open.map((h) => ({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: `https://schema.org/${DAYS[h.day]}`,
            opens: h.open,
            closes: h.close,
          })),
        }
      : {}),
    ...(site.services.length
      ? {
          hasOfferCatalog: {
            "@type": "OfferCatalog",
            name: `Services at ${business.orgName}`,
            itemListElement: site.services.map((s, i) => ({
              "@type": "Offer",
              position: i + 1,
              itemOffered: {
                "@type": "Service",
                name: s.name,
                description: s.body,
              },
            })),
          },
        }
      : {}),
  };

  // Only claim a rating when real reviews back it.
  if (rating !== null && reviewCount > 0) {
    localBusiness.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: rating,
      reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  const withText = reviews.filter((r) => r.comment && r.authorName).slice(0, 5);
  if (withText.length) {
    localBusiness.review = withText.map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.authorName },
      datePublished: new Date(r.createdAt).toISOString().slice(0, 10),
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
      reviewBody: r.comment,
    }));
  }

  const graph: Record<string, unknown>[] = [
    {
      "@type": "Organization",
      "@id": orgId,
      name: business.orgName,
      url: pageUrl,
      ...(business.logoUrl ? { logo: business.logoUrl } : {}),
      ...(data.tel
        ? {
            contactPoint: {
              "@type": "ContactPoint",
              telephone: data.tel,
              contactType: "customer service",
              areaServed: "IN",
              availableLanguage: ["en", "hi"],
            },
          }
        : {}),
    },
    localBusiness,
  ];

  if (site.faqs.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": `${pageUrl}#faq`,
      mainEntity: site.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

export function breadcrumbs(
  base: string,
  trail: { name: string; href: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${base}${item.href}`,
    })),
  };
}
