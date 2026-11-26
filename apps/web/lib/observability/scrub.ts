/**
 * What an error report may contain, for the web app and the phone app.
 *
 * Error messages, request data, breadcrumbs and variables can all hold message text, transcripts,
 * receipt contents, client names, emails or amounts. So nothing is removed by name: a report is
 * rebuilt from the fields listed here, and anything else is left behind.
 *
 * The phone app imports this file, so it must not import anything.
 */

const REMOVED = "[removed]";

type Fields = Record<string, unknown>;
type Check = (value: unknown) => boolean;

const matches =
  (pattern: RegExp): Check =>
  (value) =>
    typeof value === "string" && pattern.test(value);

const isNumber: Check = (value) => typeof value === "number" && Number.isFinite(value);
const isBoolean: Check = (value) => typeof value === "boolean";
/** Short machine values: ids, codes, kinds. No spaces, "@" or "$". */
const isToken = matches(/^[\w.:-]{1,80}$/);
/** Versions, device models and similar text that the SDK fills in itself. */
const isLabel = matches(/^[\w .,()+/:-]{1,100}$/);
const isHex = matches(/^(0x)?[0-9a-fA-F-]{1,64}$/);

/** Log lines are named like `plan_turn_failed`. Only such a name may be sent as a message. */
export const EVENT_NAME = /^[a-z]+(?:_[a-z]+)+$/;

/** Ids a log line may carry, and the tag each one is sent as. */
export const LOG_ID_TAGS = { contractorId: "contractor_id", captureId: "capture_id", planId: "plan_id" } as const;

const TAGS: Record<string, Check> = {
  contractor_id: isToken,
  capture_id: isToken,
  plan_id: isToken,
  error_name: isToken,
  error_kind: isToken,
  error_code: matches(/^[A-Z0-9_]{1,40}$/),
  digest: isToken,
  method: matches(/^[A-Z]{3,7}$/),
  /** A route pattern such as `/d/[token]`, set by our server hook. Never a visited URL. */
  route: matches(/^\/[\w\-[\]./()@]{0,150}$/),
  route_type: isToken,
  "event.origin": isToken,
  "event.environment": isToken,
};

const CONTEXTS: Record<string, Record<string, Check>> = {
  os: { name: isLabel, version: isLabel },
  runtime: { name: isLabel, version: isLabel },
  browser: { name: isLabel, version: isLabel },
  // Never the device name, which is often a person's name.
  device: { family: isLabel, model: isLabel, arch: isLabel, simulator: isBoolean },
  app: { app_version: isLabel, app_build: isLabel, app_identifier: isToken },
  trace: { trace_id: isHex, span_id: isHex },
};

