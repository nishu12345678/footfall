import type { Metadata, Viewport } from "next";
import "./globals.css";

/*
 * No webfont at all — the platform's own face carries the product.
 *
 * SF Pro on Apple devices, the native grotesk everywhere else. The
 * system font ships optical sizing, size-specific tracking tables and
 * legibility tuning that no downloaded family matches, renders Hindi-
 * English mixed text through the platform's own fallbacks, and costs
 * zero bytes on a cheap Android connection.
 */

/*
 * The absolute address the shop sites live at.
 *
 * Every page under /s/ sets a canonical tag as a relative path. Next needs
 * a base to turn those into real URLs, and with none it quietly uses
 * http://localhost:3000 — a canonical pointing at localhost is worse than
 * no canonical at all, and those are the only pages here meant to be
 * indexed. Set NEXT_PUBLIC_SITE_URL to override it on a preview build.
 */
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://footfall.zone";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Proves to Google Search Console that we own the domain. Search Console
  // verification is what lets footfall.zone be an authorised domain on the
  // OAuth consent screen, so removing this tag would break the Google
  // connection, not just the search reporting.
  verification: {
    google: "jLgYVhR1S5umFCcmwDTQSmnj2cIlqbivodfmdl7G-yQ",
  },
  title: "footfall — The AI that runs your Google listing",
  description:
    "Your Google listing is where customers nearby decide. footfall posts every week, replies to every review, collects new ones and answers enquiries on WhatsApp — so people walk in. Built for Indian salons, clinics and shops.",
  openGraph: {
    title: "footfall — The AI that runs your Google listing",
    description:
      "Stop paying for Instagram posts nobody sees. footfall works on the listing your customers actually search.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <div className="relative z-10 flex min-h-full flex-col">{children}</div>
      </body>
    </html>
  );
}
