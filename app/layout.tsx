import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/*
 * One family for the whole product.
 *
 * The page had three: a display face, a body face and a monospace for
 * labels. Monospace labels read as "developer tool" to a shop owner, and
 * the display face fought with Hindi-English mixed words. Inter carries
 * all of it, and the extra weights are what give headings their authority
 * instead of a second family.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

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
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="relative z-10 flex min-h-full flex-col">{children}</div>
      </body>
    </html>
  );
}
