import { describe, expect, it } from "vitest";
import { calendarDateInTimeZone, formatDisplayDate } from "./format";

describe("format", () => {
  it("formats YYYY-MM-DD without UTC shift", () => {
    expect(formatDisplayDate("2026-08-27")).toBe("Aug 27, 2026");
    expect(formatDisplayDate("2026-08-27", { month: "long" })).toBe("August 27, 2026");
  });

  it("uses Toronto calendar date for overdue boundaries", () => {
    const eveningUtc = new Date("2026-01-16T02:30:00.000Z");
    expect(calendarDateInTimeZone("America/Toronto", eveningUtc)).toBe("2026-01-15");
    const morningUtc = new Date("2026-01-16T12:00:00.000Z");
    expect(calendarDateInTimeZone("America/Toronto", morningUtc)).toBe("2026-01-16");
  });

  it("formats timestamps on the Toronto calendar", () => {
    expect(formatDisplayDate(Date.parse("2026-08-28T02:00:00.000Z"), { month: "long" })).toBe(
      "August 27, 2026",
    );
  });
});
