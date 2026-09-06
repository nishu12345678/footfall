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
  const todayIdx = (new Date().getDay() + 6) % 7;

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

      <main className="mx-auto max-w-[1280px] px-6 pt-16 pb-16 sm:px-10 sm:pt-24 sm:pb-24 lg:px-14">
        <nav aria-label="Breadcrumb" className="text-[12px] text-muted">
          <a href={base} className="hover:text-pin">
            Home
          </a>
          <span aria-hidden> / </span>
          <span>Contact</span>
        </nav>

        <h1 className="mt-5 text-[clamp(2.4rem,5.5vw,4rem)]">
          Contact {business.orgName}
        </h1>
        <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-ink-soft">
          The quickest way to reach us is WhatsApp — we answer the same day.
        </p>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:gap-8">
          <div className="card rounded-[22px] p-8">
            <h2 className="text-[1.3rem]">Where we are</h2>
            {business.streetAddress ? (
              <address className="mt-4 text-[15px] not-italic leading-relaxed text-ink-soft">
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
                className="btn btn-ghost btn-sm mt-6"
              >
                Get directions
              </a>
            ) : null}
          </div>

          <div className="card rounded-[22px] p-8">
            <h2 className="text-[1.3rem]">Talk to us</h2>
            <div className="mt-5 flex flex-col gap-2.5">
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
                  className="mt-1 text-center text-[13px] font-medium text-muted hover:text-pin"
                >
                  been before? leave us a review
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {hours.length ? (
          <section className="mt-16 sm:mt-20">
            <h2 className="text-[1.6rem]">When we&rsquo;re open</h2>
            <ul className="mt-6 max-w-md divide-y divide-black/8">
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
          </section>
        ) : null}

        {business.mapsUri ? (
          <a
            href={business.mapsUri}
            target="_blank"
            rel="noreferrer"
            className="card pressable mt-16 block overflow-hidden rounded-[22px] sm:mt-20"
          >
            <span className="grid h-[220px] place-items-center bg-paper-2 text-[15px] text-ink-soft">
              Open {business.orgName} on Google Maps →
            </span>
          </a>
        ) : null}
      </main>

      <SiteFooter data={data} />
    </>
  );
}
