import { describe, expect, it } from "vitest";
import { fitWithin, RECEIPT_JPEG_QUALITY, RECEIPT_MAX_EDGE_PX } from "@/lib/captures/downscale";

describe("fitWithin", () => {
  it("caps the longest edge at 1600 and keeps the aspect ratio", () => {
    expect(RECEIPT_MAX_EDGE_PX).toBe(1600);
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });

  it("never upscales", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it("keeps at least one pixel on a very thin strip", () => {
    expect(fitWithin(20000, 2)).toEqual({ width: 1600, height: 1 });
  });

  it("encodes JPEG at about 0.8", () => {
    expect(RECEIPT_JPEG_QUALITY).toBe(0.8);
  });
});
