"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/app", label: "Home", icon: "⌂" },
  { href: "/app/performance", label: "Performance", icon: "▚" },
  { href: "/app/posts", label: "Posts", icon: "▤" },
  { href: "/app/photos", label: "Photos", icon: "▣" },
  { href: "/app/reviews", label: "Reviews", icon: "★" },
];

export function AppHeader({
  name,
  location,
  logoUrl,
}: {
  name: string;
  location?: string;
  logoUrl?: string;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-paper/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-center gap-3 px-5 py-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="h-9 w-9 flex-none rounded-full border border-ink bg-white object-contain"
          />
        ) : (
          <span
            aria-hidden
            className="grid h-9 w-9 flex-none place-items-center rounded-full border border-ink bg-pin font-display text-[14px] font-bold text-paper-2"
          >
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[16px] font-bold leading-tight">
            {name}
          </span>
          {location ? (
            <span className="block truncate text-[12px] text-pin">{location}</span>
          ) : null}
        </span>

        <a
          href="https://wa.me/"
          target="_blank"
          rel="noreferrer"
          className="flex-none rounded-full border border-ink px-3 py-1.5 font-display text-[12px] font-semibold"
        >
          Help
        </a>
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-30 border-t border-rule bg-paper/95 backdrop-blur-md">
      <ul className="mx-auto flex max-w-md">
        {NAV.map((item) => {
          const active =
            item.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <a
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] transition-colors ${
                  active ? "text-pin" : "text-muted hover:text-ink"
                }`}
              >
                <span aria-hidden className="text-[15px] leading-none">
                  {item.icon}
                </span>
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Standard page frame for every signed-in screen. */
export function AppScreen({
  name,
  location,
  logoUrl,
  children,
}: {
  name: string;
  location?: string;
  logoUrl?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader name={name} location={location} logoUrl={logoUrl} />
      <div className="mx-auto w-full max-w-md flex-1 px-5 py-5">{children}</div>
      <BottomNav />
    </div>
  );
}

export function Loading() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <p className="font-mono text-[12px] text-muted">loading…</p>
    </main>
  );
}

export function NeedsConnect() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6">
      <h1 className="text-[1.8rem]">connect google first</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
        Everything here comes from your Google listing.
      </p>
      <a href="/app/connect" className="btn btn-primary mt-6 w-full">
        connect google
      </a>
    </main>
  );
}
