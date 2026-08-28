import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/* ---------------------------------------------------------------------------
 * Hi Temp Mail — site metadata (SEO / agentic SEO / LLM-friendly)
 * Site URL is overridable via NEXT_PUBLIC_SITE_URL; the placeholder domain is
 * used consistently across canonical/OG tags, sitemap.xml and llms.txt.
 * ------------------------------------------------------------------------- */
export const SITE_NAME = "Hi Temp Mail";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://hitempmail.app";
export const SITE_DESCRIPTION =
  "Free disposable email with instant temporary addresses, OTP auto-detection and saved mailboxes you can restore days later. No login, no signup, just privacy.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Free Temporary Email, Instant OTPs`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "temporary email",
    "disposable email",
    "temp mail",
    "throwaway email",
    "fake email generator",
    "OTP receiver",
    "verification code inbox",
    "anonymous email",
    "10 minute mail",
    "burner email",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "utilities",
  alternates: { canonical: "/" },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png" }],
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    locale: "en_US",
    title: `${SITE_NAME} — Free Temporary Email, Instant OTPs`,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Hi Temp Mail — free temporary email app with OTP auto-detection",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Free Temporary Email, Instant OTPs`,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: SITE_NAME,
  },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f3fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0912" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/*
        suppressHydrationWarning on <body>: browser extensions and embedded
        preview environments can inject extra attributes (e.g. __processed_*)
        before React hydrates. It only silences attribute mismatches on the
        <body> element itself — never on children.
      */}
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <ServiceWorkerRegistrar />
        <Toaster />
      </body>
    </html>
  );
}
