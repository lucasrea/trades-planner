/** Decide whether a Plan message should change the books, answer from them, or just talk. */

const STARTS_WITH_ACTION = /^(add|log|create|make|record|quote|invoice|bill|charge)\b/i;
const STARTS_WITH_QUESTION = /^(what|which|who|when|where|why|how|show|list|tell me|do i|are there|is there)\b/i;
const ASKS_TO_INVOICE = /\b(invoice|bill|charge)\b/i;
const ASKS_TO_QUOTE = /\bquotes?\b/i;

export type PlanMessageKind = "act" | "question" | "chat";

export function classifyPlanMessage(text: string): PlanMessageKind {
  const trimmed = text.trim();
  if (!trimmed) return "chat";
  if (STARTS_WITH_ACTION.test(trimmed)) return "act";
  if (STARTS_WITH_QUESTION.test(trimmed) || /\?\s*$/.test(trimmed)) return "question";
  if (/\b(add|log|quote|invoice|create|record|bill|charge)\b/i.test(trimmed)) return "act";
  return "chat";
}

export function messageAsksToInvoice(text: string | null | undefined) {
  return ASKS_TO_INVOICE.test(text ?? "");
}

export function messageAsksToQuote(text: string | null | undefined) {
  return ASKS_TO_QUOTE.test(text ?? "");
}

export function planChatReply() {
  return "I can add materials, log hours, write a quote or an invoice, or look up what's already on a job. Name the job and what you want.";
}

export function formatJobPaperwork(input: {
  jobTitle: string | null;
  jobNames: string[];
  documents: { type: string; number: string; status: string }[];
}): string {
  if (!input.jobTitle) {
    if (input.jobNames.length === 0) return "You don't have any jobs yet. Tell me the job name and I can create it.";
    return `Which job? I see ${input.jobNames.slice(0, 8).join(", ")}.`;
  }
  const quotes = input.documents.filter((doc) => doc.type === "quote");
  const invoices = input.documents.filter((doc) => doc.type === "invoice");
  const list = (rows: { number: string; status: string }[]) =>
    rows.length ? rows.map((row) => `${row.number} ${row.status}`).join(", ") : "none";
  return `${input.jobTitle}\nQuotes: ${list(quotes)}\nInvoices: ${list(invoices)}`;
}
