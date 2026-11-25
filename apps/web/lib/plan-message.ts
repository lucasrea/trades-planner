import { addMoney } from "@/lib/money";

/** Decide whether a Plan message should change the books, answer from them, or just talk. */

const STARTS_WITH_QUESTION = /^(?:(?:for|on|across)\s+[^,?.]{1,40},\s*)?(what|which|who|when|where|why|how|show|list|tell me|do i|are there|is there)\b/i;
const PAPERWORK = /\b(quotes?|invoices?|jobs?|drafts?|documents?|billed|unbilled)\b/i;
const ACTION = /\b(add|log|create|make|record)\b/i;
const GREETING = /^(?:hi|hey|hello|thanks|thank you|good morning|good afternoon|ok(?:ay)?)\b[\s,!.:;-]*(?:there\b|again\b|so much\b|man\b|buddy\b)?[\s,!.:;-]*/i;
const ASKS_TO_INVOICE = /\b(invoice|invoicing|billing|charge|charged)\b|\bbill(?!'s)\b/i;
const ASKS_TO_QUOTE = /\b(quote for|quote the|make a quote|write a quote|new quote)\b/i;
const WORK_WORDS =
  /\b(add|log|create|make|record|quotes?|quoting|invoices?|bill|charge|price|jobs?|hours?|labou?r|materials?|receipts?|clients?|unbilled|drafts?)\b/i;
/** Work already on the job: "the unbilled work", "what I logged", "everything on the kitchen". */
const TRACKED_WORK =
  /\b(unbilled|tracked|logged|everything\s+(?:on|for)|all\s+(?:of\s+)?(?:the\s+)?(?:work|hours|materials|lines))\b/i;

export type PlanMessageKind = "act" | "question" | "chat";

/** "Hi, add 2 hours" → "add 2 hours". Only a greeting at the very start is removed. */
export function stripGreeting(text: string) {
  const trimmed = text.trim();
  const greeting = GREETING.exec(trimmed);
  return greeting ? trimmed.slice(greeting[0].length).trim() : trimmed;
}

export function classifyPlanMessage(text: string): PlanMessageKind {
  const trimmed = text.trim();
  if (!trimmed) return "chat";
  const greeting = GREETING.exec(trimmed);
  if (greeting) {
    // "Hi, quote Patel for the heater" is a request with a greeting in front, not small talk.
    const rest = trimmed.slice(greeting[0].length).trim();
    const smallTalk = !WORK_WORDS.test(rest) && !/\d/.test(rest) && rest.split(/\s+/).length <= 6;
    return !rest || smallTalk ? "chat" : classifyPlanMessage(rest);
  }
  if (ACTION.test(trimmed)) return "act";
  if (STARTS_WITH_QUESTION.test(trimmed) && PAPERWORK.test(trimmed)) return "question";
  return "act";
}

/**
 * "Invoice the kitchen for the unbilled work." The job's tracked lines become the invoice, so nothing
 * is retyped or billed twice. A message with new numbers in it is new work, not this.
 */
export function asksToInvoiceTrackedWork(text: string | null | undefined) {
  const value = text ?? "";
  return ASKS_TO_INVOICE.test(value) && TRACKED_WORK.test(value) && !/\d/.test(value);
}

/** The message asks to add, log, quote or invoice something, as opposed to asking about the books. */
export function messageAsksForWork(text: string) {
  return /\d/.test(text) || ACTION.test(text) || ASKS_TO_INVOICE.test(text) || ASKS_TO_QUOTE.test(text);
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
  const message = stripGreeting(text);
  const hours = HOURS_MESSAGE.exec(message);
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
  const costing = EXPENSE_MESSAGE.exec(message);
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

const HOURS_CLAUSE = /(\d+(?:\.\d+)?)\s+hours?\s+of\s+(?:labour|labor)/i;
const COST_ITEM = /(?:adding|add)\s+(?:the\s+)?([a-z][a-z\s]{1,50}?)\s+which\s+cost(?:s)?(?:\s+me)?\s+\$?(\d+(?:\.\d+)?)/i;
const DOLLAR_MARKUP = /\+\s*(\d+(?:\.\d+)?)\s+markup/i;

/** Hours plus a material whose cost and dollar markup are both written out. */
export function parseCompoundWork(text: string) {
  const hours = HOURS_CLAUSE.exec(text);
  const item = COST_ITEM.exec(text);
  if (!hours || !item) return null;
  if (/\b(quote|invoice)\b/i.test(text) || /\bat\s+\$?\d/.test(text)) return null;
  const markupMatch = DOLLAR_MARKUP.exec(text);
  if ((/markup|%/i.test(text)) && !markupMatch) return null;
  const cost = Number(item[2]);
  const markup = markupMatch ? Number(markupMatch[1]) : 0;
  const base = { intent: "log" as const, client_name: null, job_title: null, site_address: null, scope_notes: null, warnings: [] as string[] };
  return [
    {
      ...base,
      lines: [{ kind: "labour" as const, description: "Labour", quantity: Number(hours[1]), unit: "hr", unit_price: null, uncertain: null }],
    },
    {
      ...base,
      lines: [
        {
          kind: "material" as const,
          description: item[1]!.trim(),
          quantity: 1,
          unit: "ea",
          unit_cost: cost,
          unit_price: markup > 0 ? addMoney(cost, markup) : cost,
          uncertain: null,
        },
      ],
    },
  ];
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
