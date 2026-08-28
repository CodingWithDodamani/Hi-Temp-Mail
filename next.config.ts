import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "standalone" powers self-hosting (npm run build:standalone + npm start);
  // Vercel ignores it and uses its own optimized output, so it is safe to keep.
  output: "standalone",
  reactStrictMode: false,
};

export default nextConfig;
