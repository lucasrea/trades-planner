import { z } from "zod";
import { DOCUMENT_STATUS_WORDS } from "@/lib/plan-lookup";

/**
 * Tools the Plan model may call. The model chooses the order.
 * Read tools return data with ids; proposal tools only make a card the contractor confirms.
 * Every field has one JSON type, which the API requires.
 */

type JsonSchema = Record<string, unknown>;

function tool(name: string, description: string, properties: Record<string, JsonSchema>, required: string[] = []) {
  return {
    type: "function" as const,
    function: { name, description, parameters: { type: "object", properties, required } },
  };
}

const str = (description?: string): JsonSchema => (description ? { type: "string", description } : { type: "string" });
const num = (description?: string): JsonSchema => (description ? { type: "number", description } : { type: "number" });
const bool = (description: string): JsonSchema => ({ type: "boolean", description });
const oneOf = (values: readonly string[], description?: string): JsonSchema => ({ type: "string", enum: [...values], ...(description ? { description } : {}) });
const date = (description: string): JsonSchema => ({ type: "string", description: `${description} YYYY-MM-DD.` });

const lineProperties: Record<string, JsonSchema> = {
  kind: oneOf(["labour", "material", "other"]),
  description: str(),
  quantity: num(),
  unit: str("hr for hours, ea otherwise."),
  unit_price: num("Sell price for one unit. Omit for hours with no rate said; the app applies the labour rate."),
  unit_cost: num("What it cost the contractor, before markup."),
  markup_amount: num("Dollars to add to unit_cost. The app computes the sell price."),
  price_source: str("Id of a line from search_lines whose unit_price this copies. Use when the contractor asks for a price used before."),
};
const lineItem: JsonSchema = { type: "object", properties: lineProperties, required: ["kind", "description", "quantity"] };

