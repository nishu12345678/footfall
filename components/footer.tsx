import { BRAND, FOOTER } from "@/lib/content";

export function Footer() {
  return (
    <footer className="mt-auto px-5 py-14">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <a
              href="#top"
              className="flex items-center gap-2 font-display text-[19px] font-bold tracking-tight"
            >
              <span
                aria-hidden
                className="grid h-6 w-6 place-items-center rounded-full border border-rule bg-pin text-[13px] text-paper-2"
              >
                ◎
              </span>
              {BRAND.name}
            </a>
            <p className="mt-3 max-w-[26ch] text-[16px] leading-relaxed text-ink-soft">
              {BRAND.tagline}
            </p>
          </div>

          {FOOTER.columns.map((col) => (
            <div key={col.title}>
              <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-muted">
                {col.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[16px] text-ink-soft transition-colors hover:text-pin"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-rule pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono text-[12px] leading-relaxed text-muted">
            {FOOTER.legal}
          </p>
          <p className="font-mono text-[12px] text-muted">{FOOTER.copyright}</p>
        </div>
      </div>
    </footer>
  );
}
