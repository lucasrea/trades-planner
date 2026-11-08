import { createMemoryReceiptStorage } from "@/lib/storage/fake";

export const RECEIPT_BUCKET = "receipts";
/** Signed URLs on the review screen are short-lived. */
export const RECEIPT_SIGNED_URL_TTL_SECONDS = 300;

export type ReceiptStorage = {
  put(input: { path: string; bytes: Uint8Array; mimeType: string }): Promise<void>;
  /** Short-lived read URL, or null when the object cannot be found. */
  signedUrl(path: string, expiresInSeconds: number): Promise<string | null>;
  remove(path: string): Promise<void>;
};

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageError";
  }
}

/** Object key inside the "receipts" bucket. This is also what captures.image_path stores. */
export function receiptImagePath(contractorId: string, captureId: string) {
  return `receipts/${contractorId}/${captureId}.jpg`;
}

/** True when the stored path belongs to this contractor. Checked before signing a URL. */
export function receiptPathBelongsTo(path: string, contractorId: string) {
  return path.startsWith(`receipts/${contractorId}/`) && !path.includes("..");
}

function encodeObjectPath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/");
}

/**
 * Supabase Storage over its REST API with the service role key (server only).
 * Plain fetch, so no extra dependency.
 */
export function createSupabaseReceiptStorage(config: { url: string; serviceRoleKey: string }): ReceiptStorage {
  const base = `${config.url.replace(/\/+$/, "")}/storage/v1`;
  const headers = { apikey: config.serviceRoleKey, authorization: `Bearer ${config.serviceRoleKey}` };

  return {
    async put({ path, bytes, mimeType }) {
      const response = await fetch(`${base}/object/${RECEIPT_BUCKET}/${encodeObjectPath(path)}`, {
        method: "POST",
        headers: { ...headers, "content-type": mimeType, "x-upsert": "true" },
        body: bytes as BodyInit,
      });
      if (!response.ok) throw new StorageError(`Receipt upload failed (${response.status}).`);
    },
    async signedUrl(path, expiresInSeconds) {
      const response = await fetch(`${base}/object/sign/${RECEIPT_BUCKET}/${encodeObjectPath(path)}`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ expiresIn: expiresInSeconds }),
      });
      if (!response.ok) return null;
      const body = (await response.json().catch(() => null)) as { signedURL?: string } | null;
      if (!body?.signedURL) return null;
      return `${base}${body.signedURL}`;
    },
    async remove(path) {
      const response = await fetch(`${base}/object/${RECEIPT_BUCKET}/${encodeObjectPath(path)}`, {
        method: "DELETE",
        headers,
      });
      if (!response.ok && response.status !== 404) throw new StorageError(`Receipt delete failed (${response.status}).`);
    },
  };
}

const globalForStorage = globalThis as unknown as { __receiptMemoryStorage?: ReturnType<typeof createMemoryReceiptStorage> };

/** In-memory fake shared across the process. Used in tests and in local dev without Supabase keys. */
export function getMemoryReceiptStorage() {
  globalForStorage.__receiptMemoryStorage ??= createMemoryReceiptStorage();
  return globalForStorage.__receiptMemoryStorage;
}

/**
 * Live Supabase when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set. Production without them
 * is a configuration error, never a silent fallback to memory. Otherwise the in-memory fake.
 */
export function getReceiptStorage(): ReceiptStorage {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && serviceRoleKey) return createSupabaseReceiptStorage({ url, serviceRoleKey });
  if (process.env.NODE_ENV === "production") {
    throw new StorageError("Receipt storage is not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).");
  }
  return getMemoryReceiptStorage();
}
