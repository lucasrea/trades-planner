import * as Sentry from "@sentry/nextjs";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { initServerErrorTracking, reportRequestError } from "@/lib/observability/server";

/**
 * Runs the real SDK with a transport that only collects what would have been sent. Nothing reaches
 * Sentry; the DSN points at a host that cannot resolve.
 */
const DSN = "https://public@errors.invalid/1";
const sent: unknown[] = [];
const transport = () => ({
  send: async (envelope: unknown) => {
    sent.push(envelope);
    return {};
  },
  flush: async () => true,
});

const consoleError = console.error;
const output = vi.fn();
console.error = output;

afterAll(async () => {
  await Sentry.close();
  console.error = consoleError;
});

type Event = {
  message?: string;
  tags?: Record<string, string>;
  exception?: { values: { type: string; value: string; stacktrace: { frames: { filename: string }[] } }[] };
};

function events() {
  return (sent as [unknown, [unknown, Event][]][]).flatMap(([, items]) => items.map(([, event]) => event));
}

describe("server error tracking", () => {
  beforeEach(() => {
    sent.length = 0;
  });

  it("stays off without a DSN", () => {
    expect(initServerErrorTracking({ dsn: undefined, transport })).toBe(false);
    expect(initServerErrorTracking({ dsn: "", transport })).toBe(false);
    expect(Sentry.getClient()).toBeUndefined();
    expect(console.error).toBe(output);
  });

  it("starts with only the error integrations", () => {
    expect(initServerErrorTracking({ dsn: DSN, transport })).toBe(true);
    const names = Sentry.getClient()!.getOptions().integrations.map((integration) => integration.name);
    expect(names).toEqual(expect.arrayContaining(["LinkedErrors", "OnUncaughtException", "OnUnhandledRejection"]));
    for (const name of ["Http", "NodeFetch", "RequestData", "Console", "LocalVariables", "ContextLines", "ProcessSession"]) {
      expect(names).not.toContain(name);
    }
  });

  it("reports a request error with its route and code, and none of its text", async () => {
    Sentry.setUser({ email: "margaret@example.com" });
    Sentry.setExtra("transcript", "Replace the panel for Margaret");
    Sentry.addBreadcrumb({ message: "Margaret owes $4,250.00" });
    const cause = Object.assign(new Error("duplicate key margaret@example.com"), { code: "23505" });
    const error = new Error("Failed query\nparams: Margaret Okafor, $4,250.00", { cause });

    await reportRequestError(
      error,
      { method: "POST", path: "/d/share-token-5d6e7f", headers: { authorization: "Bearer bearer-token-9f8e7d" } } as never,
      { routePath: "/d/[token]", routeType: "action" },
    );

    const [event] = events();
    expect(event!.tags).toMatchObject({ route: "/d/[token]", route_type: "action", method: "POST", error_code: "23505" });
    expect(event!.exception!.values.map((value) => value.value)).toEqual(["[removed]", "[removed]"]);
    expect(event!.exception!.values.at(-1)!.stacktrace.frames.some((frame) => frame.filename.endsWith("server.test.ts"))).toBe(true);
    const everything = JSON.stringify(sent);
    for (const secret of ["Margaret", "margaret@", "4,250", "share-token", "bearer-token"]) {
      expect(everything).not.toContain(secret);
    }
  });

  it("reports a logged event with its ids only", async () => {
    console.error({
      event: "plan_turn_failed",
      captureId: "cap_456",
      contractorId: "c_123",
      planId: "plan_789",
      name: "PostgresError",
      transcript: "Replace the panel for Margaret",
    });
    await Sentry.flush(2000);

    expect(output).toHaveBeenCalledWith(expect.objectContaining({ event: "plan_turn_failed" }));
    const [event] = events();
    expect(event!.message).toBe("plan_turn_failed");
    expect(event!.tags).toEqual({ capture_id: "cap_456", contractor_id: "c_123", plan_id: "plan_789", error_name: "PostgresError" });
    expect(JSON.stringify(sent)).not.toContain("Margaret");
  });

  it("ignores other console output", async () => {
    console.error("Receipt objects left after account deletion", ["c_123/cap_456.jpg"]);
    console.error({ event: "Not an event name", contractorId: "c_123" });
    await Sentry.flush(2000);
    expect(sent).toEqual([]);
  });
});
