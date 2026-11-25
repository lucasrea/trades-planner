/** Decide whether a Plan message should change the books, answer from them, or just talk. */

const STARTS_WITH_QUESTION = /^(what|which|who|when|where|why|how|show|list|tell me|do i|are there|is there)\b/i;
const PAPERWORK = /\b(quotes?|invoices?|jobs?|drafts?|documents?|billed|unbilled)\b/i;
const ACTION = /\b(add|log|create|make|record)\b/i;
const GREETING = /^(hi|hey|hello|thanks|thank you|good morning|good afternoon)\b/i;
const ASKS_TO_INVOICE = /\b(invoice|invoicing|billing|charge|charged)\b|\bbill(?!'s)\b/i;
const ASKS_TO_QUOTE = /\b(quote for|quote the|make a quote|write a quote|new quote)\b/i;

export type PlanMessageKind = "act" | "question" | "chat";

export function classifyPlanMessage(text: string): PlanMessageKind {
  const trimmed = text.trim();
  if (!trimmed) return "chat";
  if (ACTION.test(trimmed)) return "act";
  if (STARTS_WITH_QUESTION.test(trimmed) && PAPERWORK.test(trimmed)) return "question";
  if (GREETING.test(trimmed)) return "chat";
  return "act";
}

export function messageAsksToInvoice(text: string | null | undefined) {
  return ASKS_TO_INVOICE.test(text ?? "");
}

export function messageAsksToQuote(text: string | null | undefined) {
  return ASKS_TO_QUOTE.test(text ?? "");
}

const HOURS_MESSAGE =
  /^(?:please\s+)?(?:(?:i\s+)?need\s+to\s+)?(?:add|log)\s+(\d+(?:\.\d+)?)\s+hours?\s+of\s+(?:labour|labor)(?:\s+(?:to\s+(?:the|this)\s+job(?:\s+too)?|too))?[.!]?\s*$/i;
const EXPENSE_MESSAGE =
  /^(?:please\s+)?(?:(?:i\s+)?need\s+to\s+)?add\s+an?\s+expense[,:]?\s+(?:new\s+)?([a-z][a-z\s]{2,60})\s+costing\s+\$?\s*(\d[\d,]*(?:\.\d+)?)\s*\$?[.!]?\s*$/i;

/** A plainly worded add, so a model failure does not throw the message away. */
export function parseObviousAct(text: string): {
  intent: "log";
  client_name: null;
  job_title: null;
  site_address: null;
  scope_notes: null;
  warnings: string[];
  lines: {
    kind: "labour" | "material";
    description: string;
    quantity: number;
    unit: string;
    unit_price: number | null;
    uncertain: null;
  }[];
} | null {
  const hours = HOURS_MESSAGE.exec(text.trim());
  if (hours) {
    return {
      intent: "log",
      client_name: null,
      job_title: null,
      site_address: null,
      scope_notes: null,
      warnings: [],
      lines: [
        {
          kind: "labour",
          description: "Labour",
          quantity: Number(hours[1]),
          unit: "hr",
          unit_price: null,
          uncertain: null,
        },
      ],
    };
  }
  const costing = EXPENSE_MESSAGE.exec(text.trim());
  if (costing) {
    const price = Number(costing[2]!.replace(/,/g, ""));
    if (!Number.isFinite(price)) return null;
    return {
      intent: "log",
      client_name: null,
      job_title: null,
      site_address: null,
      scope_notes: null,
      warnings: [],
      lines: [
        {
          kind: "material",
          description: costing[1]!.trim(),
          quantity: 1,
          unit: "ea",
          unit_price: price,
          uncertain: null,
        },
      ],
    };
  }
  return null;
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
