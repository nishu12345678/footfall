/**
 * The GA4 custom-event contract, in one place.
 *
 * docs/product-analytics.md draws a hard line between the three sources of
 * truth: GA answers "how did an anonymous visitor arrive and what did they
 * press", Convex answers everything about a customer, and Razorpay plus the
 * Convex ledger answer everything about money. GA is therefore allowed to
 * know about *intent* and nothing else.
 *
 * Four explicit events, and only four:
 *
 *   cta_click        cta_id, location, destination
 *   login_start      method
 *   begin_checkout   currency, value, items          (standard GA shape)
 *   purchase         transaction_id, currency, value, items
 *
 * Everything here is deliberately small and mostly pure, so the part that
 * matters — "can a name, an email, a phone number or a Convex document id
 * reach Google" — is decided by a function a test can call, not by reading
 * every call site and hoping.
 *
 * Three rules this file enforces at runtime:
 *
 * 1. An event name that is not one of the four is refused.
 * 2. A parameter key that is not on that event's allowlist is dropped. An
 *    allowlist rather than a blocklist, because the failure mode of a
 *    blocklist is "we forgot to ban this one", and that failure mode is a
 *    privacy incident.
 * 3. A value that *looks* like an identifier is dropped even if its key is
 *    allowed — belt and braces for the case where a call site passes the
 *    wrong variable into the right slot.
 *
 * What is never sent, by construction: name, email, phone, business name,
 * any Convex document id, and GA's `user_id`. There is no setter for
 * `user_id` in this module on purpose; the privacy policy says GA is not
 * connected to an account, and adding one would make that false.
 */

import { gaId } from "./analytics";

/* ------------------------------- the shape ------------------------------- */

/** A GA `items` entry. Plans, never customers. */
export type GaItem = {
  item_id: string;
  item_name: string;
  item_category?: string;
  price?: number;
  quantity?: number;
};

export type GaValue = string | number | boolean | GaItem[];
export type GaParams = Record<string, GaValue>;

/** The only four events this product sends by hand. */
export const GA_EVENTS = [
  "cta_click",
  "login_start",
  "begin_checkout",
  "purchase",
] as const;

export type GaEventName = (typeof GA_EVENTS)[number];

/**
 * Per-event parameter allowlist.
 *
 * `begin_checkout` and `purchase` keep GA's own names so the standard
 * ecommerce reports work without a custom dimension; the other two are
 * ours. Nothing here is a person.
 */
const ALLOWED_PARAMS: Record<GaEventName, readonly string[]> = {
  cta_click: ["cta_id", "location", "destination"],
  login_start: ["method"],
  begin_checkout: ["currency", "value", "items"],
  purchase: ["transaction_id", "currency", "value", "items"],
};

/** Keys allowed inside an `items` entry. */
const ALLOWED_ITEM_KEYS = [
  "item_id",
  "item_name",
  "item_category",
  "price",
  "quantity",
] as const;

/** Params whose string form should reach GA as a number. */
const NUMERIC_KEYS = new Set(["value", "price", "quantity"]);

export function isGaEvent(name: string): name is GaEventName {
  return (GA_EVENTS as readonly string[]).includes(name);
}

/* ------------------------------ the PII net ------------------------------ */

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
/** Ten or more digits in a row: an Indian mobile, with or without +91. */
const PHONE = /\d[\d\s-]{8,}\d/;
/**
 * A bare lowercase alphanumeric token of 24+ characters — the shape of a
 * Convex document id. Razorpay ids (`order_…`, `pay_…`) carry an
 * underscore and mixed case, so they are not caught by this.
 */
const DOC_ID = /^[a-z0-9]{24,}$/;

/**
 * True when a value looks like something that identifies a person or a
 * row. Conservative on purpose: a dropped parameter costs a marketing
 * report a dimension, a leaked one costs a privacy promise.
 */
