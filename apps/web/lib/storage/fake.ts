import type { ReceiptStorage } from "@/lib/storage/receipts";

export type MemoryReceiptStorage = ReceiptStorage & {
  /** Test helpers. */
  has(path: string): boolean;
  get(path: string): { bytes: Uint8Array; mimeType: string } | undefined;
  paths(): string[];
  clear(): void;
  failNextPut(): void;
};

export function createMemoryReceiptStorage(): MemoryReceiptStorage {
  const objects = new Map<string, { bytes: Uint8Array; mimeType: string }>();
  let failPut = false;

  return {
    async put({ path, bytes, mimeType }) {
      if (failPut) {
        failPut = false;
        throw new Error("Fake storage failure.");
      }
      objects.set(path, { bytes, mimeType });
    },
    async signedUrl(path, expiresInSeconds) {
      const object = objects.get(path);
      if (!object) return null;
      // A data URL keeps local dev viewable without a bucket. Tests only check it is non-null and short-lived by contract.
      void expiresInSeconds;
      return `data:${object.mimeType};base64,${Buffer.from(object.bytes).toString("base64")}`;
    },
    async remove(path) {
      objects.delete(path);
    },
    has: (path) => objects.has(path),
    get: (path) => objects.get(path),
    paths: () => [...objects.keys()],
    clear: () => objects.clear(),
    failNextPut() {
      failPut = true;
    },
  };
}
