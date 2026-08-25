import { describe, expect, it } from "vitest";
import {
  formEnum,
  formNumber,
  formOptionalText,
  formText,
  parseDraftLines,
} from "@/lib/actions/form-data";

describe("form data helpers", () => {
  it("normalizes text and optional fields", () => {
    const formData = new FormData();
    formData.set("name", "  Smith job  ");
    formData.set("empty", "   ");

    expect(formText(formData, "name")).toBe("Smith job");
    expect(formOptionalText(formData, "empty")).toBeNull();
  });

  it("uses finite numeric values and preserves zero", () => {
    const formData = new FormData();
    formData.set("zero", "0");
    formData.set("invalid", "not-a-number");

    expect(formNumber(formData, "zero", 13)).toBe(0);
    expect(formNumber(formData, "invalid", 13)).toBe(13);
  });

  it("rejects status values outside the allowlist", () => {
    const formData = new FormData();
    formData.set("status", "admin");

    expect(
      formEnum(
        formData,
        "status",
        ["draft", "sent", "approved"] as const,
        "draft",
      ),
    ).toBe("draft");
  });

  it("parses and normalizes draft lines", () => {
    const lines = parseDraftLines(
      JSON.stringify([
        {
          id: "line-1",
          kind: "labour",
          description: "  Install valve ",
          quantity: "2",
          unit: " hr ",
          unitPrice: "85",
        },
        {
          id: "line-2",
          kind: "unexpected",
          description: " ",
          quantity: 1,
          unit: "",
          unitPrice: 10,
        },
      ]),
    );

    expect(lines).toEqual([
      {
        id: "line-1",
        kind: "labour",
        description: "Install valve",
        quantity: 2,
        unit: "hr",
        unitPrice: 85,
      },
    ]);
  });

  it("returns no lines for malformed JSON", () => {
    expect(parseDraftLines("{bad json")).toEqual([]);
  });
});
