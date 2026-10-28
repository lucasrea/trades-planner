import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/captures/voice/route";
import * as auth from "@/lib/auth";
import { captures } from "@/lib/db/schema";
import { getTestDb } from "../helpers/db";
import { seedTenant, seedTwoContractors } from "../helpers/seed";
import { newId } from "@/lib/id";

const env = process.env;

function voiceRequest(file: File, jobId?: string, headers: Record<string, string> = {}) {
  const form = new FormData();
  form.set("audio", file);
  if (jobId) form.set("jobId", jobId);
  return POST(
    new Request("http://localhost/api/captures/voice", {
      method: "POST",
      headers: { "sec-fetch-site": "same-origin", ...headers },
      body: form,
    }),
  );
}

describe("POST /api/captures/voice", () => {
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
    const res = await voiceRequest(new File([new Uint8Array([1, 2])], "a.webm", { type: "audio/webm" }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for the wrong audio type", async () => {
    const tenant = await seedTenant("voice400");
    vi.spyOn(auth, "getSession").mockResolvedValue({ userId: tenant.userId, contractorId: tenant.contractorId });
    const res = await voiceRequest(new File([new Uint8Array([1])], "a.txt", { type: "text/plain" }));
    expect(res.status).toBe(400);
  });

  it("returns 413 for audio over 4 MB", async () => {
    const tenant = await seedTenant("voice413");
    vi.spyOn(auth, "getSession").mockResolvedValue({ userId: tenant.userId, contractorId: tenant.contractorId });
    const res = await voiceRequest(new File([new Uint8Array(4 * 1024 * 1024 + 1)], "big.wav", { type: "audio/wav" }));
    expect(res.status).toBe(413);
  });

  it("creates a needs_review voice capture and stores transcript only", async () => {
    const tenant = await seedTenant("voice200");
    vi.spyOn(auth, "getSession").mockResolvedValue({ userId: tenant.userId, contractorId: tenant.contractorId });
    const res = await voiceRequest(new File([new Uint8Array([1, 2, 3, 4])], "note.webm", { type: "audio/webm" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("needs_review");
    const db = getTestDb();
    const [row] = await db.select().from(captures).where(eq(captures.id, body.captureId)).limit(1);
    expect(row?.type).toBe("voice");
    expect(row?.imagePath ?? null).toBeNull();
    expect(row?.transcript ?? "").toContain("Fake transcript");
    expect(row?.status).toBe("needs_review");
  });

  it("returns failed when transcription errors and stores no audio", async () => {
    process.env.AI_FAKE_MODE = "error";
    const tenant = await seedTenant("voicefail");
    vi.spyOn(auth, "getSession").mockResolvedValue({ userId: tenant.userId, contractorId: tenant.contractorId });
    const res = await voiceRequest(new File([new Uint8Array([9])], "note.webm", { type: "audio/webm" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("failed");
    const db = getTestDb();
    const [row] = await db.select().from(captures).where(eq(captures.id, body.captureId)).limit(1);
    expect(row?.imagePath ?? null).toBeNull();
    expect(row?.transcript ?? null).toBeNull();
  });

  it("returns 404 for a foreign job", async () => {
    const { a, b } = await seedTwoContractors();
    vi.spyOn(auth, "getSession").mockResolvedValue({ userId: a.userId, contractorId: a.contractorId });
    const res = await voiceRequest(new File([new Uint8Array([1])], "a.webm", { type: "audio/webm" }), b.jobId);
    expect(res.status).toBe(404);
  });

  it("returns 429 after the hourly limit", async () => {
    const tenant = await seedTenant("voicerate");
    vi.spyOn(auth, "getSession").mockResolvedValue({ userId: tenant.userId, contractorId: tenant.contractorId });
    const db = getTestDb();
    const now = Date.now();
    for (let i = 0; i < 30; i += 1) {
      await db.insert(captures).values({
        id: newId(),
        contractorId: tenant.contractorId,
        type: "text",
        status: "needs_review",
        transcript: "x",
        createdAt: now - i * 1000,
      });
    }
    const res = await voiceRequest(new File([new Uint8Array([1])], "a.webm", { type: "audio/webm" }));
    expect(res.status).toBe(429);
  });
});
