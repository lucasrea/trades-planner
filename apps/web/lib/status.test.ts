import { describe, expect, it } from "vitest";
import { statusClass, statusDotClass } from "@/lib/status";

describe("status chips", () => {
  it("uses a dim wash and a matching dot", () => {
    expect(statusClass("paid")).toContain("text-[#86efac]");
    expect(statusDotClass("paid")).toBe("bg-[#86efac]");
    expect(statusClass("sent")).toContain("#5167fc");
    expect(statusDotClass("quoted")).toBe("bg-[#5167fc]");
    expect(statusClass("overdue")).toContain("text-[#fca5a5]");
    expect(statusDotClass("declined")).toBe("bg-[#fca5a5]");
    expect(statusClass("draft")).toContain("text-muted");
    expect(statusDotClass("draft")).toBe("bg-muted");
  });
});
