import * as Sentry from "@sentry/react-native";
// The same rules as the web app. That file imports nothing, so it can be bundled here.
import { scrubEvent } from "../../web/lib/observability/scrub";

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN ?? "";

/**
 * Native crash reports are written and sent by the iOS and Android SDKs, so the scrubbing below
 * cannot reach them. They stay off unless this is set. See the PR that added it before turning it on.
 */
const NATIVE_CRASHES = process.env.EXPO_PUBLIC_SENTRY_NATIVE_CRASHES === "true";

/** Errors only. No taps, console output, requests, sessions, traces, screenshots or replays. */
const INTEGRATIONS = new Set([
  "ReactNativeErrorHandlers",
  "NativeLinkedErrors",
  "InboundFilters",
  "EventFilters",
  "FunctionToString",
  "Dedupe",
  "Release",
  "EventOrigin",
  "SdkInfo",
  "RewriteFrames",
  "DebugMeta",
  "DeviceContext",
  "ExpoContext",
  "DebugSymbolicator",
  // The Expo web build.
  "BrowserApiErrors",
  "GlobalHandlers",
  "LinkedErrors",
]);

/** Report uncaught errors and unhandled rejections. Without a DSN nothing starts and nothing is sent. */
export function initCrashReporting() {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    integrations: (defaults) => defaults.filter((integration) => INTEGRATIONS.has(integration.name)),
    beforeSend: scrubEvent,
    beforeSendTransaction: () => null,
    beforeBreadcrumb: () => null,
    maxBreadcrumbs: 0,
    sendDefaultPii: false,
    sendClientReports: false,
    tracePropagationTargets: [],
    enableAutoSessionTracking: false,
    enableAutoPerformanceTracing: false,
    enableCaptureFailedRequests: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableNativeCrashHandling: NATIVE_CRASHES,
    enableNdk: NATIVE_CRASHES,
    enableAppHangTracking: false,
    enableWatchdogTerminationTracking: false,
  });
}
