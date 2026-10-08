import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      // Checked BEFORE static files and pages.
      // Rewrites POST /analyze → the internal API route so the
      // Expo bundle can call /analyze without knowing the proxy path.
      beforeFiles: [
        {
          source: "/analyze",
          destination: "/api/analyze",
        },
      ],
      // Checked AFTER pages but BEFORE 404.
      afterFiles: [],
      // SPA fallback: any path not matched by static files or pages
      // gets served index.html so Expo Router can handle it client-side.
      fallback: [
        {
          source: "/(.*)",
          destination: "/index.html",
        },
      ],
    };
  },
};

export default nextConfig;
