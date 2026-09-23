import Link from "next/link";

/**
 * The Footfall mark, wordmark and Doubtbuddy attribution always travel as one
 * lockup. The sizes below preserve the supplied 48 / 34 / 11 visual ratio at
 * every scale so a header never turns into a different brand treatment.
 */
const SIZES = {
  display: {
    mark: "h-12 w-12",
    name: "text-[34px]",
    attribution: "text-[11px]",
    doubtbuddyMark: "h-4 w-4",
    gap: "gap-3",
    attributionGap: "mt-2 gap-1.5",
  },
  navigation: {
    mark: "h-10 w-10",
    name: "text-[28px]",
    attribution: "text-[9px]",
    doubtbuddyMark: "h-[13px] w-[13px]",
    gap: "gap-2.5",
    attributionGap: "mt-1.5 gap-1",
  },
  compact: {
    mark: "h-8 w-8",
    name: "text-[22px]",
    attribution: "text-[7px]",
    doubtbuddyMark: "h-[11px] w-[11px]",
    gap: "gap-2",
    attributionGap: "mt-1 gap-1",
  },
} as const;

type FootfallAttributionProps = {
  /** Use display for standalone placements, navigation for marketing chrome. */
  size?: keyof typeof SIZES;
  /** An internal path keeps Next's client-side navigation behavior. */
  href?: string;
  tone?: "light" | "dark";
  className?: string;
  ariaLabel?: string;
};

export function FootfallAttribution({
  size = "display",
  href,
  tone = "light",
  className = "",
  ariaLabel = "Footfall home",
}: FootfallAttributionProps) {
  const styles = SIZES[size];
  const colors =
    tone === "dark"
      ? { name: "text-white", attribution: "text-white/60" }
      : { name: "text-[var(--l-ink)]", attribution: "text-[var(--l-muted)]" };
  const lockup = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-64.png"
        alt=""
        width={48}
        height={48}
        className={`${styles.mark} flex-none`}
      />
      <span className="min-w-0">
        <span
          className={`block font-semibold leading-none tracking-[-0.055em] ${colors.name} ${styles.name}`}
        >
          footfall
        </span>
        <span
          className={`flex items-center whitespace-nowrap font-normal leading-none ${colors.attribution} ${styles.attributionGap} ${styles.attribution}`}
        >
          <span>Powered by</span>
          <span className="inline-flex items-center gap-1 font-semibold">
            <span>Doubtbuddy AI</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/doubtbuddy-mark.png"
              alt=""
              width={16}
              height={16}
              className={`${styles.doubtbuddyMark} object-contain`}
            />
          </span>
        </span>
      </span>
    </>
  );

  const sharedClassName = `inline-flex items-center ${styles.gap} ${className}`;

  if (!href) {
    return <span className={sharedClassName}>{lockup}</span>;
  }

  if (href.startsWith("/") || href.startsWith("#")) {
    return (
      <Link href={href} aria-label={ariaLabel} className={sharedClassName}>
        {lockup}
      </Link>
    );
  }

  return (
    <a
      href={href}
      aria-label={ariaLabel}
      target="_blank"
      rel="noopener noreferrer"
      className={sharedClassName}
    >
      {lockup}
    </a>
  );
}
