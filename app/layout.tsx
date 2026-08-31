import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter, Space_Mono } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
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
  title: "footfall — an ai that runs your google listing",
  description:
    "your google listing is where people nearby decide. footfall keeps it posting, replies to every review, collects new ones, and answers enquiries — so people walk in.",
  openGraph: {
    title: "footfall — an ai that runs your google listing",
    description:
      "stop paying for instagram posts nobody sees. footfall works on the listing people actually search.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f6f2e9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${inter.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="grain min-h-full flex flex-col">
        <div className="relative z-10 flex min-h-full flex-col">{children}</div>
      </body>
    </html>
  );
}
