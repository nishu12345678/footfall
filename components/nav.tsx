import { BRAND, LINKS, NAV, PRICING } from "@/lib/content";

export function Nav() {
  return (
    <>
      {/* announcement strip — the same offer that appears under pricing */}
      <div className="bg-pin text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-1 px-5 py-2.5 text-center">
          <span className="text-[14px] font-semibold">
            {PRICING.offer.heading}
          </span>
          <span className="hidden text-[14px] text-white/80 sm:inline">
            — five local shops, set up by hand, free this week
          </span>
          <a
            href={LINKS.cta}
            className="text-[14px] font-semibold underline underline-offset-4 hover:text-white/80"
          >
            Take one →
          </a>
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-rule bg-white/90 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
          <a
            href="#top"
            className="flex flex-none items-center gap-2 text-[21px] font-extrabold tracking-tight"
          >
            <span
              aria-hidden
              className="grid h-8 w-8 place-items-center rounded-lg bg-pin text-[15px] text-white"
            >
              ◎
            </span>
            {BRAND.name}
          </a>

          <ul className="ml-auto hidden items-center gap-7 lg:flex">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="text-[16px] font-medium text-ink-soft transition-colors hover:text-pin"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="ml-auto flex flex-none items-center gap-2 lg:ml-0">
            {/* The green one first on desktop: for a lot of owners the
                first move is a message, not a signup. */}
            <a
              href={LINKS.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-whatsapp btn-sm hidden sm:inline-flex"
            >
              WhatsApp
            </a>
            <a href={LINKS.cta} className="btn btn-primary btn-sm">
              Try now
            </a>
          </div>
        </nav>
      </header>
    </>
  );
}
