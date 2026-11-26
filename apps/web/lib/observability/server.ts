import * as Sentry from "@sentry/nextjs";
import { EVENT_NAME, LOG_ID_TAGS, PRIVACY_OPTIONS, errorEventsOnly } from "@/lib/observability/scrub";

/**
 * Only what is needed to catch errors and read their stacks. The SDK's other defaults record
 * requests, console output, outgoing calls, local variables and sessions.
 */
const INTEGRATIONS = new Set([
  "EventFilters",
  "FunctionToString",
  "LinkedErrors",
  "Dedupe",
  "OnUncaughtException",
  "OnUnhandledRejection",
  "Context",
  "DistDirRewriteFrames",
]);

type Options = NonNullable<Parameters<typeof Sentry.init>[0]>;

/** Start server error tracking. Without a DSN this does nothing and nothing is ever sent. */
export function initServerErrorTracking(input: { dsn: string | undefined; transport?: Options["transport"] }) {
  if (!input.dsn) return false;
  Sentry.init({
    ...PRIVACY_OPTIONS,
    dsn: input.dsn,
    // No patching of the database, AI or HTTP libraries. Only tracing uses it, and tracing is off.
    enableRuntimeChannelInjection: false,
    includeServerName: false,
    integrations: (defaults) => defaults.filter((integration) => INTEGRATIONS.has(integration.name)),
    transport: errorEventsOnly(input.transport ?? Sentry.makeNodeTransport),
  });
  forwardLoggedErrors();
  return true;
}

let forwarding = false;

/**
 * Report every `console.error({ event: "..._failed", ... })` as it is logged, with its ids and the
 * error's name. Nothing else on the line is read, and other console output is not reported.
 */
function forwardLoggedErrors() {
  if (forwarding) return;
  forwarding = true;
  const log = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    log(...args);
    try {
      reportLoggedError(args[0]);
    } catch {
      // Reporting must never break the request that logged the error.
    }
  };
}

function reportLoggedError(entry: unknown) {
  if (typeof entry !== "object" || entry === null) return;
  const line = entry as Record<string, unknown>;
  const event = line.event;
  if (typeof event !== "string" || !EVENT_NAME.test(event)) return;

  const tags: Record<string, string> = {};
  for (const [field, tag] of Object.entries(LOG_ID_TAGS)) {
    const value = line[field];
    if (typeof value === "string") tags[tag] = value;
  }
  if (typeof line.name === "string") tags.error_name = line.name;
  if (typeof line.kind === "string") tags.error_kind = line.kind;

  Sentry.captureMessage(event, {
    level: "error",
    tags,
    fingerprint: [event, tags.error_name ?? "none", tags.error_kind ?? "none"],
  });
}

/** A short code such as a Postgres `23505`, from the error or its cause. */
function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const { code, cause } = error as { code?: unknown; cause?: unknown };
  return typeof code === "string" ? code : errorCode(cause);
}

/** An error Next.js caught while rendering, in a Server Action or in a route handler. */
export async function reportRequestError(
  error: unknown,
  request: { method: string },
  context: { routePath: string; routeType: string },
) {
  const code = errorCode(error);
  const digest = typeof error === "object" && error !== null ? (error as { digest?: unknown }).digest : undefined;
  Sentry.withScope((scope) => {
    scope.setTags({
      route: context.routePath,
      route_type: context.routeType,
      method: request.method,
      ...(code && { error_code: code }),
      ...(typeof digest === "string" && { digest }),
    });
    Sentry.captureException(error, { mechanism: { handled: false, type: "auto.function.nextjs.on_request_error" } });
  });
  // The function can be suspended once the response is sent.
  await Sentry.flush(2000);
}
