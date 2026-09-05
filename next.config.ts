import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel handles its own output — standalone is only for Docker/self-host
  // Setting it on Vercel breaks API routes (500 on /api/mailtm)
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  reactStrictMode: false,
  // Dev-only: opening the app via http://127.0.0.1:3000 makes Next treat HMR
  // polls as cross-origin and answer 403/400 (tab console shows
  // "Blocked cross-origin request ... /_next/hmr"). No effect on production.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // Extensionless trust-anchor URLs (AI agents and link checkers probe /about,
  // /contact, /privacy). Served from the static .html twins in /public so both
  // spellings resolve to the same 500+ character documents.
  async rewrites() {
    return [
      { source: "/about", destination: "/about.html" },
      { source: "/contact", destination: "/contact.html" },
      { source: "/privacy", destination: "/privacy.html" },
      { source: "/faq", destination: "/faq.html" },
      { source: "/disclaimer", destination: "/disclaimer.html" },
      { source: "/docs", destination: "/docs.html" },
      { source: "/blog", destination: "/blog.html" },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
