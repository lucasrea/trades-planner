import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
import { securityHeaders } from "./lib/http/security-headers";

const nextConfig: NextConfig = {
  serverExternalPackages: ["postgres"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders(process.env.NODE_ENV === "production") }];
  },
};

// Source maps go to Sentry only from a build that has all three settings. Local and CI builds don't.
const { SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT } = process.env;

export default SENTRY_AUTH_TOKEN && SENTRY_ORG && SENTRY_PROJECT
  ? withSentryConfig(nextConfig, {
      authToken: SENTRY_AUTH_TOKEN,
      org: SENTRY_ORG,
      project: SENTRY_PROJECT,
      telemetry: false,
      silent: !process.env.CI,
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      // What gets collected is decided in instrumentation, not added by the build.
      buildTimeInstrumentation: false,
      routeManifestInjection: false,
      suppressOnRouterTransitionStartWarning: true,
    })
  : nextConfig;
