import { z } from "zod";

/** Tools the Plan model may call. The model chooses the order. */
export const PLAN_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "lookup",
      description:
        "Look up this contractor's jobs, a job's quotes and invoices, or its unbilled lines. Call this before answering a question about existing work. Use the totals in the result. Do not add them yourself.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          what: { type: "string", enum: ["jobs", "paperwork", "unbilled"] },
          job: { type: "string", description: "Job title. Omit to use the open job, or to list jobs." },
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
        additionalProperties: false,
        properties: {
          intent: { type: "string", enum: ["quote", "invoice", "log"] },
          job_title: { type: ["string", "null"] },
          client_name: { type: ["string", "null"] },
          site_address: { type: ["string", "null"] },
          notes: { type: ["string", "null"] },
          lines: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                kind: { type: "string", enum: ["labour", "material", "other"] },
                description: { type: "string" },
                quantity: { type: "number" },
                unit: { type: "string" },
                unit_price: { type: ["number", "null"] },
              },
              required: ["kind", "description", "quantity", "unit", "unit_price"],
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
        additionalProperties: false,
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

const lineSchema = z.object({
  kind: z.enum(["labour", "material", "other"]),
  description: z.string().trim().min(1).max(200),
  quantity: z.number().finite().positive().max(100000),
  unit: z.string().trim().min(1).max(20),
  unit_price: z.number().finite().nonnegative().nullable(),
});

const proposeSchema = z.object({
  intent: z.enum(["quote", "invoice", "log"]).nullable().optional(),
  job_title: z.string().trim().min(1).max(120).nullable().optional(),
  client_name: z.string().trim().min(1).max(120).nullable().optional(),
  site_address: z.string().trim().min(1).max(200).nullable().optional(),
  notes: z.string().trim().min(1).max(1000).nullable().optional(),
  lines: z.array(lineSchema).max(30),
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
