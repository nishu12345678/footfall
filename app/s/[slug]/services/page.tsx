import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ContactBand,
  SiteFooter,
  SiteNav,
  UtilityBar,
  WhatsAppIcon,
} from "@/components/site-chrome";
import { enquiryMessage, loadSite, whatsappLink } from "@/lib/site-data";
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

  const { business } = data;
  const where = business.city ? ` in ${business.city}` : "";
  return {
    title: `${business.primaryCategory ?? "Services"}${where} — ${business.orgName}`,
    description: `What ${business.orgName} offers${where}: ${data.site.services
      .slice(0, 4)
      .map((s) => s.name)
      .join(", ")}.`.slice(0, 155),
    alternates: { canonical: shopUrl(slug, "/services") },
  };
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadSite(slug);
  if (!data) notFound();

  const { site, business, areas } = data;
  const base = `/s/${site.slug}`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbs(base, [
              { name: "Home", href: "" },
              { name: "Services", href: "/services" },
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
          <span>Services</span>
        </nav>

        <h1 className="mt-5 text-[clamp(2.4rem,5.5vw,4rem)]">
          What we offer{business.city ? ` in ${business.city}` : ""}
        </h1>
        <p className="mt-6 max-w-3xl text-[17px] leading-relaxed text-ink-soft">
          {areas.length
            ? `Everything below is available at our ${business.city ?? "shop"}, and we serve ${areas.slice(0, 4).join(", ")} and the areas around them.`
            : `Everything below is available at our ${business.city ?? "shop"}.`}{" "}
          Message us about any of it and we&rsquo;ll answer the same day.
        </p>

        <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
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
                <h2 className="text-[1.25rem]">{service.name}</h2>
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

        <div className="mt-16 sm:mt-24">
          <ContactBand data={data} />
        </div>
      </main>

      <SiteFooter data={data} />
    </>
  );
}
