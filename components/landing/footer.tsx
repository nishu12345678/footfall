import { BRAND, FOOTER } from "@/lib/content";
import { FootfallAttribution } from "@/components/footfall-attribution";

/** White footer with a hairline on top: brand column, three link columns. */
export function Footer() {
  return (
    <footer className="w-full border-t border-[var(--l-line)] px-6 py-16">
      <div className="mx-auto grid max-w-[1200px] grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-4 lg:col-span-1">
          <FootfallAttribution href="#top" ariaLabel="Back to top" />
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