export const PLAN_TOOLS = [
  // ---- Read ----
  tool(
    "find_jobs",
    "Find the contractor's jobs. Use for 'my jobs', 'which jobs have unbilled work', or to get a job's id before acting on it. Returns ids, unbilled totals and counts.",
    {
      query: str("Words from the job title, client or site, e.g. 'kitchen' or 'Patel'."),
      status: oneOf(["open", "quoted", "active", "done", "all"], "open means quoted or active."),
      client_id: str(),
      has_unbilled: bool("Only jobs with unbilled work."),
    },
  ),
  tool("get_job", "One job in full: client, unbilled lines with their ids and total, its quotes and invoices, and cost against invoiced.", { job_id: str() }, ["job_id"]),
  tool(
    "find_documents",
    "Find quotes and invoices. Use for 'how many open quotes', 'who owes me', 'what's overdue', 'invoices this month', or a number like Q-0003. Returns count, count_by_status, total and rows with ids. Use those numbers; do not add them up yourself.",
    {
      doc_type: oneOf(["quote", "invoice"]),
      status: oneOf(DOCUMENT_STATUS_WORDS, "open = draft or sent; waiting = sent, not answered; unpaid = sent invoice; overdue = sent invoice past due."),
      job_id: str(),
      client_id: str(),
      number: str("A document number such as Q-0003 or INV-0012."),
      query: str("Words from the client's name, the job title or an item on it, e.g. 'Patel water heater' or 'vanity'."),
      since: date("Sent or created on or after."),
      until: date("Sent or created on or before."),
    },
  ),
  tool(
    "get_document",
    "One quote or invoice in full: lines with ids, totals, status, whether it can still be edited, and the changes allowed next.",
    { document_id: str(), number: str("Use when you have the number but not the id.") },
  ),
  tool("find_clients", "Find clients by name, email or phone. Returns ids and contact details.", { query: str() }),
  tool(
    "search_lines",
    "Search past lines on quotes, invoices, jobs and receipts. Use for 'what did I charge for a water heater last time', 'when did I buy the crimper', 'what did I spend at Home Depot this month'. Returns last, lowest and highest price, total cost and total sell, and rows with ids.",
    {
      query: str("Words from the item, or a store name."),
      kind: oneOf(["labour", "material", "other"]),
      job_id: str(),
      source: oneOf(["quoted", "invoiced", "tracked", "receipt"]),
      since: date("On or after."),
      until: date("On or before."),
    },
  ),
  tool(
    "business_snapshot",
    "The state of the business: owed, overdue, quotes waiting, unbilled, paid this period, and a to-do list. Use for 'how am I doing', 'who owes me', 'what do I need to do today'.",
    { period: oneOf(["today", "week", "month"]) },
  ),

  // ---- Propose (each makes one card; nothing changes until the contractor confirms) ----
  tool(
    "propose_work",
    "A card for new work: a quote, an invoice, or hours and materials logged on a job, or a new job. Call once per action. Hours and materials are two calls. Two jobs are two calls. A quote or an invoice is one call and may include both.",
    {
      intent: oneOf(["quote", "invoice", "log"]),
      job_id: str("An existing job from find_jobs. Prefer this over job_title."),
      job_title: str("A new job's title, or the words used for an existing one."),
      client_id: str(),
      client_name: str(),
      site_address: str(),
      notes: str(),
      lines: { type: "array", items: lineItem },
    },
    ["intent"],
  ),
  tool(
    "propose_invoice",
    "A card to invoice existing work so nothing is retyped: the job's unbilled lines (job_id), or an approved quote (quote_id). Use this, not propose_work, to bill work that is already recorded.",
    { job_id: str("Invoice this job's unbilled work."), quote_id: str("Invoice this approved quote.") },
  ),
  tool(
    "propose_document_change",
    "A card that changes an existing quote or invoice. Status: mark_sent, mark_approved, mark_declined (quotes), mark_paid (invoices). Only a draft can have lines or dates changed or be deleted.",
    {
      document_id: str(),
      action: oneOf(["mark_sent", "mark_approved", "mark_declined", "mark_paid", "add_lines", "change_lines", "remove_lines", "set_details", "add_unbilled", "delete_draft"]),
      lines: { type: "array", description: "add_lines: the new lines.", items: lineItem },
      changes: {
        type: "array",
        description: "change_lines: one entry per line, by id from get_document. Only the fields that change.",
        items: {
          type: "object",
          properties: { line_id: str(), description: str(), quantity: num(), unit: str(), unit_price: num(), price_source: str() },
          required: ["line_id"],
        },
      },
      line_ids: { type: "array", description: "remove_lines: ids from get_document.", items: { type: "string" } },
      due_date: date("set_details on an invoice."),
      valid_until: date("set_details on a quote."),
      notes: str("set_details."),
    },
    ["document_id", "action"],
  ),
  tool(
    "propose_job_change",
    "A card that changes a job: set_status (quoted, active, done), edit_details (title, site, notes), or move_lines (unbilled lines, by id from get_job, to another job).",
    {
      job_id: str(),
      action: oneOf(["set_status", "edit_details", "move_lines"]),
      status: oneOf(["quoted", "active", "done"]),
      title: str(),
      site_address: str(),
      notes: str(),
      line_ids: { type: "array", items: { type: "string" } },
      to_job_id: str(),
    },
    ["job_id", "action"],
  ),
  tool(
    "propose_client",
    "A card that adds a client, or updates one (client_id from find_clients). Only the fields given change.",
    { client_id: str(), name: str(), email: str(), phone: str(), billing_address: str() },
  ),
  tool(
    "propose_send",
    "A card that emails a quote or invoice link to its client, or a payment reminder for a sent, unpaid invoice. Never sent until confirmed.",
    { document_id: str(), reminder: bool("A payment reminder for an unpaid invoice.") },
    ["document_id"],
  ),
  tool(
    "propose_settings",
    "A card that changes the contractor's settings. Only the fields given change. Applies to new work only.",
    {
      labour_rate: num("Dollars per hour."),
      markup_pct: num("Material markup, percent."),
      tax_rate_pct: num("Percent, e.g. 13."),
      tax_label: str("e.g. HST or GST."),
      etransfer_email: str(),
      etransfer_note: str(),
    },
  ),
  tool("propose_undo", "A card that undoes the card confirmed most recently, while it is still a draft or unbilled.", {}),

  // ---- Talk ----
  tool("reply", "Say something in plain text: an answer, or a short note after the cards.", { text: str() }, ["text"]),
  tool(
    "ask",
    "Ask one question with choices when more than one thing matches or something needed is missing. Never end a turn without a card, a reply or a question.",
    {
      question: str(),
      options: {
        type: "array",
        description: "Up to 6 choices.",
        items: { type: "object", properties: { label: str(), job_id: str("When the choice is a job.") }, required: ["label"] },
      },
    },
    ["question", "options"],
  ),
];

export const PLAN_TOOL_NAMES = PLAN_TOOLS.map((entry) => entry.function.name);

// ---- Argument parsing ----