function isFields(value: unknown): value is Fields {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function list(value: unknown): Fields[] {
  return Array.isArray(value) ? value.filter(isFields) : [];
}

function pick(source: unknown, allowed: Record<string, Check>): Fields {
  const kept: Fields = {};
  if (!isFields(source)) return kept;
  for (const [key, check] of Object.entries(allowed)) {
    if (check(source[key])) kept[key] = source[key];
  }
  return kept;
}

/** A path to code, without any query or fragment. Page addresses and free text return undefined. */
function codePath(value: unknown) {
  if (typeof value !== "string") return undefined;
  const path = value.split(/[?#]/)[0]!;
  if (/^(?:<anonymous>|\[native code\]|native|node:[\w/.]+)$/.test(path)) return path;
  return /^\S{0,500}\.(?:[cm]?[jt]sx?|hbc|bundle|jsbundle)$/i.test(path) ? path : undefined;
}

const isFunctionName = matches(/^(?:(?:async|new|get|set) )*[\w$.<>[\]#:/*?-]{1,200}$/);

function scrubFrame(frame: Fields): Fields | null {
  const filename = codePath(frame.filename);
  // A line of an error message can look like a stack frame. A real one names code and a line.
  if (!filename || !isNumber(frame.lineno)) return null;
  const absPath = codePath(frame.abs_path);
  return {
    filename,
    ...(absPath && { abs_path: absPath }),
    ...pick(frame, {
      function: isFunctionName,
      module: matches(/^[\w$.:/@[\]()-]{1,200}$/),
      lineno: isNumber,
      colno: isNumber,
      in_app: isBoolean,
      platform: isToken,
      instruction_addr: isHex,
      addr_mode: isToken,
      debug_id: isHex,
    }),
  };
}

function scrubException(exception: Fields): Fields {
  const frames = isFields(exception.stacktrace) ? list(exception.stacktrace.frames) : [];
  const mechanism = pick(exception.mechanism, {
    type: isToken,
    handled: isBoolean,
    source: isToken,
    exception_id: isNumber,
    parent_id: isNumber,
    is_exception_group: isBoolean,
  });
  return {
    type: matches(/^[A-Za-z_$][\w$.]{0,80}$/)(exception.type) ? exception.type : "Error",
    value: REMOVED,
    ...(Object.keys(mechanism).length > 0 && { mechanism }),
    stacktrace: { frames: frames.map(scrubFrame).filter((frame) => frame !== null) },
  };
}

function scrubImage(image: Fields): Fields {
  const codeFile = codePath(image.code_file);
  return {
    ...(codeFile && { code_file: codeFile }),
    ...pick(image, { type: isToken, debug_id: isHex, uuid: isHex, image_addr: isHex, image_size: isNumber, arch: isToken }),
  };
}

function rebuild(event: Fields): Fields {
  const clean: Fields = pick(event, {
    event_id: isHex,
    timestamp: isNumber,
    platform: isToken,
    level: isToken,
    release: matches(/^[\w.@+/-]{1,200}$/),
    dist: isToken,
    environment: isToken,
  });

  if (matches(EVENT_NAME)(event.message)) clean.message = event.message;
  if (Array.isArray(event.fingerprint)) clean.fingerprint = event.fingerprint.filter(isToken);

  if (isFields(event.sdk)) {
    // `infer_ip: never` tells Sentry not to record the sender's address.
    clean.sdk = { ...pick(event.sdk, { name: isToken, version: isToken }), settings: { infer_ip: "never" } };
  }

  const exceptions = isFields(event.exception) ? list(event.exception.values) : [];
  if (exceptions.length > 0) clean.exception = { values: exceptions.map(scrubException) };

  const images = isFields(event.debug_meta) ? list(event.debug_meta.images) : [];
  if (images.length > 0) clean.debug_meta = { images: images.map(scrubImage) };

  clean.tags = pick(event.tags, TAGS);

  const contexts: Fields = {};
  for (const [name, allowed] of Object.entries(CONTEXTS)) {
    const context = pick(isFields(event.contexts) ? event.contexts[name] : undefined, allowed);
    if (Object.keys(context).length > 0) contexts[name] = context;
  }
  clean.contexts = contexts;

  return clean;
}

/** `beforeSend`: the only version of an error report that leaves the app. */
export function scrubEvent<T extends object>(event: T): T {
  return rebuild(event as Fields) as T;
}

type Envelope = [Fields, [{ type?: string }, unknown][]];

/**
 * Send error events and nothing else: no sessions, traces, logs, attachments or usage reports.
 * Those do not pass through `beforeSend`, so they are dropped on the way out.
 */
export function errorEventsOnly<O, T extends { send(envelope: never): PromiseLike<object>; flush(timeout?: number): PromiseLike<boolean> }>(
  makeTransport: (options: O) => T,
) {
  return (options: O): T => {
    const transport = makeTransport(options);
    const send = transport.send.bind(transport) as unknown as (envelope: Envelope) => PromiseLike<object>;
    return {
      flush: (timeout?: number) => transport.flush(timeout),
      send: (envelope: Envelope) => {
        const [headers, items] = envelope;
        const events = items.filter(([header]) => header.type === "event");
        if (events.length === 0) return Promise.resolve({});
        // The trace header can name the page being viewed.
        const rest = { ...headers };
        delete rest.trace;
        return send([rest, events]);
      },
    } as unknown as T;
  };
}

/** SDK settings shared by every app. `beforeSend` is the guarantee; the rest avoids collecting at all. */
export const PRIVACY_OPTIONS = {
  maxBreadcrumbs: 0,
  beforeBreadcrumb: () => null,
  beforeSend: scrubEvent,
  beforeSendTransaction: () => null,
  // The web SDK only honours `beforeSendTransaction` in this mode. Tracing is off either way.
  traceLifecycle: "static" as const,
  sendClientReports: false,
  tracePropagationTargets: [] as string[],
  dataCollection: {
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [] as never[],
    urlQueryParams: false,
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    stackFrameVariables: false,
    frameContextLines: 0,
  },
};
