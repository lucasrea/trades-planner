import { describe, expect, it } from "vitest";
import {
  canCreateActiveJob,
  canCreateClient,
  canCreateDocument,
  canUseFeature,
  effectivePlan,
  monthRange,
  requireActiveJobSlot,
  requireClientSlot,
  requireDocumentSlot,
  requireFeature,
} from "@/lib/entitlements";

describe("plan entitlements", () => {
  it("maps stored plan states to an effective tier", () => {
    expect(effectivePlan("pro")).toBe("pro");
    expect(effectivePlan("trial")).toBe("pro");
    expect(effectivePlan("solo")).toBe("solo");
    expect(effectivePlan("free")).toBe("free");
    expect(effectivePlan("past_due")).toBe("free");
    expect(effectivePlan("canceled")).toBe("free");
    expect(effectivePlan(null)).toBe("free");
  });

  it("enforces Free usage caps and leaves Solo/Pro unlimited", () => {
    expect(canCreateClient("free", 4)).toBe(true);
    expect(canCreateClient("free", 5)).toBe(false);
    expect(canCreateActiveJob("free", 2)).toBe(true);
    expect(canCreateActiveJob("free", 3)).toBe(false);
    expect(canCreateDocument("free", 9)).toBe(true);
    expect(canCreateDocument("free", 10)).toBe(false);

    expect(canCreateClient("solo", 500)).toBe(true);
    expect(canCreateActiveJob("pro", 500)).toBe(true);
    expect(canCreateDocument("trial", 500)).toBe(true);
  });

  it("returns upgrade copy when a Free cap is hit", () => {
    expect(requireClientSlot("free", 5)).toMatchObject({
      upgradeHref: "/#pricing",
    });
    expect(requireActiveJobSlot("free", 3)?.error).toMatch(/active jobs/i);
    expect(requireDocumentSlot("free", 10)?.error).toMatch(/per month/i);
    expect(requireClientSlot("solo", 5)).toBeNull();
  });

  it("gates Solo and Pro features", () => {
    expect(canUseFeature("free", "duplicate_documents")).toBe(false);
    expect(canUseFeature("solo", "duplicate_documents")).toBe(true);
    expect(canUseFeature("solo", "email_pdf")).toBe(false);
    expect(canUseFeature("pro", "quickbooks_export")).toBe(true);
    expect(canUseFeature("trial", "voice_to_quote")).toBe(true);
    expect(requireFeature("free", "email_pdf")?.error).toMatch(/Pro/);
    expect(requireFeature("pro", "email_pdf")).toBeNull();
  });

  it("computes a UTC calendar month range", () => {
    const { start, end } = monthRange(new Date("2026-08-26T16:00:00.000Z"));
    expect(start).toBe(Date.UTC(2026, 7, 1));
    expect(end).toBe(Date.UTC(2026, 8, 1));
  });
});
