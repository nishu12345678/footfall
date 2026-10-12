/**
 * The Meta Pixel event contract, in one place.
 *
 * The pixel exists to run ads: Meta learns which visitors reached a
 * conversion and finds more people like them. That is the whole job, and
 * docs/product-analytics.md keeps it in its lane — the pixel is a
 * marketing-attribution copy of intent, never product or revenue truth.
 * Convex remains the ledger.
 *
 * Four standard events, and only four, each one of Meta's pre-defined
 * names so Events Manager and ad optimisation work without a custom
 * conversion:
 *
 *   Contact            content_name, content_category        (CTA press)
 *   Lead               content_name                          (sign-in start)
 *   InitiateCheckout   value, currency, content_ids, content_name,
 *                      content_type, num_items
 *   Purchase           value, currency, content_ids, content_name,
 *                      content_type, num_items
 *
 * PageView is sent by components/meta-pixel.tsx on every route and is not
 * part of this list because it carries no parameters.
 *
 * The same three rules as lib/ga.ts, enforced at runtime:
 *
 * 1. An event name that is not one of the four is refused.
 * 2. A parameter key that is not on that event's allowlist is dropped.
 * 3. A value that looks like an identifier (email, phone, Convex id) is
 *    dropped even if its key is allowed.
 *
 * What is never sent, by construction: name, email, phone, business name,
 * any Convex document id. Meta's "advanced matching" (hashed email/phone
 * passed to fbq('init')) is deliberately not wired: the privacy policy
 * says the pixel does not receive anything that identifies a person, and
 * there is no setter here that could make that false.
 */

import { metaPixelId } from "./analytics";
import { looksLikeIdentifier } from "./ga";

/* ------------------------------- the shape ------------------------------- */

export type MetaValue = string | number | boolean | string[];
export type MetaParams = Record<string, MetaValue>;

/** The only four events this product sends by hand. */
export const META_EVENTS = [
  "Contact",
  "Lead",
  "InitiateCheckout",
  "Purchase",
] as const;

export type MetaEventName = (typeof META_EVENTS)[number];

/**
 * Per-event parameter allowlist. All of them are Meta's own standard
 * parameter names, so the value/currency pair feeds ROAS reporting and
 * content_ids feeds catalogue-free dynamic audiences.
 */
const ALLOWED_PARAMS: Record<MetaEventName, readonly string[]> = {
  Contact: ["content_name", "content_category"],
  Lead: ["content_name"],
  InitiateCheckout: [
    "value",
    "currency",
    "content_ids",
    "content_name",
    "content_type",
    "num_items",
  ],
  Purchase: [
    "value",
    "currency",
    "content_ids",
    "content_name",
    "content_type",
    "num_items",
  ],
};

/** Params whose string form should reach Meta as a number. */
const NUMERIC_KEYS = new Set(["value", "num_items"]);

export function isMetaEvent(name: string): name is MetaEventName {
  return (META_EVENTS as readonly string[]).includes(name);
}

/**
 * Reduce a set of parameters to what this event is allowed to carry.
 *
 * Returns the cleaned payload plus the names of everything removed, so a
 * caller (or a test) can assert that nothing was quietly thrown away.
 */
export function sanitizeMetaParams(
  event: MetaEventName,
  params: MetaParams,
): { params: MetaParams; dropped: string[] } {
  const allowed = ALLOWED_PARAMS[event];
  const out: MetaParams = {};
  const dropped: string[] = [];

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) continue;

    if (!allowed.includes(key)) {
      dropped.push(key);
      continue;
    }

    if (key === "content_ids") {
      if (!Array.isArray(value)) {
        dropped.push(key);
        continue;
      }
      const ids = value.filter(
        (v): v is string => typeof v === "string" && !looksLikeIdentifier(v),
      );
      if (ids.length !== value.length) dropped.push("content_ids[]");
      if (ids.length > 0) out.content_ids = ids;
      continue;
    }

    if (looksLikeIdentifier(value)) {
      dropped.push(key);
      continue;
    }

    if (NUMERIC_KEYS.has(key)) {
      const n = typeof value === "number" ? value : Number(value);
      if (Number.isFinite(n)) out[key] = n;
      else dropped.push(key);
      continue;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      out[key] = value;
    } else {
      dropped.push(key);
    }
  }

  return { params: out, dropped };
}

