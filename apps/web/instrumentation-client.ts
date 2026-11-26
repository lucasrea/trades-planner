import * as Sentry from "@sentry/nextjs";
import { PRIVACY_OPTIONS, errorEventsOnly } from "@/lib/observability/scrub";

/** Errors only. No clicks, console output, page addresses, sessions, traces or replays. */
const INTEGRATIONS = new Set([
  "EventFilters",
  "FunctionToString",
  "BrowserApiErrors",
  "GlobalHandlers",
  "LinkedErrors",
  "Dedupe",
  "NextjsClientStackFrameNormalization",
]);

// Off unless the DSN is set at build time.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    ...PRIVACY_OPTIONS,
    dsn,
    integrations: (defaults) => defaults.filter((integration) => INTEGRATIONS.has(integration.name)),
    transport: errorEventsOnly(Sentry.makeFetchTransport),
  });
}
