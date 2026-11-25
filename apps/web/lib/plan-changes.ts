/**
 * Changes a Plan card can make to existing paperwork. Pure: no Next, React or DB imports.
 *
 * The model fills a propose_* tool; app code turns it into one of these, stores it on the capture,
 * and only the confirm runs it, through the existing services.
 */
import { z } from "zod";

const id = z.string().trim().min(1).max(64);
const money = z.number().finite().nonnegative().max(1_000_000);

export const changeLineSchema = z.object({
  kind: z.enum(["labour", "material", "other"]),
  description: z.string().trim().min(1).max(200),
  quantity: z.number().finite().positive().max(100_000),
  unit: z.string().trim().min(1).max(20),
  unit_price: money.nullable(),
  /** Set by app code when the price came from the contractor's records. */
  source_note: z.string().max(120).nullable().optional(),
});
export type ChangeLine = z.infer<typeof changeLineSchema>;

export const lineEditSchema = z.object({
  line_id: id,
  description: z.string().trim().min(1).max(200).optional(),
  quantity: z.number().finite().positive().max(100_000).optional(),
  unit: z.string().trim().min(1).max(20).optional(),
  unit_price: money.optional(),
  source_note: z.string().max(120).nullable().optional(),
});
export type LineEdit = z.infer<typeof lineEditSchema>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const planChangeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("document_status"), document_id: id, to: z.enum(["sent", "approved", "declined", "paid"]) }),
  z.object({
    kind: z.literal("document_lines"),
    document_id: id,
    add: z.array(changeLineSchema).max(30).default([]),
    update: z.array(lineEditSchema).max(30).default([]),
    remove: z.array(id).max(30).default([]),
  }),
  z.object({
    kind: z.literal("document_details"),
    document_id: id,
    due_date: isoDate.nullable().optional(),
    valid_until: isoDate.nullable().optional(),
    notes: z.string().max(4000).optional(),
  }),
  z.object({ kind: z.literal("invoice_from_quote"), quote_id: id }),
  z.object({ kind: z.literal("add_unbilled_to_invoice"), invoice_id: id }),
  z.object({ kind: z.literal("delete_draft"), document_id: id }),
  z.object({ kind: z.literal("job_status"), job_id: id, to: z.enum(["quoted", "active", "done"]) }),
  z.object({
    kind: z.literal("job_details"),
    job_id: id,
    title: z.string().trim().min(1).max(200).optional(),
    site_address: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(4000).optional(),
  }),
  z.object({ kind: z.literal("move_lines"), job_id: id, to_job_id: id, line_ids: z.array(id).min(1).max(50) }),
  z.object({
    kind: z.literal("client"),
    client_id: id.optional(),
    name: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().max(200).optional(),
    phone: z.string().trim().max(50).optional(),
    billing_address: z.string().trim().max(500).optional(),
  }),
  z.object({ kind: z.literal("send"), document_id: id, reminder: z.boolean().default(false) }),
  z.object({
    kind: z.literal("settings"),
    labour_rate: z.number().finite().min(0).max(1000).optional(),
    markup_pct: z.number().finite().min(0).max(500).optional(),
    tax_rate_pct: z.number().finite().min(0).max(20).optional(),
    tax_label: z.string().trim().min(1).max(20).optional(),
    etransfer_email: z.string().trim().max(200).optional(),
    etransfer_note: z.string().trim().max(500).optional(),
  }),
  z.object({ kind: z.literal("undo"), capture_id: id }),
]);
export type PlanChange = z.infer<typeof planChangeSchema>;

export function parsePlanChange(value: unknown): PlanChange | null {
  const parsed = planChangeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Where "Open" on the card, and the review link for a confirmed card, should go. */
export function changeHref(change: PlanChange): string {
  switch (change.kind) {
    case "document_status":
    case "document_lines":
    case "document_details":
    case "delete_draft":
    case "send":
      return change.kind === "delete_draft" ? "/app/documents" : `/app/documents/${change.document_id}`;
    case "invoice_from_quote":
      return `/app/documents/${change.quote_id}`;
    case "add_unbilled_to_invoice":
      return `/app/documents/${change.invoice_id}`;
    case "job_status":
    case "job_details":
      return `/app/jobs/${change.job_id}`;
    case "move_lines":
      return `/app/jobs/${change.to_job_id}`;
    case "settings":
      return "/app/settings";
    case "client":
    case "undo":
      return "/app";
  }
}

/** The words a contractor reads on the status card. */
export const STATUS_VERBS: Record<string, string> = {
  sent: "sent",
  approved: "approved",
  declined: "declined",
  paid: "paid",
  quoted: "quoted",
  active: "active",
  done: "done",
};