/* ----------------------------- event builders ----------------------------
   One function per event, so a call site cannot invent a parameter name.
   The inputs are the same ones the GA builders take, so a call site that
   already reports to GA passes the same plan / amount / method through. */

export function contactParams(input: {
  ctaId: string;
  location: string;
}): MetaParams {
  return sanitizeMetaParams("Contact", {
    content_name: input.ctaId,
    content_category: input.location,
  }).params;
}

/** The sign-in methods this product offers. Not an identifier. */
export type MetaLeadMethod = "google" | "email_otp" | "phone_otp";

export function leadParams(method: MetaLeadMethod): MetaParams {
  return sanitizeMetaParams("Lead", { content_name: method }).params;
}

function planParams(input: {
  plan: string;
  amountPaise: number;
  currency: string;
}): MetaParams {
  return {
    value: input.amountPaise / 100,
    currency: input.currency,
    content_ids: [input.plan],
    content_name: `footfall ${input.plan} plan`,
    content_type: "product",
    num_items: 1,
  };
}

export function initiateCheckoutParams(input: {
  plan: string;
  amountPaise: number;
  currency: string;
}): MetaParams {
  return sanitizeMetaParams("InitiateCheckout", planParams(input)).params;
}

export function purchaseParams(input: {
  plan: string;
  amountPaise: number;
  currency: string;
}): MetaParams {
  return sanitizeMetaParams("Purchase", planParams(input)).params;
}

/* ------------------------------ the transport ---------------------------- */

/**
 * The shape of the stub Meta's base code installs on window.
 *
 * Until fbevents.js arrives, `fbq` is a function that pushes its own
 * `arguments` onto `queue`; the library drains it on load and swaps in
 * `callMethod`. The stub below is the official snippet's, written out so
 * the loader can be a plain <Script src> and nothing here depends on the
 * order in which React mounts the script and runs the effects.
 */
export type Fbq = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: IArguments[];
  push: Fbq;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

/** Official fbevents.js address; the loader script uses the same one. */
export const META_PIXEL_SRC = "https://connect.facebook.net/en_US/fbevents.js";

/**
 * Install the queueing stub if nothing has yet. Idempotent, exactly like
 * the IIFE in Meta's snippet (`if(f.fbq)return`), so a second mount or a
 * browser extension that got there first is left alone.
 */
export function ensureFbq(w: Window = window): Fbq {
  if (w.fbq) return w.fbq;
  // `function`, not an arrow, and `arguments`, not a rest parameter:
  // fbevents.js replays `queue` entries as arguments objects.
  const n = function () {
    if (n.callMethod) {
      // eslint-disable-next-line prefer-rest-params, prefer-spread
      n.callMethod.apply(n, arguments as unknown as unknown[]);
    } else {
      // eslint-disable-next-line prefer-rest-params
      n.queue.push(arguments);
    }
  } as Fbq;
  if (!w._fbq) w._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
  w.fbq = n;
  return n;
}

/** Push one command onto the pixel queue. */
export function fbqPush(...args: unknown[]) {
  if (typeof window === "undefined") return;
  ensureFbq(window)(...args);
}

/* Whether events may be sent at all.
 *
 * components/meta-pixel.tsx owns this: it is the one place that knows
 * whether this host and path are ours to measure and whether
 * NEXT_PUBLIC_META_PIXEL_ID is configured. Until it says yes, metaEvent is
 * a no-op, so a stray CTA on a shop microsite sends nothing. */
let tracking = false;

export function setMetaTracking(on: boolean) {
  tracking = on;
}

export function metaTracking(): boolean {
  return tracking;
}

/**
 * Send one standard event. Returns whether it was queued, which is what
 * makes this testable from the outside and debuggable from the console.
 */
export function metaEvent(event: MetaEventName, params: MetaParams = {}): boolean {
  if (!isMetaEvent(event)) return false;
  if (!tracking || metaPixelId() === null) return false;

  const { params: clean, dropped } = sanitizeMetaParams(event, params);
  if (dropped.length > 0 && process.env.NODE_ENV !== "production") {
    console.warn(
      `[meta-pixel] dropped disallowed parameter(s) from ${event}: ${dropped.join(", ")}`,
    );
  }
  fbqPush("track", event, clean);
  return true;
}
