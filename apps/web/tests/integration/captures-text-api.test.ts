import { eq } from "drizzle-orm";
import { MAX_CAPTURES_PER_HOUR } from "@/lib/services/capture-rate-limit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/captures/text/route";
import { parsePlanStreamLine } from "@/lib/http/plan-events";
import * as auth from "@/lib/auth";
import { captures } from "@/lib/db/schema";
import { getTestDb } from "../helpers/db";
import { seedTenant, seedTwoContractors } from "../helpers/seed";
import { newId } from "@/lib/id";

const env = process.env;

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost/api/captures/text", {
      method: "POST",
      headers: { "content-type": "application/json", "sec-fetch-site": "same-origin", ...headers },
      body: JSON.stringify(body),
    }),
  );
}

describe("POST /api/captures/text", () => {
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    process.env.AI_PROVIDER = "fake";
    process.env.AI_FAKE_MODE = "ok";
  });

  it("returns 401 when unauthenticated", async () => {
    vi.spyOn(auth, "getSession").mockResolvedValue(null);
    const res = await post({ text: "hello" });
    expect(res.status).toBe(401);
  });

  it("returns 403 for cross-site requests", async () => {
    const tenant = await seedTenant("api403");
    vi.spyOn(auth, "getSession").mockResolvedValue({ userId: tenant.userId, contractorId: tenant.contractorId });
    const res = await post({ text: "hello" }, { "sec-fetch-site": "cross-site" });
    expect(res.status).toBe(403);
  });

  it("creates needs_review capture with ledger fields", async () => {
    const tenant = await seedTenant("api200");
    vi.spyOn(auth, "getSession").mockResolvedValue({ userId: tenant.userId, contractorId: tenant.contractorId });
    const res = await post({ text: "Quote for Patel, four hours and a tank" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("needs_review");
    expect(body.reviewUrl).toContain(body.captureId);
    const db = getTestDb();
    const [row] = await db.select().from(captures).where(eq(captures.id, body.captureId)).limit(1);
    expect(row?.contractorId).toBe(tenant.contractorId);
    expect(row?.status).toBe("needs_review");
    expect(row?.model).toBe("fake");
    expect(row?.promptVersion).toBe("plan-loop-v3");
    expect(row?.latencyMs).not.toBeNull();
  });

  it("returns failed status without HTTP error when fake errors", async () => {
    process.env.AI_FAKE_MODE = "error";
    const tenant = await seedTenant("apifail");
    vi.spyOn(auth, "getSession").mockResolvedValue({ userId: tenant.userId, contractorId: tenant.contractorId });
    const res = await post({ text: "boom" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("failed");
  });

  it("streams a status and then the finished turn", async () => {
    const tenant = await seedTenant("apistream");
    vi.spyOn(auth, "getSession").mockResolvedValue({ userId: tenant.userId, contractorId: tenant.contractorId });
    const res = await post({ text: "Add a valve at $45 to the kitchen" }, { accept: "application/x-ndjson" });
    expect(res.status).toBe(200);
    const events = (await res.text()).split("\n").map((line) => parsePlanStreamLine(line)).filter((event) => event !== null);
    expect(events.some((event) => event.type === "status")).toBe(true);
    expect(events.at(-1)?.type).toBe("done");
  });

  it("streams a 404 when the job belongs to someone else", async () => {
    const { a, b } = await seedTwoContractors();
    vi.spyOn(auth, "getSession").mockResolvedValue({ userId: a.userId, contractorId: a.contractorId });
    const res = await post({ text: "hello", jobId: b.jobId }, { accept: "application/x-ndjson" });
    expect(res.status).toBe(200);
    const events = (await res.text()).split("\n").map((line) => parsePlanStreamLine(line)).filter((event) => event !== null);
    expect(events).toContainEqual({ type: "error", status: 404, message: "Job not found." });
  });

  it("returns 404 for foreign jobId", async () => {
    const { a, b } = await seedTwoContractors();
    vi.spyOn(auth, "getSession").mockResolvedValue({ userId: a.userId, contractorId: a.contractorId });
    const res = await post({ text: "hello", jobId: b.jobId });
    expect(res.status).toBe(404);
  });

  it("returns 429 after hourly limit", async () => {
    const tenant = await seedTenant("apirate");
    vi.spyOn(auth, "getSession").mockResolvedValue({ userId: tenant.userId, contractorId: tenant.contractorId });
    const db = getTestDb();
    const now = Date.now();
    for (let i = 0; i < MAX_CAPTURES_PER_HOUR; i += 1) {
      await db.insert(captures).values({
        id: newId(),
        contractorId: tenant.contractorId,
        type: "text",
        status: "needs_review",
        transcript: "x",
        createdAt: now - i * 1000,
      });
    }
    const res = await post({ text: "one more" });
    expect(res.status).toBe(429);
  });
});
