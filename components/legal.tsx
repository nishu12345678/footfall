import Link from "next/link";

/*
 * The shell both legal pages sit in.
 *
 * Google's OAuth reviewers open these by hand, so they are plain HTML on
 * the same domain as the homepage, with no login in front of them and no
 * client-side rendering to wait for.
 */

export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-dvh bg-paper px-5 py-12 sm:py-16">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-display text-[19px] font-bold tracking-tight text-ink"
        >
          <span
            aria-hidden
            className="grid h-6 w-6 place-items-center rounded-[10px] bg-pin text-[11px] text-white"
          >
            ◎
          </span>
          footfall
        </Link>

        <h1 className="mt-10 font-display text-[34px] leading-tight font-bold tracking-tight text-ink sm:text-[42px]">
          {title}
        </h1>
        <p className="mt-3 text-[13px] font-medium text-muted">
          Last updated {updated}
        </p>
        <p className="mt-6 text-[16px] leading-relaxed text-ink-soft">
          {intro}
        </p>

        <div className="mt-12 space-y-10">{children}</div>

        <div className="mt-16 border-t border-black/10 pt-6">
          <p className="caption leading-relaxed">
            footfall is an independent product. It is not affiliated with,
            endorsed by, or a product of Google. Google, Google Business Profile
            and Google Maps are trademarks of Google LLC.
          </p>
        </div>
      </div>
    </main>
  );
}

export function Section({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={`s${n}`} className="scroll-mt-8">
      <h2 className="font-display text-[22px] leading-snug font-bold tracking-tight text-ink">
        <span className="mr-2 font-semibold text-pin">{n}.</span>
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[15px] leading-relaxed text-ink-soft">
        {children}
      </div>
    </section>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return <p>{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="ml-1 space-y-2.5 border-l border-black/10 pl-5">{children}</ul>
  );
}

export function LI({ children }: { children: React.ReactNode }) {
  return <li className="marker:text-muted">{children}</li>;
}

/** A pulled-out block for the clauses Google's reviewers look for. */
export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] bg-paper-2 p-5 text-[15px] leading-relaxed text-ink">
      {children}
    </div>
  );
}

export function Term({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}

export function A({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="text-pin underline underline-offset-2 hover:no-underline"
      {...(href.startsWith("http")
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      {children}
    </a>
  );
}
