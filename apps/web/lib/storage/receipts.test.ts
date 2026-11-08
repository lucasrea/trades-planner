import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryReceiptStorage } from "@/lib/storage/fake";
import {
  createSupabaseReceiptStorage,
  getReceiptStorage,
  receiptImagePath,
  receiptPathBelongsTo,
  StorageError,
} from "@/lib/storage/receipts";

const env = process.env;

afterEach(() => {
  process.env = { ...env };
  vi.unstubAllGlobals();
});

describe("receipt object paths", () => {
  it("uses receipts/{contractorId}/{captureId}.jpg", () => {
    expect(receiptImagePath("c1", "cap9")).toBe("receipts/c1/cap9.jpg");
  });

  it("only accepts paths under the caller's own folder", () => {
    expect(receiptPathBelongsTo("receipts/c1/cap9.jpg", "c1")).toBe(true);
    expect(receiptPathBelongsTo("receipts/c2/cap9.jpg", "c1")).toBe(false);
    expect(receiptPathBelongsTo("receipts/c1/../c2/cap9.jpg", "c1")).toBe(false);
    expect(receiptPathBelongsTo("receipts/c10/cap9.jpg", "c1")).toBe(false);
  });
});

describe("memory receipt storage", () => {
  it("stores, signs and removes", async () => {
    const storage = createMemoryReceiptStorage();
    await storage.put({ path: "receipts/c/a.jpg", bytes: new Uint8Array([1, 2]), mimeType: "image/jpeg" });
    expect(storage.has("receipts/c/a.jpg")).toBe(true);
    expect(await storage.signedUrl("receipts/c/a.jpg", 300)).toMatch(/^data:image\/jpeg;base64,/);
    expect(await storage.signedUrl("receipts/c/missing.jpg", 300)).toBeNull();
    await storage.remove("receipts/c/a.jpg");
    expect(storage.has("receipts/c/a.jpg")).toBe(false);
  });
});

describe("getReceiptStorage", () => {
  it("falls back to memory outside production when Supabase is not configured", () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    (process.env as Record<string, string>).NODE_ENV = "test";
    expect(getReceiptStorage()).toBeTruthy();
  });

  it("refuses to run in production without Supabase keys", () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    (process.env as Record<string, string>).NODE_ENV = "production";
    expect(() => getReceiptStorage()).toThrow(StorageError);
  });
});

describe("supabase receipt storage (fetch stubbed, no network)", () => {
  const config = { url: "https://example.supabase.co/", serviceRoleKey: "service-key" };

  it("uploads privately with the service key to the receipts bucket", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await createSupabaseReceiptStorage(config).put({
      path: "receipts/c1/a.jpg",
      bytes: new Uint8Array([1]),
      mimeType: "image/jpeg",
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://example.supabase.co/storage/v1/object/receipts/receipts/c1/a.jpg");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer service-key");
    expect(init.headers["content-type"]).toBe("image/jpeg");
  });

  it("throws StorageError when upload fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    await expect(
      createSupabaseReceiptStorage(config).put({ path: "receipts/c1/a.jpg", bytes: new Uint8Array([1]), mimeType: "image/jpeg" }),
    ).rejects.toBeInstanceOf(StorageError);
  });

  it("requests a short-lived signed URL and builds the absolute link", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ signedURL: "/object/sign/receipts/receipts/c1/a.jpg?token=t" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const url = await createSupabaseReceiptStorage(config).signedUrl("receipts/c1/a.jpg", 300);
    expect(url).toBe("https://example.supabase.co/storage/v1/object/sign/receipts/receipts/c1/a.jpg?token=t");
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ expiresIn: 300 });
  });

  it("returns null when signing fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 404 })));
    expect(await createSupabaseReceiptStorage(config).signedUrl("receipts/c1/a.jpg", 300)).toBeNull();
  });
});
