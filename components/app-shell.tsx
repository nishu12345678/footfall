"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LINKS } from "@/lib/content";

/** The founder's WhatsApp, same as the marketing site's "Talk on WhatsApp". */
const SUPPORT_WHATSAPP = LINKS.whatsapp;

function IconHouse() {
  return (
    <svg
      aria-hidden
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M5.5 9.5V19a1 1 0 0 0 1 1H10v-5.5h4V20h3.5a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg
      aria-hidden
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 20v-6" />
      <path d="M12 20V9" />
      <path d="M18 20v-8" />
      <path d="M4 20h16" />
    </svg>
  );
}

function IconDoc() {
  return (
    <svg
      aria-hidden
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 3.5h7L18.5 8v11a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M14 3.5V8h4.5" />
      <path d="M8.5 12.5h7" />
      <path d="M8.5 16h4.5" />
    </svg>
  );
}

function IconPhoto() {
  return (
    <svg
      aria-hidden
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="5" width="17" height="14" rx="3" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M6.5 18.5 11 14l3 3 2.5-2.5 3 3" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg
      aria-hidden
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m12 4.5 2.2 4.6 5 .7-3.6 3.6.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.6 5-.7L12 4.5Z" />
    </svg>
  );
}

function IconGear() {
  return (
    <svg
      aria-hidden
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  );
}

const NAV = [
  { href: "/app", label: "Home", Icon: IconHouse },
  { href: "/app/performance", label: "Performance", Icon: IconChart },
  { href: "/app/posts", label: "Posts", Icon: IconDoc },
  { href: "/app/photos", label: "Photos", Icon: IconPhoto },
  { href: "/app/reviews", label: "Reviews", Icon: IconStar },
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
    <header className="sticky top-0 z-30 material hairline-b">
      <div className="mx-auto flex max-w-xl items-center gap-3 px-6 py-3.5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt=""
            className="h-9 w-9 flex-none rounded-full bg-white object-contain shadow-card"
          />
        ) : (
          <span
            aria-hidden
            className="grid h-9 w-9 flex-none place-items-center rounded-full bg-pin text-[14px] font-semibold text-white shadow-card"
          >
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold leading-tight tracking-[-0.01em]">
            {name}
          </span>
          {location ? (
            <span className="block truncate text-[12px] text-muted">{location}</span>
          ) : null}
        </span>

        <a
          href={SUPPORT_WHATSAPP}
          target="_blank"
          rel="noreferrer"
          className="pressable flex-none rounded-full bg-black/5 px-3.5 py-1.5 text-[13px] font-semibold text-ink"
        >
          Help
        </a>
        <Link
          href="/app/settings"
          aria-label="Settings"
          className="pressable grid h-9 w-9 flex-none place-items-center rounded-full bg-black/5 text-ink"
        >
          <IconGear />
        </Link>
      </div>
    </header>
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-30 material hairline-t pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-xl">
        {NAV.map((item) => {
          const active =
            item.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium tracking-[0.01em] transition-colors ${
                  active ? "text-pin" : "text-muted hover:text-ink"
                }`}
              >
                <item.Icon />
                {item.label}
              </Link>
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
    <div className="flex min-h-screen flex-col bg-paper-2">
      <AppHeader name={name} location={location} logoUrl={logoUrl} />
      <div className="mx-auto w-full max-w-xl flex-1 px-6 py-8">{children}</div>
      <BottomNav />
    </div>
  );
}

export function Loading() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <p className="text-[13px] text-muted">loading…</p>
    </main>
  );
}

export function NeedsConnect() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col justify-center px-6">
      <h1 className="text-[clamp(1.8rem,5vw,2.2rem)]">connect google first</h1>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">
        Everything here comes from your Google listing.
      </p>
      <Link href="/app/connect" className="btn btn-primary mt-8 w-full">
        connect google
      </Link>
    </main>
  );
}
