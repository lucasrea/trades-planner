/** Saved Plan helpers. Pure: no Next, React or DB imports. */

const TITLE_MAX = 60;

const GENERIC_REPLIES = new Set([
  "I couldn't read that.",
  "I couldn't tell what to do with that.",
  "I couldn't read that receipt.",
  "Receipt read. Check the lines before they are saved.",
]);

/**
 * Sidebar name. Prefer the model's one-line summary of the first exchange.
 * Fall back to a shortened first message when the model had nothing to say.
 */
export function planSummaryTitle(summary: string | null | undefined, firstMessage: string): string {
  const trimmed = summary?.trim();
  if (trimmed && !GENERIC_REPLIES.has(trimmed)) return planTitle(trimmed);
  return planTitle(firstMessage);
}

/** The plan title: the first message with whitespace collapsed, cut at a word where it can be. */
export function planTitle(firstMessage: string): string {
  const text = firstMessage.replace(/\s+/g, " ").trim();
  if (!text) return "New plan";
  if (text.length <= TITLE_MAX) return text;
  const cut = text.slice(0, TITLE_MAX - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > TITLE_MAX / 2 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export type PlanOutcome = "waiting" | "confirmed" | "cancelled" | "failed";

/** What happened to the capture behind a plan reply. Read from the capture, so it never goes stale. */
export function planOutcome(captureStatus: string): PlanOutcome {
  if (captureStatus === "confirmed") return "confirmed";
  if (captureStatus === "discarded") return "cancelled";
  if (captureStatus === "failed") return "failed";
  return "waiting";
}

export const PLAN_NEW = "new";

/** One line for a receipt in the thread: the note when there is one. */
export function receiptMessageBody(note: string | null | undefined): string {
  const trimmed = note?.trim();
  return trimmed ? `Receipt photo: ${trimmed}` : "Receipt photo";
}

/** The Plan's one-line reply for a typed or spoken message. The preview title when there is one. */
export function describeReplyBody(input: { status: "needs_review" | "failed"; previewTitle: string | null }): string {
  if (input.status === "failed") return "I couldn't read that.";
  return input.previewTitle ?? "I couldn't tell what to do with that.";
}

export function receiptReplyBody(status: "needs_review" | "failed"): string {
  return status === "failed" ? "I couldn't read that receipt." : "Receipt read. Check the lines before they are saved.";
}
