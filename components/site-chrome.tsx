import Link from "next/link";
import { headers } from "next/headers";
import {
  DAYS,
  directionsLink,
  whatsappLink,
  type SiteData,
} from "@/lib/site-data";
import { shopBase } from "@/lib/site-host";

/** Path-form link base for the host serving this request, so internal
    links stay client-side navigations instead of full page loads. */
async function requestBase(slug: string) {
  return shopBase(slug, (await headers()).get("host"));
}

function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm0 18.02h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.17 8.17 0 0 1-1.25-4.35c0-4.54 3.7-8.23 8.24-8.23a8.23 8.23 0 0 1 0 16.44z" />
    </svg>
  );
}

/** A map pin, for anything that leads to the shop's location. */
function PinIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

/** Hours, phone and place — the three things a visitor checks first. */
export function UtilityBar({ data }: { data: SiteData }) {
  const { business, hours, tel } = data;
  const today = hours.find((h) => h.day === (new Date().getDay() + 6) % 7);

  return (
    <div className="hairline-b bg-paper-2">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-5 gap-y-1 px-6 py-1.5 text-[12px] sm:px-10 lg:px-14">
        {today ? (
          <span className="hidden sm:inline text-ink-soft">
            {today.closed ? (
              <span className="font-semibold text-pin">Closed today</span>
            ) : (
              <>
                <span className="font-semibold text-open-deep">Open today</span>{" "}
                {today.open}–{today.close}
              </>
            )}
          </span>
        ) : null}

        {tel ? (
          <a
            href={`tel:${tel}`}
            className="-my-2 inline-flex min-h-10 items-center font-semibold hover:text-pin"
          >
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

export async function SiteNav({ data }: { data: SiteData }) {
  const { site, business, whatsapp } = data;
  const base = await requestBase(site.slug);
  const wa = whatsappLink(
    whatsapp,
    `Hi ${business.orgName}, I found you on your website and I'd like to know more.`,
  );

  const links = [
    { href: base || "/", label: "Home" },
    { href: `${base}/services`, label: "Services" },
    { href: `${base}/about`, label: "About" },
    { href: `${base}/contact`, label: "Contact" },
  ];

  return (
    <header className="material hairline-b sticky top-0 z-40">
      <nav className="mx-auto flex max-w-[1280px] items-center gap-3 px-4 py-3 sm:gap-4 sm:px-10 sm:py-4 lg:px-14">
        <Link href={base || "/"} className="flex min-w-0 items-center gap-2.5">
          {business.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.logoUrl}
              alt=""
              width={36}
              height={36}
              referrerPolicy="no-referrer"
              className="h-9 w-9 flex-none rounded-[10px] bg-white object-contain p-0.5 shadow-card"
            />
          ) : null}
          <span className="truncate text-[17px] font-semibold leading-tight tracking-[-0.01em]">
            {business.orgName}
          </span>
        </Link>

        <ul className="ml-auto hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-[14px] font-medium text-ink-soft transition-colors hover:text-ink"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {wa ? (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary btn-sm ml-auto flex-none md:ml-0"
          >
            <WhatsAppIcon />
            Message us
          </a>
        ) : null}
      </nav>

      {/* The desktop link row above hides below md — a phone still needs a
          way to reach Services/About/Contact, so it gets a horizontally
          scrolling tab strip instead of a hamburger. No JS: this whole
          component renders on the server, and four links don't need a
          disclosure control. */}
      <div className="no-scrollbar flex items-center gap-6 overflow-x-auto border-t border-rule-soft px-4 py-1 sm:px-10 md:hidden">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="inline-flex min-h-10 flex-none items-center py-0.5 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </header>
  );
}

export async function SiteFooter({ data }: { data: SiteData }) {
  const { site, business, whatsapp, tel, areas } = data;
  const base = await requestBase(site.slug);
  const directions = directionsLink(business);

  return (
    <footer className="mt-24 bg-ink pb-[env(safe-area-inset-bottom)] text-paper">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-6 py-16 sm:grid-cols-2 sm:px-10 lg:grid-cols-4 lg:gap-8 lg:px-14">
        <div>
          <p className="text-[17px] font-semibold tracking-[-0.01em] text-white">{business.orgName}</p>
          {business.primaryCategory ? (
            <p className="mt-1.5 text-[13px] leading-relaxed text-white/50">
              {business.primaryCategory}
              {business.city ? ` in ${business.city}` : ""}
            </p>
          ) : null}
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Pages
          </p>
          <ul className="mt-4 space-y-2.5 text-[13px]">
            <li>
              <Link href={base || "/"} className="text-white/60 transition-colors hover:text-white">
                Home
              </Link>
            </li>
            <li>
              <Link href={`${base}/services`} className="text-white/60 transition-colors hover:text-white">
                Services
              </Link>
            </li>
            <li>
              <Link href={`${base}/about`} className="text-white/60 transition-colors hover:text-white">
                About
              </Link>
            </li>
            <li>
              <Link href={`${base}/contact`} className="text-white/60 transition-colors hover:text-white">
                Contact
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Contact
          </p>
          <address className="mt-4 space-y-2.5 text-[13px] not-italic leading-relaxed text-white/60">
            {business.streetAddress ? <p>{business.streetAddress}</p> : null}
            {tel ? (
              <p>
                <a href={`tel:${tel}`} className="font-semibold text-white/80 transition-colors hover:text-white">
                  {business.phone}
                </a>
              </p>
            ) : null}
          </address>
          <div className="mt-4 flex flex-wrap gap-2">
            {whatsapp ? (
              <a
                href={`https://wa.me/${whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="pressable inline-flex min-h-10 items-center rounded-full bg-white/10 px-3.5 text-[12px] font-medium text-white/80 transition-colors hover:bg-white/15 hover:text-white"
              >
                WhatsApp
              </a>
            ) : null}
            {directions ? (
              <a
                href={directions}
                target="_blank"
                rel="noreferrer"
                className="pressable inline-flex min-h-10 items-center rounded-full bg-white/10 px-3.5 text-[12px] font-medium text-white/80 transition-colors hover:bg-white/15 hover:text-white"
              >
                Directions
              </a>
            ) : null}
            {business.reviewUri ? (
              <a
                href={business.reviewUri}
                target="_blank"
                rel="noreferrer"
                className="pressable inline-flex min-h-10 items-center rounded-full bg-white/10 px-3.5 text-[12px] font-medium text-white/80 transition-colors hover:bg-white/15 hover:text-white"
              >
                Leave a review
              </a>
            ) : null}
          </div>
        </div>

        <div>
          {directions ?? business.mapsUri ? (
            /* Prefer the directions link: someone reading a shop's footer
               wants to get there, not to look at a map. Falls back to the
               plain Maps link when the listing has no coordinates.

               The faint grid and pin are drawn in CSS rather than loaded
               as a static map image — a real map tile costs an API call
               per page view, and this only has to say "location". */
            <a
              href={directions ?? business.mapsUri}
              target="_blank"
              rel="noreferrer"
              className="pressable group relative block overflow-hidden rounded-[16px] border border-white/10 bg-white/5 transition-colors hover:bg-white/10"
            >
              <span
                aria-hidden
                className="absolute inset-0 opacity-[0.18]"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,.5) 1px, transparent 1px)",
                  backgroundSize: "26px 26px",
                  maskImage:
                    "radial-gradient(60% 60% at 50% 50%, #000 30%, transparent 100%)",
                  WebkitMaskImage:
                    "radial-gradient(60% 60% at 50% 50%, #000 30%, transparent 100%)",
                }}
              />
              {/* A road sweeping past the pin, so the grid reads as a map
                  rather than as graph paper. */}
              <span
                aria-hidden
                className="absolute inset-0 opacity-[0.22]"
                style={{
                  backgroundImage:
                    "linear-gradient(115deg, transparent 46%, rgba(255,255,255,.7) 46%, rgba(255,255,255,.7) 48%, transparent 48%)",
                }}
              />
              <span className="relative grid h-[120px] place-items-center gap-1.5 text-[13px] text-white/70">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white/80 transition-colors group-hover:bg-white/20">
                  <PinIcon />
                </span>
                {directions ? "Get directions →" : "View on Google Maps →"}
              </span>
            </a>
          ) : null}
          {areas.length ? (
            <p className="mt-4 text-[12px] leading-relaxed text-white/40">
              Serving {areas.slice(0, 6).join(", ")}
              {areas.length > 6 ? " and nearby areas" : ""}.
            </p>
          ) : null}
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-[1280px] px-6 py-6 text-[12px] text-white/40 sm:px-10 lg:px-14">
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
    <section className="mx-auto max-w-[1280px] px-6 sm:px-10 lg:px-14">
      <div className="rounded-[24px] bg-ink px-6 py-10 text-white shadow-lift sm:rounded-[32px] sm:p-14">
        <h2 className="text-[clamp(2rem,4.5vw,3rem)] text-white">
          Come and see us
        </h2>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-white/70">
          {business.city
            ? `We're in ${business.city}. Message us on WhatsApp or call — we'll tell you what you need to know before you travel.`
            : "Message us on WhatsApp or call, and we'll tell you what you need before you travel."}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noreferrer"
              className="btn btn-whatsapp px-5 sm:px-[30px]"
            >
              <WhatsAppIcon />
              Message on WhatsApp
            </a>
          ) : null}
          {tel ? (
            <a
              href={`tel:${tel}`}
              className="btn bg-white/10 px-5 text-white backdrop-blur hover:bg-white/20 sm:px-[30px]"
            >
              Call {business.phone}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export { WhatsAppIcon, PinIcon, DAYS };
