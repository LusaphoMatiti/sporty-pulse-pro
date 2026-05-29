// next.config.ts
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Upload source maps so Sentry shows original TS line numbers, not compiled JS
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },

  // Hides Sentry build output in CI logs
  silent: !process.env.CI,

  // Automatically instrument Next.js routes — no manual wrapping needed
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware: true,
});
