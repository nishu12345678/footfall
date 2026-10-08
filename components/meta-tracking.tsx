"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { META_AD_PREFERENCES } from "@/lib/content";
import {
  isMetaPage,
  META_CONSENT_COOKIE,
  metaPixelId,
  readCookie,
} from "@/lib/meta";

type Choice = "granted" | "denied" | null;
type Pixel = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push?: Pixel;
  loaded?: boolean;
  version?: string;
};
type MetaWindow = Window & { fbq?: Pixel; _fbq?: Pixel };
const ID = metaPixelId();
const CHANGE = "footfall:meta-consent";
const noop = () => () => {};
const readHost = () => window.location.hostname;
const serverHost = () => null;
const serverChoice = (): Choice => null;
function readChoice(): Choice {
  const value = readCookie(document.cookie, META_CONSENT_COOKIE);
  return value === "granted" || value === "denied" ? value : null;
}
function subscribe(listener: () => void) {
  window.addEventListener(CHANGE, listener);
  return () => window.removeEventListener(CHANGE, listener);
}

function pixel() {
  const w = window as MetaWindow;
  if (w.fbq) return w.fbq;
  const fbq: Pixel = Object.assign(
    function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue.push(args);
    },
    { queue: [] as unknown[][] },
  );
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  w.fbq = w._fbq = fbq;
  fbq("consent", "grant");
  fbq("set", "autoConfig", false, ID);
  fbq("init", ID);
  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
  return fbq;
}

function saveChoice(choice: Exclude<Choice, null>) {
  document.cookie = `${META_CONSENT_COOKIE}=${choice}; Path=/; Max-Age=15552000; SameSite=Lax; Secure`;
  if (choice === "denied") {
    (window as MetaWindow).fbq?.("consent", "revoke");
    for (const name of ["_fbp", "_fbc"]) {
      for (const domain of [
        "",
        "; Domain=footfall.zone",
        "; Domain=www.footfall.zone",
      ]) {
        document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax; Secure${domain}`;
      }
    }
  }
  window.dispatchEvent(new Event(CHANGE));
}

/** Loads no Meta resources until a visitor opts in. Never active on /app or shops. */
export function MetaTracking() {
  const pathname = usePathname();
  const host = useSyncExternalStore(noop, readHost, serverHost);
  const choice = useSyncExternalStore(subscribe, readChoice, serverChoice);
  const [editing, setEditing] = useState(false);
  const lastPath = useRef<string | null>(null);
  const allowed = !!ID && host !== null && isMetaPage(host, pathname);

  useEffect(() => {
    if (!allowed || choice !== "granted") {
      (window as MetaWindow).fbq?.("consent", "revoke");
      lastPath.current = null;
      return;
    }
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    const fbq = pixel();
    fbq("consent", "grant");
    const eventId = crypto.randomUUID();
    fbq("trackSingle", ID, "PageView", {}, { eventID: eventId });
    // Independent of the vendor script loading: CAPI still works if that
    // request fails. Matching event_name + event_id prevents double counting.
    void fetch("/api/meta/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body: JSON.stringify({
        eventId,
        eventTime: Math.floor(Date.now() / 1000),
        pathname,
      }),
    }).catch(() => {}); // Tracking must never interrupt the visitor.
  }, [allowed, choice, pathname]);

  if (!allowed) return null;
  const copy = META_AD_PREFERENCES;
  if (choice !== null && !editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="fixed bottom-3 left-3 z-50 rounded-full border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700 shadow-sm"
      >
        {copy.settings}
      </button>
    );
  }
  return (
    <section
      aria-label={copy.title}
      className="fixed bottom-4 left-4 right-4 z-[100] max-w-lg rounded-2xl border border-stone-300 bg-white p-5 text-stone-900 shadow-xl"
    >
      <h2 className="text-base font-semibold">{copy.title}</h2>
      <p className="mt-2 text-sm leading-relaxed">
        {copy.description}{" "}
        <a href="/privacy" className="underline">
          {copy.privacy}
        </a>
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            saveChoice("granted");
            setEditing(false);
          }}
          className="rounded-lg border border-stone-400 px-4 py-2 text-sm font-medium"
        >
          {copy.accept}
        </button>
        <button
          type="button"
          onClick={() => {
            saveChoice("denied");
            setEditing(false);
          }}
          className="rounded-lg border border-stone-400 px-4 py-2 text-sm font-medium"
        >
          {copy.decline}
        </button>
      </div>
    </section>
  );
}
