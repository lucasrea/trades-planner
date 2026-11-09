import { describe, expect, it } from "vitest";
import { describeReplyBody, planOutcome, planTitle, receiptMessageBody, receiptReplyBody } from "@/lib/plans";

describe("planTitle", () => {
  it("uses a short first message as is", () => {
    expect(planTitle("Add a valve to the kitchen")).toBe("Add a valve to the kitchen");
  });

  it("collapses whitespace and newlines", () => {
    expect(planTitle("  quote   for\nPatel \n")).toBe("quote for Patel");
  });

  it("shortens a long message at a word", () => {
    const title = planTitle("Quote for the Patel bathroom: four hours of labour, a new vanity, tile, grout and a fan");
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith("…")).toBe(true);
    expect(title).not.toMatch(/\s…$/);
  });

  it("falls back for an empty message", () => {
    expect(planTitle("   ")).toBe("New plan");
  });
});

describe("planOutcome", () => {
  it("reads the capture status", () => {
    expect(planOutcome("needs_review")).toBe("waiting");
    expect(planOutcome("processing")).toBe("waiting");
    expect(planOutcome("confirmed")).toBe("confirmed");
    expect(planOutcome("discarded")).toBe("cancelled");
    expect(planOutcome("failed")).toBe("failed");
  });
});

describe("reply and receipt lines", () => {
  it("stores the preview title as the reply", () => {
    expect(describeReplyBody({ status: "needs_review", previewTitle: "Make a quote for Patel" })).toBe("Make a quote for Patel");
    expect(describeReplyBody({ status: "needs_review", previewTitle: null })).toBe("I couldn't tell what to do with that.");
    expect(describeReplyBody({ status: "failed", previewTitle: null })).toBe("I couldn't read that.");
  });

  it("notes a receipt in one line", () => {
    expect(receiptMessageBody("add to the kitchen")).toBe("Receipt photo: add to the kitchen");
    expect(receiptMessageBody(undefined)).toBe("Receipt photo");
    expect(receiptReplyBody("failed")).toBe("I couldn't read that receipt.");
  });
});
