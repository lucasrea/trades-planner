import { describe, expect, it } from "vitest";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/services/context";
import { actionErrorNotice, codeFromServiceError } from "@/lib/action-errors";

describe("action-errors", () => {
  it("maps known service messages to safe codes", () => {
    expect(codeFromServiceError(new NotFoundError("Document not found."))).toBe("not-found");
    expect(codeFromServiceError(new ConflictError("Document is locked."))).toBe("locked");
    expect(codeFromServiceError(new ValidationError("No unbilled tracked lines on this job."))).toBe(
      "nothing-to-bill",
    );
  });

  it("shows fixed copy for codes and ignores crafted query strings", () => {
    expect(actionErrorNotice("nothing-to-bill")).toContain("unbilled");
    expect(actionErrorNotice("<script>alert(1)</script>")).toBeNull();
    expect(actionErrorNotice("Document is locked.")).toBeNull();
  });
});
