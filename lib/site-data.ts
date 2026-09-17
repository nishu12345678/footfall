import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

/* Photos and logos on a shop site are Google-hosted
   (lh3.googleusercontent.com). That CDN rate-limits by referrer: one it
   does not recognise gets HTTP 429 with an HTML body, which the browser
   then refuses as an opaque response (ERR_BLOCKED_BY_ORB), and the image
   silently fails to appear — no console error on the element, just a
   broken picture.

   Measured: Referer "http://localhost:3000/" -> 429 text/html; no Referer
   at all, or a real footfall.zone host -> 200 image/jpeg.

   So every <img> pointing at one of these URLs sets
   referrerPolicy="no-referrer". Without it the shop's photos disappear in
   local development and on any host Google has not seen before, which
   includes every preview deployment. */

export type SiteData = NonNullable<
  Awaited<ReturnType<typeof loadSite>>
>;

export async function loadSite(slug: string) {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) return null;
  const client = new ConvexHttpClient(url);
  return await client.query(api.site.bySlug, { slug });
}

export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/**
 * wa.me needs the full international number, no plus, no leading zero.
 * The competitor's generator ships "wa.me/09319102143" on every card, which
 * is a dead link — this is the single highest-value detail to get right.
 */
export function whatsappLink(
  number: string | null,
  message: string,
): string | null {
  if (!number) return null;
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

export function enquiryMessage(service: string, business: string) {
  return `Hi! I'd like to know more about ${service} at ${business}.`;
}

/** A directions link, not just a place link — people want the route. */
export function directionsLink(business: {
  mapsUri?: string;
  lat?: number;
  lng?: number;
  orgName: string;
}) {
  if (business.lat && business.lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${business.lat},${business.lng}`;
  }
  return business.mapsUri ?? null;
}
