import type { NextConfig } from "next";

/*
  Build-time public env values. The app used to read these through Vite
  as VITE_*. They are read here as NEXT_PUBLIC_* first and fall back to
  the old VITE_* names, so an existing Vercel project keeps working even
  before its environment variables are renamed.
*/
const publicEnv = (name: string): string =>
  process.env[`NEXT_PUBLIC_${name}`] ?? process.env[`VITE_${name}`] ?? "";

/*
  Production proxies /api/* to the Render backend through vercel.json,
  unchanged from before, which keeps the refresh cookie first party.
  API_PROXY_TARGET is only for local development (e.g. http://localhost:3000)
  and replaces the old Vite dev server proxy.
*/
const devApiTarget = process.env.API_PROXY_TARGET;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,

  env: {
    NEXT_PUBLIC_API_BASE_URL: publicEnv("API_BASE_URL"),
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: publicEnv("GOOGLE_CLIENT_ID"),
    NEXT_PUBLIC_GOOGLE_REDIRECT_URI: publicEnv("GOOGLE_REDIRECT_URI"),
    NEXT_PUBLIC_SHOW_DELETE_ACCOUNT: publicEnv("SHOW_DELETE_ACCOUNT"),
  },

  async redirects() {
    return [
      // The landing page moved to the root. 301 keeps every existing link
      // and any ranking signal pointed at the old URL.
      { source: "/landingpage", destination: "/", statusCode: 301 },
      { source: "/landingpage.html", destination: "/", statusCode: 301 },
      { source: "/index.html", destination: "/", statusCode: 301 },
    ];
  },

  async rewrites() {
    if (!devApiTarget) return [];
    return {
      beforeFiles: [
        { source: "/api/:path*", destination: `${devApiTarget}/api/:path*` },
      ],
      afterFiles: [],
      fallback: [],
    };
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
      {
        // The push service worker must always be revalidated so fixes
        // to it reach users instead of an old copy being served from cache.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
