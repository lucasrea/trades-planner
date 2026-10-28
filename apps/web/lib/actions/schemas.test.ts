import { describe, expect, it } from "vitest";
import {
  createDraftDocumentSchema,
  saveClientSchema,
  saveDocumentSchema,
  saveJobSchema,
  saveLineItemSchema,
} from "@/lib/actions/schemas";

describe("action schemas", () => {
  it("accepts valid payloads", () => {
    expect(saveClientSchema.safeParse({ name: "A" }).success).toBe(true);
    expect(saveJobSchema.safeParse({ title: "Job", clientId: "c1" }).success).toBe(true);
    expect(
      saveLineItemSchema.safeParse({
        jobId: "j",
        kind: "labour",
        description: "Work",
        quantity: "1",
        unit: "hr",
        unitPrice: "10",
      }).success,
    ).toBe(true);
    expect(createDraftDocumentSchema.safeParse({ jobId: "j", type: "quote" }).success).toBe(true);
    expect(saveDocumentSchema.safeParse({ documentId: "d" }).success).toBe(true);
  });
});