export function looksLikeIdentifier(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const v = value.trim();
  if (!v) return false;
  if (EMAIL.test(v)) return true;
  if (DOC_ID.test(v)) return true;
  // A path or a URL routinely carries long numbers; a phone number does
  // not arrive wrapped in one. Only check the bare value.
  if (!v.includes("/") && PHONE.test(v)) return true;
  return false;
}

function cleanItems(items: GaItem[]): { items: GaItem[]; dropped: string[] } {
  const dropped: string[] = [];
  const out: GaItem[] = [];
  for (const raw of items) {
    if (!raw || typeof raw !== "object") {
      dropped.push("items[]");
      continue;
    }
    const item: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (!(ALLOWED_ITEM_KEYS as readonly string[]).includes(key)) {
        dropped.push(`items.${key}`);
        continue;
      }
      if (looksLikeIdentifier(value)) {
        dropped.push(`items.${key}`);
        continue;
      }
      if (typeof value === "string" || typeof value === "number") {
        item[key] = value;
      }
    }
    if (typeof item.item_id === "string" && typeof item.item_name === "string") {
      out.push(item as unknown as GaItem);
    } else {
      dropped.push("items[]");
    }
  }
  return { items: out, dropped };
}

/**
 * Reduce a set of parameters to what this event is allowed to carry.
 *
 * Returns the cleaned payload plus the names of everything removed, so a
 * caller (or a test) can assert that nothing was quietly thrown away.
 */
export function sanitizeGaParams(
  event: GaEventName,
  params: GaParams,
): { params: GaParams; dropped: string[] } {
  const allowed = ALLOWED_PARAMS[event];
  const out: GaParams = {};
  const dropped: string[] = [];

  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === undefined || value === null) continue;

    if (!allowed.includes(key)) {
      dropped.push(key);
      continue;
    }

    if (key === "items") {
      if (!Array.isArray(value)) {
        dropped.push(key);
        continue;
      }
      const cleaned = cleanItems(value as GaItem[]);
      dropped.push(...cleaned.dropped);
      if (cleaned.items.length > 0) out.items = cleaned.items;
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

/* --------------------------- data-* attributes ---------------------------
   Instrumenting a button should not mean importing a hook into a server
   component. Anything that carries data-analytics-event is picked up by
   one delegated listener (components/analytics.tsx); these two functions
   are the pure translation between the DOM's dataset and a GA payload.  */

/** `analyticsCtaId` -> `cta_id`. Returns null for anything else. */
export function datasetKeyToParam(datasetKey: string): string | null {
  if (datasetKey === "analyticsEvent") return null;
  if (!datasetKey.startsWith("analytics") || datasetKey === "analytics") {
    return null;
  }
  const rest = datasetKey.slice("analytics".length);
  if (!rest) return null;
  return rest
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/^_+/, "")
    .toLowerCase();
}

/**
 * Turn an element's dataset into an event name and its parameters.
 * Unknown event names and disallowed parameters are refused here, so the
 * markup cannot widen the contract.
 */
export function paramsFromDataset(dataset: Record<string, string | undefined>): {
  event: GaEventName;
  params: GaParams;
} | null {
  const name = dataset.analyticsEvent?.trim();
  if (!name || !isGaEvent(name)) return null;

  const raw: GaParams = {};
  for (const [key, value] of Object.entries(dataset)) {
    if (value === undefined) continue;
    const param = datasetKeyToParam(key);
    if (!param) continue;
    raw[param] = value;
  }

  const { params } = sanitizeGaParams(name, raw);
  return { event: name, params };
}

/* ----------------------------- event builders ----------------------------
   One function per event, so a call site cannot invent a parameter name
   and quietly create a dimension nobody reports on.                      */

export function ctaClickParams(input: {
  ctaId: string;
  location: string;
  destination?: string | null;
}): GaParams {
  return sanitizeGaParams("cta_click", {
    cta_id: input.ctaId,
    location: input.location,
    ...(input.destination ? { destination: input.destination } : {}),
  }).params;
}

/** The sign-in methods this product offers. Not an identifier. */
export type LoginMethod = "google" | "email_otp" | "phone_otp";

