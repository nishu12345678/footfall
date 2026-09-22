import { BRAND, FOOTER } from "@/lib/content";

/** White footer with a hairline on top: brand column, three link columns. */
export function Footer() {
  return (
    <footer className="w-full border-t border-[var(--l-line)] px-6 py-16">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-4 lg:col-span-1">
          <div className="flex items-start gap-3">
            <a href="#top" aria-label="Back to top">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/logo-64.png"
                alt=""
                width={48}
                height={48}
                className="h-12 w-12"
              />
            </a>
            <div>
              <a href="#top" className="block text-[34px] font-semibold leading-none tracking-[-0.055em] text-[var(--l-ink)]">
                {BRAND.name}
              </a>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--l-muted)]">
                <span>Powered by</span>
                <a
                  href="https://doubtbuddy.ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold text-[var(--l-muted)] transition-opacity hover:opacity-80"
                >
                  <span>Doubtbuddy AI</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/brand/doubtbuddy-mark.png"
                    alt=""
                    width={16}
                    height={16}
                    className="h-4 w-4 object-contain"
                  />
                </a>
              </div>
            </div>
          </div>
          <p className="mt-4 max-w-[30ch] text-[15px] leading-relaxed text-[var(--l-muted)]">
            {BRAND.tagline}
          </p>
          <p className="mt-6 text-[14px] text-[var(--l-muted)]">{FOOTER.copyright}</p>
        </div>

        {FOOTER.columns.map((col) => (
          <div key={col.title}>
            <h3 className="text-[15px] font-semibold">{col.title}</h3>
            <ul className="mt-4 space-y-3">
              {col.links.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-[15px] text-[var(--l-muted)] transition-colors hover:text-[var(--l-ink)]"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-12 max-w-[1200px] border-t border-[var(--l-line)] pt-6">
        <p className="text-[13px] leading-relaxed text-[#9ca3af]">{FOOTER.legal}</p>
      </div>
    </footer>
  );
}
