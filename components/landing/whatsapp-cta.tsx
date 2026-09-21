import { LINKS } from "@/lib/content";
import { WhatsAppIcon } from "./icons";

/**
 * The one "talk to us on WhatsApp" affordance on the landing page.
 *
 * It used to be written out by hand in three places and had drifted into
 * three different things: a bare text link in the hero, a white button on the
 * pricing panel, and a solid green button in the closing section. Same action,
 * three looks. Everything now goes through here.
 *
 * The rule: WhatsApp is always the *second* choice next to the black primary
 * button, so it stays a secondary weight and never competes with it. The one
 * constant is the glyph — WhatsApp's own green, identical everywhere, which is
 * what makes the three placements read as the same thing.
 *
 * `tone="dark"` is for the pricing panel, where the surface is near-black and
 * a white button is what "secondary" looks like.
 */

/** WhatsApp brand green. One source of truth. */
export const WHATSAPP_GREEN = "#25d366";

export function WhatsAppCta({
  label,
  tone = "light",
  className = "",
  ctaId,
  location,
}: {
  label: string;
  tone?: "light" | "dark";
  className?: string;
  /** GA `cta_id`. Stable and hand-written — see docs/product-analytics.md. */
  ctaId?: string;
  /** GA `location`: which section of the page this button sits in. */
  location?: string;
}) {
  return (
    <a
      href={LINKS.whatsapp}
      target="_blank"
      rel="noopener noreferrer"
      className={`lb ${tone === "dark" ? "lb-white" : "lb-outline"} ${className}`}
      /* Declarative instrumentation. The single delegated listener in
         components/analytics.tsx reads these and sends cta_click, so this
         file stays a server component and no payload is written twice.
         `destination` is "whatsapp" rather than the href: the real link
         carries the founder's phone number and a prefilled message, and
         neither belongs in an analytics property. */
      {...(ctaId && location
        ? {
            "data-analytics-event": "cta_click",
            "data-analytics-cta-id": ctaId,
            "data-analytics-location": location,
            "data-analytics-destination": "whatsapp",
          }
        : {})}
    >
      <WhatsAppIcon size={18} style={{ color: WHATSAPP_GREEN }} />
      {label}
    </a>
  );
}
