import type { Instrumentation } from "next";

// Error tracking is off, and the SDK is never loaded, unless the DSN is set.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export async function register() {
  if (!dsn || process.env.NEXT_RUNTIME !== "nodejs") return;
  const { initServerErrorTracking } = await import("./lib/observability/server");
  initServerErrorTracking({ dsn });
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (!dsn || process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportRequestError } = await import("./lib/observability/server");
  await reportRequestError(error, request, context);
};
