import { describe, expect, it } from "vitest";
import { canTransition, documentActions, documentNumber, isOverdue } from "@/lib/documents";

describe("documents", () => {
  it("handles transitions and overdue", () => {
    expect(canTransition("quote", "draft", "sent")).toBe(true);
    expect(canTransition("quote", "sent", "draft")).toBe(false);
    expect(
      isOverdue({ type: "invoice", status: "sent", dueDate: "2026-01-14" }, "2026-01-15"),
    ).toBe(true);
    expect(documentNumber("invoice", 3)).toBe("INV-0003");
  });

  it("lists document buttons from type and status", () => {
    expect(documentActions({ type: "quote", status: "draft", hasClientEmail: true })).toEqual([
      "mark-sent",
      "delete-draft",
      "email",
      "print",
    ]);
    expect(documentActions({ type: "quote", status: "sent" })).toEqual(["approve", "decline", "print"]);
    expect(documentActions({ type: "quote", status: "approved" })).toEqual(["create-invoice", "print"]);
    expect(documentActions({ type: "quote", status: "declined" })).toEqual(["print"]);
    expect(
      documentActions({ type: "invoice", status: "draft", unbilledCount: 2, hasClientEmail: true }),
    ).toEqual(["mark-sent", "add-unbilled", "delete-draft", "email", "print"]);
    expect(documentActions({ type: "invoice", status: "draft", unbilledCount: 0 })).toEqual([
      "mark-sent",
      "delete-draft",
      "print",
    ]);
    expect(documentActions({ type: "invoice", status: "sent" })).toEqual(["mark-paid", "print"]);
    expect(documentActions({ type: "invoice", status: "paid" })).toEqual(["print"]);
  });
});
