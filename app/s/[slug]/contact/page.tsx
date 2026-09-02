import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  SiteFooter,
  SiteNav,
  UtilityBar,
  WhatsAppIcon,
} from "@/components/site-chrome";
import {
  DAYS,
  directionsLink,
  loadSite,
  whatsappLink,
} from "@/lib/site-data";
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

  const where = data.business.city ? ` in ${data.business.city}` : "";
  return {
    title: `Contact ${data.business.orgName}${where}`,
    description:
      `Call, message or visit ${data.business.orgName}${where}. ${data.business.streetAddress ?? ""}`.slice(
        0,
        155,
      ),
    alternates: { canonical: shopUrl(slug, "/contact") },
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await loadSite(slug);
  if (!data) notFound();

  const { site, business, hours, tel } = data;
  const base = `/s/${site.slug}`;
  const wa = whatsappLink(
    data.whatsapp,
    `Hi ${business.orgName}, I found you on your website and I'd like to know more.`,
  );
  const directions = directionsLink(business);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbs(base, [
              { name: "Home", href: "" },
              { name: "Contact", href: "/contact" },
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
          <span>Contact</span>
        </nav>

        <h1 className="mt-4 text-[clamp(2rem,6vw,3rem)]">
          Contact {business.orgName}
        </h1>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-ink-soft">
          The quickest way to reach us is WhatsApp — we answer the same day.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[14px] border border-ink bg-paper-2 p-5 shadow-[3px_4px_0_var(--color-ink)]">
            <h2 className="text-[1.2rem]">Where we are</h2>
            {business.streetAddress ? (
              <address className="mt-3 text-[15px] not-italic leading-relaxed text-ink-soft">
                {business.streetAddress}
                {business.pinCode ? (
                  <>
                    <br />
                    {business.pinCode}
                  </>
                ) : null}
              </address>
            ) : null}
            {directions ? (
              <a
                href={directions}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost btn-sm mt-4"
              >
                Get directions
              </a>
            ) : null}
          </div>

          <div className="rounded-[14px] border border-ink bg-paper-2 p-5 shadow-[3px_4px_0_var(--color-ink)]">
            <h2 className="text-[1.2rem]">Talk to us</h2>
            <div className="mt-4 flex flex-col gap-2">
              {wa ? (
                <a
                  href={wa}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary w-full"
                >
                  <WhatsAppIcon />
                  WhatsApp us
                </a>
              ) : null}
              {tel ? (
                <a href={`tel:${tel}`} className="btn btn-ghost w-full">
                  Call {business.phone}
                </a>
              ) : null}
              {business.reviewUri ? (
                <a
                  href={business.reviewUri}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 text-center font-mono text-[11px] underline underline-offset-4 hover:text-pin"
                >
                  been before? leave us a review
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {hours.length ? (
          <section className="mt-10">
            <h2 className="text-[1.5rem]">When we&rsquo;re open</h2>
            <ul className="mt-4 max-w-md divide-y divide-rule-soft border-y border-rule">
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

        {business.mapsUri ? (
          <a
            href={business.mapsUri}
            target="_blank"
            rel="noreferrer"
            className="mt-10 block overflow-hidden rounded-[14px] border border-ink shadow-[3px_4px_0_var(--color-ink)]"
          >
            <span className="grid h-[180px] place-items-center bg-paper-2 text-[15px] text-ink-soft">
              Open {business.orgName} on Google Maps →
            </span>
          </a>
        ) : null}
      </main>

      <SiteFooter data={data} />
    </>
  );
}
