import { z } from "zod";

/** Tools the Plan model may call. The model chooses the order. */
export const PLAN_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "lookup",
      description:
        "Look up this contractor's jobs, a job's quotes and invoices, or unbilled work (for one job or across all jobs when job is omitted). Call this before answering a question about existing work. Use the totals in the result. Do not add them yourself.",
      parameters: {
        type: "object",
        properties: {
          what: { type: "string", enum: ["jobs", "paperwork", "unbilled"] },
          job: { type: "string", description: "Job title. Omit to use the open job, list all jobs, or check unbilled work across all jobs." },
        },
        required: ["what"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "propose",
      description:
        "Show one card for the contractor to confirm. Call once per action. Hours and materials are two calls. Two jobs are two calls. A quote or an invoice is one call and may include both. This does not save anything.",
      parameters: {
        type: "object",
        properties: {
          intent: { type: "string", enum: ["quote", "invoice", "log"] },
          job_title: { type: "string" },
          client_name: { type: "string" },
          site_address: { type: "string" },
          notes: { type: "string" },
          lines: {
            type: "array",
            items: {
              type: "object",
              properties: {
                kind: { type: "string", enum: ["labour", "material", "other"] },
                description: { type: "string" },
                quantity: { type: "number" },
                unit: { type: "string" },
                unit_price: { type: "number", description: "Sell price. Omit when unit_cost and markup_amount are set." },
                unit_cost: { type: "number", description: "What it cost the contractor, before markup." },
                markup_amount: { type: "number", description: "Dollars to add to unit_cost. The app computes the sell price." },
              },
              required: ["kind", "description", "quantity", "unit"],
            },
          },
        },
        required: ["intent", "lines"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "reply",
      description: "Say something in plain text when no card is needed, or add a short note after the cards.",
      parameters: {
        type: "object",
        properties: { text: { type: "string" } },
        required: ["text"],
      },
    },
  },
];

const lookupSchema = z.object({
  what: z.enum(["jobs", "paperwork", "unbilled"]),
  job: z.string().trim().min(1).max(120).nullable().optional(),
});

const optionalNumber = z.preprocess(
  (value) => (value === null || value === "" ? undefined : value),
  z.coerce.number().finite().nonnegative().optional(),
);

const blankToUndefined = (value: unknown) => (value === null || (typeof value === "string" && !value.trim()) ? undefined : value);

const lineSchema = z
  .object({
    kind: z.enum(["labour", "material", "other"]),
    description: z.string().trim().min(1).max(200),
    quantity: z.coerce.number().finite().positive().max(100000),
    // Models often leave the unit out. Hours are "hr", everything else "ea".
    unit: z.preprocess(blankToUndefined, z.string().trim().min(1).max(20).optional()),
    unit_price: optionalNumber,
    unit_cost: optionalNumber,
    markup_amount: optionalNumber,
  })
  .transform((line) => ({ ...line, unit: line.unit ?? (line.kind === "labour" ? "hr" : "ea") }));

const proposeSchema = z.object({
  intent: z.enum(["quote", "invoice", "log"]).nullable().optional(),
  job_title: z.string().trim().min(1).max(120).nullable().optional(),
  client_name: z.string().trim().min(1).max(120).nullable().optional(),
  site_address: z.string().trim().min(1).max(200).nullable().optional(),
  notes: z.string().trim().min(1).max(1000).nullable().optional(),
  lines: z.preprocess((value) => value ?? [], z.array(lineSchema).max(30)),
});

const replySchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

export type LookupArgs = z.infer<typeof lookupSchema>;
export type ProposeArgs = z.infer<typeof proposeSchema>;

function readArgs(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function parseLookupArgs(raw: string) {
  const parsed = lookupSchema.safeParse(readArgs(raw));
  return parsed.success ? parsed.data : null;
}

export function parseProposeArgs(raw: string) {
  const parsed = proposeSchema.safeParse(readArgs(raw));
  return parsed.success ? parsed.data : null;
}

/** Why a propose call was rejected, in words the model can act on in its next step. */
export function proposeArgsProblem(raw: string): string {
  const value = readArgs(raw);
  if (value == null) return "The arguments were not valid JSON.";
  const parsed = proposeSchema.safeParse(value);
  if (parsed.success) return "";
  return parsed.error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join(".") || "arguments"}: ${issue.message}`)
    .join("; ");
}

export function parseReplyArgs(raw: string) {
  const parsed = replySchema.safeParse(readArgs(raw));
  return parsed.success ? parsed.data.text : null;
}

/** A short status for the tool the model just chose. */
export function statusForTool(name: string, raw: string): string {
  if (name === "lookup") {
    const args = parseLookupArgs(raw);
    const job = args?.job?.trim();
    if (args?.what === "jobs") return "Looking through your jobs";
    if (args?.what === "unbilled") return job ? `Checking unbilled work on ${job}` : "Checking unbilled work";
    return job ? `Checking quotes and invoices on ${job}` : "Checking quotes and invoices";
  }
  if (name === "reply") return "Writing a reply";
  if (name === "propose") {
    const args = parseProposeArgs(raw);
    if (args?.intent === "quote") return "Drafting the quote";
    if (args?.intent === "invoice") return "Drafting the invoice";
    const kinds = new Set((args?.lines ?? []).map((line) => line.kind));
    if (kinds.size === 1 && kinds.has("labour")) return "Drafting the hours";
    if (kinds.has("material") || kinds.has("other")) return "Drafting the materials";
    if ((args?.lines.length ?? 0) === 0 && args?.job_title) return "Drafting a new job";
    return "Drafting a proposal";
  }
  return "Working on it";
}
