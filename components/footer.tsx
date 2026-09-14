import { BRAND, FOOTER } from "@/lib/content";

export function Footer() {
  return (
    <footer className="mt-auto bg-ink px-6 py-20 text-paper sm:px-10 lg:px-16">
      <div className="mx-auto max-w-[1400px]">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div>
            <a
              href="#top"
              className="flex items-center gap-2 font-display text-[19px] font-bold tracking-tight text-white"
            >
              <span
                aria-hidden
                className="grid h-6 w-6 place-items-center rounded-full bg-pin text-[13px] text-white"
              >
                ◎
              </span>
              {BRAND.name}
            </a>
            <p className="mt-4 max-w-[26ch] text-[14px] leading-relaxed text-white/60">
              {BRAND.tagline}
            </p>
          </div>

          {FOOTER.columns.map((col) => (
            <div key={col.title}>
              <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/40">
                {col.title}
              </p>
              <ul className="mt-5 space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[14px] text-white/60 transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p
          aria-hidden
          className="mt-20 select-none font-display text-[clamp(3rem,10vw,7rem)] font-extrabold leading-none tracking-[-0.04em] text-white/95"
        >
          {BRAND.name}
        </p>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="caption leading-relaxed text-white/40">
            {FOOTER.legal}
          </p>
          <p className="caption text-white/40">{FOOTER.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
