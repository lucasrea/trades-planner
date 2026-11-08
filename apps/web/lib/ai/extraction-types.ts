/** Display-only shapes for capture review (T24). Zod validation arrives in T28. */

export type DescribeLine = {
  kind: "labour" | "material" | "other";
  description: string;
  quantity: number;
  unit: string;
  unit_price: number | null;
  uncertain?: boolean | null;
};

export const PLAN_ACTIONS = ["create_job", "add_materials", "log_hours", "make_quote", "make_invoice"] as const;
export type PlanAction = (typeof PLAN_ACTIONS)[number];

export type DescribeExtraction = {
  intent: "quote" | "invoice" | "log" | null;
  client_name: string | null;
  job_title: string | null;
  site_address: string | null;
  scope_notes: string | null;
  lines: DescribeLine[];
  warnings: string[];
  /** Plan proposal fields, set by app code (never by the model). */
  action?: PlanAction | null;
  job_id?: string | null;
  client_id?: string | null;
};

export type ReceiptLine = {
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  jobId?: string | null;
};

export type ReceiptExtraction = {
  vendor: string | null;
  purchased_at: string | null;
  currency?: string;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  lines: ReceiptLine[];
  warnings: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function parseDescribeExtraction(value: unknown): DescribeExtraction | null {
  if (!isRecord(value) || !Array.isArray(value.lines)) return null;
  const intent = value.intent;
  if (intent != null && intent !== "quote" && intent !== "invoice" && intent !== "log") return null;
  return {
    intent: intent ?? null,
    client_name: typeof value.client_name === "string" ? value.client_name : null,
    job_title: typeof value.job_title === "string" ? value.job_title : null,
    site_address: typeof value.site_address === "string" ? value.site_address : null,
    scope_notes: typeof value.scope_notes === "string" ? value.scope_notes : null,
    lines: value.lines as DescribeLine[],
    warnings: Array.isArray(value.warnings) ? value.warnings.filter((w): w is string => typeof w === "string") : [],
    action: PLAN_ACTIONS.find((action) => action === value.action) ?? null,
    job_id: typeof value.job_id === "string" ? value.job_id : null,
    client_id: typeof value.client_id === "string" ? value.client_id : null,
  };
}

export function parseReceiptExtraction(value: unknown): ReceiptExtraction | null {
  if (!isRecord(value) || !Array.isArray(value.lines)) return null;
  return {
    vendor: typeof value.vendor === "string" ? value.vendor : null,
    purchased_at: typeof value.purchased_at === "string" ? value.purchased_at : null,
    currency: typeof value.currency === "string" ? value.currency : "CAD",
    subtotal: typeof value.subtotal === "number" ? value.subtotal : null,
    tax: typeof value.tax === "number" ? value.tax : null,
    total: typeof value.total === "number" ? value.total : null,
    lines: value.lines as ReceiptLine[],
    warnings: Array.isArray(value.warnings) ? value.warnings.filter((w): w is string => typeof w === "string") : [],
  };
}
