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
}: {
  label: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  return (
    <a
      href={LINKS.whatsapp}
      target="_blank"
      rel="noopener noreferrer"
      className={`lb ${tone === "dark" ? "lb-white" : "lb-outline"} ${className}`}
    >
      <WhatsAppIcon size={18} style={{ color: WHATSAPP_GREEN }} />
      {label}
    </a>
  );
}
