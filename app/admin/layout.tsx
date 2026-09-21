import type { Metadata } from "next";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { AdminConvexProviders } from "@/components/convex-providers";

/**
 * The internal dashboard's own root, a sibling of /app rather than a child
 * of it.
 *
 * Three things follow from that placement, and all three are deliberate:
 *
 * 1. It is outside the customer paywall. An operator reading the numbers
 *    is staff, not a subscriber, and a plan check would lock them out.
 * 2. It is outside the app's narrow phone shell. /app is a max-w-xl column
 *    with a bottom tab bar, which is right for a shop owner on a phone and
 *    useless for a funnel and a customer table.
 * 3. It carries its own Convex Auth session — see AdminConvexProviders —
 *    so "am I signed in" works here without dragging the product's
 *    provider stack along.
 *
 * Authorisation is NOT here. proxy.ts bounces a signed-out visitor to the
 * login page, this layout establishes a session, and the page renders a
 * refusal for a non-admin — but the actual gate is `adminQuery` in
 * convex/access.ts, which checks the signed-in user's verified email
 * against ANALYTICS_ADMIN_EMAILS and answers "Not found." to everyone
 * else. Everything in the browser is decoration on top of that.
 */

export const metadata: Metadata = {
  title: "footfall — internal",
  // Belt and braces with app/robots.ts: a crawler that ignores robots.txt
  // still sees this, and a page that is refused server-side has nothing to
  // index anyway.
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConvexAuthNextjsServerProvider>
      <AdminConvexProviders>{children}</AdminConvexProviders>
    </ConvexAuthNextjsServerProvider>
  );
}
