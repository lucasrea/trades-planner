import { describe, expect, it, vi } from "vitest";
import { errorEventsOnly, scrubEvent } from "@/lib/observability/scrub";

/** Everything that must never leave the app. */
const SECRETS = [
  "Replace the panel for Margaret Okafor",
  "margaret@example.com",
  "$4,250.00",
  "bearer-token-9f8e7d",
  "session-cookie-1a2b3c",
  "share-token-5d6e7f",
];
const [message, email, amount, bearer, cookie, share] = SECRETS;

function loadedEvent() {
  return {
    event_id: "0123456789abcdef0123456789abcdef",
    timestamp: 1_800_000_000,
    platform: "node",
    level: "error",
    release: "abc123",
    environment: "production",
    message: `Could not save: ${message}`,
    logentry: { message, params: [email] },
    transaction: `/d/${share}`,
    server_name: message,
    user: { id: "u1", email, ip_address: "203.0.113.9" },
    request: {
      url: `https://example.test/d/${share}?token=${bearer}`,
      headers: { authorization: `Bearer ${bearer}`, cookie },
      cookies: { session: cookie },
      data: { text: message, amount },
      query_string: `token=${bearer}`,
    },
    breadcrumbs: [{ category: "console", message, data: { email } }],
    extra: { transcript: message, receipt: { total: amount } },
    modules: { [message!]: "1" },
    sdk: { name: "sentry.javascript.nextjs", version: "11.0.0" },
    tags: {
      contractor_id: "c_123",
      capture_id: "cap_456",
      plan_id: "plan_789",
      error_code: "23505",
      route: "/d/[token]",
      client_name: "Margaret Okafor",
      error_name: message,
    },
    contexts: {
      device: { model: "iPhone15,2", name: "Margaret's iPhone" },
      os: { name: "iOS", version: "19.1" },
      state: { value: message },
      nextjs: { request_path: `/d/${share}` },
    },
    exception: {
      values: [
        {
          type: "DrizzleQueryError",
          value: `Failed query: insert into clients params: ${email},${amount}`,
          mechanism: { type: "generic", handled: false, data: { note: message } },
          stacktrace: {
            frames: [
              {
                filename: `app:///_next/server/chunks/plans.js?token=${bearer}`,
                function: "recordPlanTurn",
                lineno: 12,
                colno: 3,
                in_app: true,
                vars: { text: message },
                context_line: `const text = "${message}"`,
                pre_context: [email],
                post_context: [amount],
              },
              // Lines of an error message that a stack parser mistook for frames.
              { filename: email, function: message, lineno: 1 },
              { filename: "margaret.js", function: message },
              { filename: `https://example.test/d/${share}`, lineno: 4 },
            ],
          },
        },
      ],
    },
    debug_meta: { images: [{ type: "sourcemap", code_file: "app:///_next/server/chunks/plans.js", debug_id: "abcd-1234" }] },
  };
}

describe("scrubEvent", () => {
  it("drops message text, emails, amounts, tokens and cookies wherever they sit", () => {
    const sent = JSON.stringify(scrubEvent(loadedEvent()));
    for (const secret of [...SECRETS, "Margaret", "203.0.113.9"]) expect(sent).not.toContain(secret);
  });

  it("keeps what is needed to find the fault", () => {
    const clean = scrubEvent(loadedEvent()) as unknown as Record<string, unknown>;
    expect(clean.tags).toEqual({
      contractor_id: "c_123",
      capture_id: "cap_456",
      plan_id: "plan_789",
      error_code: "23505",
      route: "/d/[token]",
    });
    expect(clean.exception).toEqual({
      values: [
        {
          type: "DrizzleQueryError",
          value: "[removed]",
          mechanism: { type: "generic", handled: false },
          stacktrace: {
            frames: [
              { filename: "app:///_next/server/chunks/plans.js", function: "recordPlanTurn", lineno: 12, colno: 3, in_app: true },
            ],
          },
        },
      ],
    });
    expect(clean.contexts).toEqual({ device: { model: "iPhone15,2" }, os: { name: "iOS", version: "19.1" } });
    expect(clean.sdk).toEqual({ name: "sentry.javascript.nextjs", version: "11.0.0", settings: { infer_ip: "never" } });
    expect(clean.release).toBe("abc123");
  });

  it("sends a message only when it is a log event name", () => {
    expect(scrubEvent({ message: "plan_turn_failed" })).toMatchObject({ message: "plan_turn_failed" });
    for (const text of ["Margaret", "call Margaret", "plan_turn_failed for Margaret"]) {
      expect(scrubEvent({ message: text })).not.toHaveProperty("message");
    }
  });
});

describe("errorEventsOnly", () => {
  it("drops everything but error events, and the trace header", async () => {
    const send = vi.fn().mockResolvedValue({});
    const transport = errorEventsOnly(() => ({ send, flush: async () => true }))({});

    await transport.send([{ sent_at: "now" }, [[{ type: "session" }, { did: "x" }]]] as never);
    expect(send).not.toHaveBeenCalled();

    await transport.send([
      { sent_at: "now", trace: { transaction: "/d/share-token" } },
      [
        [{ type: "event" }, { message: "plan_turn_failed" }],
        [{ type: "attachment" }, "photo"],
        [{ type: "client_report" }, {}],
      ],
    ] as never);
    expect(send).toHaveBeenCalledWith([{ sent_at: "now" }, [[{ type: "event" }, { message: "plan_turn_failed" }]]]);
  });
});
