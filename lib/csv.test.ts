import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "@/lib/csv";

describe("csv helpers", () => {
  it("quotes cells that contain commas or quotes", () => {
    expect(csvCell("Smith, Jane")).toBe('"Smith, Jane"');
    expect(csvCell('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvCell("plain")).toBe("plain");
  });

  it("builds a csv document", () => {
    expect(
      toCsv(
        ["Name", "Email"],
        [
          ["Jane Smith", "jane@example.com"],
          ["Oak St, rental", ""],
        ],
      ),
    ).toBe("Name,Email\r\nJane Smith,jane@example.com\r\n\"Oak St, rental\",");
  });
});
