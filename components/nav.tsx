import { BRAND, LINKS, NAV, PRICING } from "@/lib/content";

export function Nav() {
  return (
    <>
      {/* announcement strip — the same offer that appears under pricing */}
      <div className="border-b border-ink bg-ink text-paper-2">
        <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-5 py-2 text-center">
          <span className="font-mono text-[11px] tracking-wide">
            {PRICING.offer.heading}
          </span>
          <span className="hidden text-[12px] text-paper-2/70 sm:inline">
            five local shops, set up by hand, free this week
          </span>
          <a
            href={LINKS.cta}
            className="font-mono text-[11px] underline underline-offset-4 hover:text-star"
          >
            take one →
          </a>
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-rule bg-paper/85 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center gap-6 px-5 py-3">
          <a
            href="#top"
            className="flex items-center gap-2 font-display text-[19px] font-bold tracking-tight"
          >
            <span
              aria-hidden
              className="grid h-6 w-6 place-items-center rounded-full border border-ink bg-pin text-[11px] text-paper-2"
            >
              ◎
            </span>
            {BRAND.name}
          </a>

          <ul className="ml-auto hidden items-center gap-6 md:flex">
            {NAV.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="text-[14px] text-ink-soft transition-colors hover:text-pin"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>

          <a href={LINKS.cta} className="btn btn-primary btn-sm ml-auto md:ml-0">
            check my listing
          </a>
        </nav>
      </header>
    </>
  );
}