export function loginStartParams(method: LoginMethod): GaParams {
  return sanitizeGaParams("login_start", { method }).params;
}

/** A plan as a GA item. Plan id and display name only — never a business. */
export function planItem(plan: string, amountPaise: number): GaItem {
  return {
    item_id: plan,
    item_name: `footfall ${plan} plan`,
    item_category: "subscription",
    price: amountPaise / 100,
    quantity: 1,
  };
}

export function beginCheckoutParams(input: {
  plan: string;
  amountPaise: number;
  currency: string;
}): GaParams {
  return sanitizeGaParams("begin_checkout", {
    currency: input.currency,
    value: input.amountPaise / 100,
    items: [planItem(input.plan, input.amountPaise)],
  }).params;
}

export function purchaseParams(input: {
  transactionId: string;
  plan: string;
  amountPaise: number;
  currency: string;
}): GaParams {
  return sanitizeGaParams("purchase", {
    transaction_id: input.transactionId,
    currency: input.currency,
    value: input.amountPaise / 100,
    items: [planItem(input.plan, input.amountPaise)],
  }).params;
}

/* ------------------------- the once-per-purchase gate --------------------
   Razorpay's handler, the "check payment status now" button and a reload
   can all observe the same paid order. GA's purchase report treats a
   repeated transaction_id as a second sale, so the browser has to refuse
   to send it twice. sessionStorage rather than a ref: a reload of the
   billing page mid-confirmation would reset a ref.                      */

export function purchaseGuardKey(transactionId: string): string {
  return `ff_ga_purchase:${transactionId}`;
}

type MiniStorage = Pick<Storage, "getItem" | "setItem">;

function sessionStore(): MiniStorage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.sessionStorage;
  } catch {
    // Safari in private mode, or a blocked third-party context.
    return null;
  }
}

/**
 * Claim the right to report this transaction exactly once.
 *
 * Returns true the first time it is asked about a transaction id and
 * false afterwards. With no usable storage it returns true — a missing
 * purchase is worse than a duplicated one, and the store is only missing
 * where sessionStorage itself is unavailable.
 */
export function claimPurchase(
  transactionId: string,
  store: MiniStorage | null = sessionStore(),
): boolean {
  if (!transactionId) return false;
  if (!store) return true;
  const key = purchaseGuardKey(transactionId);
  try {
    if (store.getItem(key)) return false;
    store.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

/* ------------------------------ the transport ---------------------------- */

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/**
 * Push one command onto the GA queue.
 *
 * `function`, not an arrow, and `arguments`, not the rest parameter: all
 * gtag() ever does is push its own `arguments` object, and gtag.js
 * *ignores a plain array*. The typed rest parameter exists so call sites
 * typecheck; the body must not use it.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function gaPush(...args: unknown[]) {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line prefer-rest-params
  (window.dataLayer ??= []).push(arguments);
}

/* Whether custom events may be sent at all.
 *
 * components/analytics.tsx owns this: it is the one place that knows
 * whether this host and path are ours to measure (a shop microsite is
 * not) and whether NEXT_PUBLIC_GA_ID is configured. Until it says yes,
 * gaEvent is a no-op — so a stray CTA on a shop site cannot push the
 * shop's visitors into our property even if the markup carries a
 * data-analytics-event attribute. */
let tracking = false;

export function setGaTracking(on: boolean) {
  tracking = on;
}

export function gaTracking(): boolean {
  return tracking;
}

/**
 * Send one contract event. Returns whether it was queued, which is what
 * makes this testable from the outside and debuggable from the console.
 */
export function gaEvent(event: GaEventName, params: GaParams = {}): boolean {
  if (!isGaEvent(event)) return false;
  if (!tracking || gaId() === null) return false;

  const { params: clean, dropped } = sanitizeGaParams(event, params);
  if (dropped.length > 0 && process.env.NODE_ENV !== "production") {
    console.warn(
      `[ga] dropped disallowed parameter(s) from ${event}: ${dropped.join(", ")}`,
    );
  }
  gaPush("event", event, clean);
  return true;
}
