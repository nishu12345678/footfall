/** Shared, deliberately narrow rules for Footfall's website-visit campaign. */
export const META_CONSENT_COOKIE = "footfall_meta_consent";
export const META_PUBLIC_PATHS = new Set(["/", "/privacy", "/terms"]);

export function metaPixelId() {
  const id = (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "").trim();
  return /^\d{5,30}$/.test(id) ? id : null;
}

// Exact hosts only: no customer microsites, localhost, Vercel previews or app.
export function isMetaPage(host: string, pathname: string) {
  return (
    ["footfall.zone", "www.footfall.zone"].includes(host.toLowerCase()) &&
    META_PUBLIC_PATHS.has(pathname)
  );
}

export function readCookie(cookies: string, name: string) {
  return cookies
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export type MetaPageView = {
  eventId: string;
  eventTime: number;
  pathname: string;
};

export function parseMetaPageView(
  input: unknown,
  now = Date.now(),
): MetaPageView | null {
  if (!input || typeof input !== "object") return null;
  const value = input as Record<string, unknown>;
  if (
    typeof value.eventId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.eventId,
    ) ||
    typeof value.eventTime !== "number" ||
    !Number.isInteger(value.eventTime) ||
    value.eventTime > Math.floor(now / 1000) + 60 ||
    value.eventTime < Math.floor(now / 1000) - 300 ||
    typeof value.pathname !== "string" ||
    !META_PUBLIC_PATHS.has(value.pathname)
  )
    return null;
  // Ignore all extra fields, particularly arbitrary events or customer data.
  return {
    eventId: value.eventId,
    eventTime: value.eventTime,
    pathname: value.pathname,
  };
}

export function metaBrowserId(value: string | undefined, kind: "fbp" | "fbc") {
  if (!value || value.length > 512) return undefined;
  const pattern =
    kind === "fbp"
      ? /^fb\.\d\.\d{13}\.\d+$/
      : /^fb\.\d\.\d{13}\.[A-Za-z0-9_-]+$/;
  return pattern.test(value) ? value : undefined;
}
