import { beforeEach, describe, expect, it, vi } from "vitest";

// DB-free route checks: everything that must be rejected before a capture row or a stored photo exists.
const getSession = vi.fn();
const createReceiptCapture = vi.fn();

vi.mock("@/lib/auth", () => ({ getSession: () => getSession() }));
vi.mock("@/lib/db", () => ({
  ensureDb: async () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: "c1", labourRateHourly: 80 }] }) }) }),
  }),
}));
vi.mock("@/lib/services/receipt-capture", () => ({ createReceiptCapture: (...args: unknown[]) => createReceiptCapture(...args) }));

import { POST } from "@/app/api/captures/receipt/route";
import { NotFoundError, RateLimitError } from "@/lib/services/context";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

function request(file: File | null, fields: Record<string, string> = {}, headers: Record<string, string> = {}) {
  const form = new FormData();
  if (file) form.set("image", file);
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return POST(
    new Request("http://localhost/api/captures/receipt", {
      method: "POST",
      headers: { "sec-fetch-site": "same-origin", ...headers },
      body: form,
    }),
  );
}

describe("POST /api/captures/receipt (no database)", () => {
  beforeEach(() => {
    getSession.mockReset().mockResolvedValue({ userId: "u1", contractorId: "c1" });
    createReceiptCapture.mockReset().mockResolvedValue({ captureId: "cap1", status: "needs_review", reviewUrl: "/app/captures/cap1" });
  });

  it("401 without a session", async () => {
    getSession.mockResolvedValue(null);
    expect((await request(new File([JPEG], "r.jpg", { type: "image/jpeg" }))).status).toBe(401);
    expect(createReceiptCapture).not.toHaveBeenCalled();
  });

  it("403 for cross-site requests", async () => {
    const res = await request(new File([JPEG], "r.jpg", { type: "image/jpeg" }), {}, { "sec-fetch-site": "cross-site" });
    expect(res.status).toBe(403);
    expect(createReceiptCapture).not.toHaveBeenCalled();
  });

  it("400 for bad magic bytes, never reaching the service", async () => {
    const res = await request(new File([new TextEncoder().encode("not an image at all")], "r.jpg", { type: "image/jpeg" }));
    expect(res.status).toBe(400);
    expect(createReceiptCapture).not.toHaveBeenCalled();
  });

  it("413 over 4 MB and 400 without a file", async () => {
    const big = new Uint8Array(4 * 1024 * 1024 + 1);
    big.set(JPEG);
    expect((await request(new File([big], "r.jpg", { type: "image/jpeg" }))).status).toBe(413);
    expect((await request(null)).status).toBe(400);
    expect(createReceiptCapture).not.toHaveBeenCalled();
  });

  it("400 for an over-long note", async () => {
    const res = await request(new File([JPEG], "r.jpg", { type: "image/jpeg" }), { note: "x".repeat(501) });
    expect(res.status).toBe(400);
  });

  it("passes the job and note through for a valid photo", async () => {
    const res = await request(new File([JPEG], "r.jpg", { type: "image/jpeg" }), { jobId: "job1", note: " add this to the kitchen " });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ captureId: "cap1", reviewUrl: "/app/captures/cap1" });
    const [, contractor, input] = createReceiptCapture.mock.calls[0]!;
    expect(contractor).toMatchObject({ id: "c1" });
    expect(input).toMatchObject({ jobId: "job1", note: "add this to the kitchen" });
    expect(input.image.mimeType).toBe("image/jpeg");
  });

  it("maps NotFoundError to 404 and RateLimitError to 429", async () => {
    createReceiptCapture.mockRejectedValueOnce(new NotFoundError());
    expect((await request(new File([JPEG], "r.jpg", { type: "image/jpeg" }), { jobId: "foreign" })).status).toBe(404);
    createReceiptCapture.mockRejectedValueOnce(new RateLimitError());
    expect((await request(new File([JPEG], "r.jpg", { type: "image/jpeg" }))).status).toBe(429);
  });
});