const blank = (value: unknown) => (value === null || (typeof value === "string" && !value.trim()) ? undefined : value);
const optText = (max: number) => z.preprocess(blank, z.string().trim().min(1).max(max).optional());
const optId = optText(64);
const optNumber = z.preprocess((value) => (value === null || value === "" ? undefined : value), z.coerce.number().finite().nonnegative().optional());
const optDate = z.preprocess(blank, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").optional());
// z.coerce.boolean() would read the string "false" as true.
const optBool = z.preprocess((value) => (value === "true" ? true : value === "false" ? false : blank(value)), z.boolean().optional());
const optArray = <T extends z.ZodTypeAny>(item: T, max: number) => z.preprocess((value) => value ?? [], z.array(item).max(max));

const lineSchema = z
  .object({
    kind: z.enum(["labour", "material", "other"]),
    description: z.string().trim().min(1).max(200),
    quantity: z.coerce.number().finite().positive().max(100000),
    // Models often leave the unit out. Hours are "hr", everything else "ea".
    unit: optText(20),
    unit_price: optNumber,
    unit_cost: optNumber,
    markup_amount: optNumber,
    price_source: optId,
  })
  .transform((line) => ({ ...line, unit: line.unit ?? (line.kind === "labour" ? "hr" : "ea") }));

const schemas = {
  find_jobs: z.object({
    query: optText(120),
    status: z.preprocess(blank, z.enum(["open", "quoted", "active", "done", "all"]).optional()),
    client_id: optId,
    has_unbilled: optBool,
  }),
  get_job: z.object({ job_id: z.string().trim().min(1).max(64) }),
  find_documents: z.object({
    doc_type: z.preprocess(blank, z.enum(["quote", "invoice"]).optional()),
    status: z.preprocess(blank, z.enum(DOCUMENT_STATUS_WORDS).optional()),
    job_id: optId,
    client_id: optId,
    number: optText(20),
    query: optText(120),
    since: optDate,
    until: optDate,
  }),
  get_document: z
    .object({ document_id: optId, number: optText(20) })
    .refine((args) => args.document_id || args.number, "Give document_id or number."),
  find_clients: z.object({ query: optText(120) }),
  search_lines: z.object({
    query: optText(120),
    kind: z.preprocess(blank, z.enum(["labour", "material", "other"]).optional()),
    job_id: optId,
    source: z.preprocess(blank, z.enum(["quoted", "invoiced", "tracked", "receipt"]).optional()),
    since: optDate,
    until: optDate,
  }),
  business_snapshot: z.object({ period: z.preprocess(blank, z.enum(["today", "week", "month"]).optional()) }),
  propose_work: z.object({
    intent: z.enum(["quote", "invoice", "log"]).nullable().optional(),
    job_id: optId,
    job_title: optText(120),
    client_id: optId,
    client_name: optText(120),
    site_address: optText(200),
    notes: optText(1000),
    lines: optArray(lineSchema, 30),
  }),
  propose_invoice: z
    .object({ job_id: optId, quote_id: optId })
    .refine((args) => Boolean(args.job_id) !== Boolean(args.quote_id), "Give exactly one of job_id or quote_id."),
  propose_document_change: z.object({
    document_id: z.string().trim().min(1).max(64),
    action: z.enum(["mark_sent", "mark_approved", "mark_declined", "mark_paid", "add_lines", "change_lines", "remove_lines", "set_details", "add_unbilled", "delete_draft"]),
    lines: optArray(lineSchema, 30),
    changes: optArray(
      z.object({
        line_id: z.string().trim().min(1).max(64),
        description: optText(200),
        quantity: z.preprocess(blank, z.coerce.number().finite().positive().max(100000).optional()),
        unit: optText(20),
        unit_price: optNumber,
        price_source: optId,
      }),
      30,
    ),
    line_ids: optArray(z.string().trim().min(1).max(64), 30),
    due_date: optDate,
    valid_until: optDate,
    notes: z.preprocess((value) => (value === null ? undefined : value), z.string().max(4000).optional()),
  }),
  propose_job_change: z.object({
    job_id: z.string().trim().min(1).max(64),
    action: z.enum(["set_status", "edit_details", "move_lines"]),
    status: z.preprocess(blank, z.enum(["quoted", "active", "done"]).optional()),
    title: optText(200),
    site_address: z.preprocess((value) => (value === null ? undefined : value), z.string().max(500).optional()),
    notes: z.preprocess((value) => (value === null ? undefined : value), z.string().max(4000).optional()),
    line_ids: optArray(z.string().trim().min(1).max(64), 50),
    to_job_id: optId,
  }),
  propose_client: z.object({
    client_id: optId,
    name: optText(200),
    email: optText(200),
    phone: optText(50),
    billing_address: optText(500),
  }),
  propose_send: z.object({ document_id: z.string().trim().min(1).max(64), reminder: optBool }),
  propose_settings: z.object({
    labour_rate: optNumber,
    markup_pct: optNumber,
    tax_rate_pct: optNumber,
    tax_label: optText(20),
    etransfer_email: optText(200),
    etransfer_note: optText(500),
  }),
  propose_undo: z.object({}).passthrough(),
  reply: z.object({ text: z.string().trim().min(1).max(2000) }),
  ask: z.object({
    question: z.string().trim().min(1).max(300),
    options: z
      .array(z.object({ label: z.string().trim().min(1).max(80), job_id: optId }))
      .max(6)
      .default([]),
  }),
} satisfies Record<string, z.ZodTypeAny>;

export type PlanToolName = keyof typeof schemas;
export type PlanToolArgs<N extends PlanToolName> = z.output<(typeof schemas)[N]>;
export type ProposeArgs = PlanToolArgs<"propose_work">;

/** The old name of propose_work. Still accepted so a model or a saved script that uses it keeps working. */
const ALIASES: Record<string, PlanToolName> = { propose: "propose_work" };

export function toolName(name: string): PlanToolName | null {
  if (name in schemas) return name as PlanToolName;
  return ALIASES[name] ?? null;
}

function readArgs(raw: string): unknown {
  try {
    return JSON.parse(raw || "{}") as unknown;
  } catch {
    return null;
  }
}

/** Parse a tool call. A rejected call says what was wrong, in words the model can act on in its next step. */
export function parseToolArgs<N extends PlanToolName>(name: N, raw: string): { ok: true; args: PlanToolArgs<N> } | { ok: false; problem: string } {
  const value = readArgs(raw);
  if (value == null) return { ok: false, problem: "The arguments were not valid JSON." };
  const parsed = schemas[name].safeParse(value);
  if (parsed.success) return { ok: true, args: parsed.data as PlanToolArgs<N> };
  return {
    ok: false,
    problem: parsed.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.join(".") || "arguments"}: ${issue.message}`)
      .join("; "),
  };
}

export function parseProposeArgs(raw: string) {
  const parsed = parseToolArgs("propose_work", raw);
  return parsed.ok ? parsed.args : null;
}

export function proposeArgsProblem(raw: string): string {
  const parsed = parseToolArgs("propose_work", raw);
  return parsed.ok ? "" : parsed.problem;
}

export function parseReplyArgs(raw: string) {
  const parsed = parseToolArgs("reply", raw);
  return parsed.ok ? parsed.args.text : null;
}

/** A short status for the tool the model just chose. */
export function statusForTool(name: string, raw: string): string {
  const resolved = toolName(name);
  switch (resolved) {
    case "find_jobs":
      return "Looking through your jobs";
    case "get_job":
      return "Opening the job";
    case "find_documents":
      return "Checking quotes and invoices";
    case "get_document":
      return "Opening the document";
    case "find_clients":
      return "Looking up the client";
    case "search_lines":
      return "Checking past prices";
    case "business_snapshot":
      return "Checking the books";
    case "reply":
      return "Writing a reply";
    case "ask":
      return "Writing a question";
    case "propose_invoice":
      return "Drafting the invoice";
    case "propose_send":
      return "Getting the email ready";
    case "propose_undo":
      return "Checking what to undo";
    case "propose_document_change":
    case "propose_job_change":
    case "propose_client":
    case "propose_settings":
      return "Drafting the change";
    case "propose_work": {
      const args = parseProposeArgs(raw);
      if (args?.intent === "quote") return "Drafting the quote";
      if (args?.intent === "invoice") return "Drafting the invoice";
      const kinds = new Set((args?.lines ?? []).map((line) => line.kind));
      if (kinds.size === 1 && kinds.has("labour")) return "Drafting the hours";
      if (kinds.has("material") || kinds.has("other")) return "Drafting the materials";
      if ((args?.lines.length ?? 0) === 0 && (args?.job_title || args?.job_id)) return "Drafting a new job";
      return "Drafting a proposal";
    }
    default:
      return "Working on it";
  }
}
