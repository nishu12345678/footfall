import {
  DAYS,
  directionsLink,
  whatsappLink,
  type SiteData,
} from "@/lib/site-data";

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.02h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.17 8.17 0 0 1-1.25-4.35c0-4.54 3.7-8.23 8.24-8.23a8.23 8.23 0 0 1 0 16.44z" />
    </svg>
  );
}

/** Hours, phone and place — the three things a visitor checks first. */
export function UtilityBar({ data }: { data: SiteData }) {
  const { business, hours, tel } = data;
  const today = hours.find((h) => h.day === (new Date().getDay() + 6) % 7);

  return (
    <div className="border-b border-rule bg-paper-3">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-1 px-5 py-1.5 text-[12px]">
        {today ? (
          <span className="hidden sm:inline text-ink-soft">
            {today.closed ? (
              <span className="font-semibold text-pin">Closed today</span>
            ) : (
              <>
                <span className="font-semibold text-open">Open today</span>{" "}
                {today.open}–{today.close}
              </>
            )}
          </span>
        ) : null}

        {tel ? (
          <a href={`tel:${tel}`} className="font-semibold hover:text-pin">
            {business.phone}
          </a>
        ) : null}

        {business.city ? (
          <span className="ml-auto hidden text-ink-soft sm:inline">
            {business.streetAddress ?? business.city}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function SiteNav({ data }: { data: SiteData }) {
  const { site, business, whatsapp } = data;
  const base = `/s/${site.slug}`;
  const wa = whatsappLink(
    whatsapp,
    `Hi ${business.orgName}, I found you on your website and I'd like to know more.`,
  );

  const links = [
    { href: base, label: "Home" },
    { href: `${base}/services`, label: "Services" },
    { href: `${base}/about`, label: "About" },
    { href: `${base}/contact`, label: "Contact" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/95 backdrop-blur-md">
      <nav className="mx-auto flex max-w-5xl items-center gap-4 px-5 py-3">
        <a href={base} className="flex min-w-0 items-center gap-2.5">
          {business.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.logoUrl}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 flex-none rounded-[8px] border border-ink bg-white object-contain p-0.5"
            />
          ) : null}
          <span className="truncate font-display text-[17px] font-bold leading-tight">
            {business.orgName}
          </span>
        </a>

        <ul className="ml-auto hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-[14px] text-ink-soft transition-colors hover:text-pin"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary btn-sm ml-auto md:ml-0"
          >
            <WhatsAppIcon />
            Message us
          </a>
        ) : null}
      </nav>
    </header>
  );
}

export function SiteFooter({ data }: { data: SiteData }) {
  const { site, business, whatsapp, tel, areas } = data;
  const base = `/s/${site.slug}`;
  const directions = directionsLink(business);

  return (
    <footer className="mt-16 border-t border-rule bg-paper-3">
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-[17px] font-bold">{business.orgName}</p>
          {business.primaryCategory ? (
            <p className="mt-1 text-[13px] text-ink-soft">
              {business.primaryCategory}
              {business.city ? ` in ${business.city}` : ""}
            </p>
          ) : null}
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Pages
          </p>
          <ul className="mt-3 space-y-2 text-[14px]">
            <li>
              <a href={base} className="text-ink-soft hover:text-pin">
                Home
              </a>
            </li>
            <li>
              <a href={`${base}/services`} className="text-ink-soft hover:text-pin">
                Services
              </a>
            </li>
            <li>
              <a href={`${base}/about`} className="text-ink-soft hover:text-pin">
                About
              </a>
            </li>
            <li>
              <a href={`${base}/contact`} className="text-ink-soft hover:text-pin">
                Contact
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Contact
          </p>
          <address className="mt-3 space-y-2 text-[14px] not-italic leading-relaxed text-ink-soft">
            {business.streetAddress ? <p>{business.streetAddress}</p> : null}
            {tel ? (
              <p>
                <a href={`tel:${tel}`} className="font-semibold hover:text-pin">
                  {business.phone}
                </a>
              </p>
            ) : null}
          </address>
          <div className="mt-3 flex flex-wrap gap-2">
            {whatsapp ? (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-ink px-2.5 py-1 text-[12px]"
              >
                WhatsApp
              </a>
            ) : null}
            {directions ? (
              <a
                href={directions}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-ink px-2.5 py-1 text-[12px]"
              >
                Directions
              </a>
            ) : null}
            {business.reviewUri ? (
              <a
                href={business.reviewUri}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-ink px-2.5 py-1 text-[12px]"
              >
                Leave a review
              </a>
            ) : null}
          </div>
        </div>

        <div>
          {business.mapsUri ? (
            <a
              href={business.mapsUri}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-[12px] border border-ink"
            >
              <span className="grid h-[120px] place-items-center bg-paper-2 text-[13px] text-ink-soft">
                View on Google Maps →
              </span>
            </a>
          ) : null}
          {areas.length ? (
            <p className="mt-3 text-[12px] leading-relaxed text-muted">
              Serving {areas.slice(0, 6).join(", ")}
              {areas.length > 6 ? " and nearby areas" : ""}.
            </p>
          ) : null}
        </div>
      </div>

      <div className="border-t border-rule">
        <p className="mx-auto max-w-5xl px-5 py-4 font-mono text-[10px] text-muted">
          © {new Date().getFullYear()} {business.orgName}. Site by footfall.
        </p>
      </div>
    </footer>
  );
}

/** The band that closes every page. */
export function ContactBand({ data }: { data: SiteData }) {
  const { business, whatsapp, tel } = data;
  const wa = whatsappLink(
    whatsapp,
    `Hi ${business.orgName}, I found you on your website and I'd like to know more.`,
  );

  return (
    <section className="mx-auto max-w-5xl px-5">
      <div className="rounded-[16px] border border-ink bg-ink p-7 text-paper-2 shadow-[4px_5px_0_var(--color-pin)] sm:p-9">
        <h2 className="text-[clamp(1.5rem,4vw,2.2rem)] text-paper-2">
          Come and see us
        </h2>
        <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-paper-2/80">
          {business.city
            ? `We're in ${business.city}. Message us on WhatsApp or call — we'll tell you what you need to know before you travel.`
            : "Message us on WhatsApp or call, and we'll tell you what you need before you travel."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {wa ? (
            <a href={wa} target="_blank" rel="noreferrer" className="btn btn-primary">
              <WhatsAppIcon />
              Message on WhatsApp
            </a>
          ) : null}
          {tel ? (
            <a
              href={`tel:${tel}`}
              className="btn btn-ghost border-paper-2 bg-transparent text-paper-2"
            >
              Call {business.phone}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export { WhatsAppIcon, DAYS };
