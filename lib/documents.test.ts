import { describe, expect, it } from "vitest";
import { canTransition, documentNumber, isOverdue } from "@/lib/documents";

describe("documents", () => {
  it("handles transitions and overdue", () => {
    expect(canTransition("quote", "draft", "sent")).toBe(true);
    expect(canTransition("quote", "sent", "draft")).toBe(false);
    expect(
      isOverdue({ type: "invoice", status: "sent", dueDate: "2026-01-14" }, "2026-01-15"),
    ).toBe(true);
    expect(documentNumber("invoice", 3)).toBe("INV-0003");
  });
});
