import { z } from "zod";

const LineKind = z.enum(["labour", "material", "other"]);

export const DescribeExtractionSchema = z.object({
  intent: z.enum(["quote", "invoice", "log"]).nullable(),
  client_name: z.string().nullable(),
  job_title: z.string().nullable(),
  site_address: z.string().nullable(),
  scope_notes: z.string().nullable(),
  lines: z.array(
    z.object({
      kind: LineKind,
      description: z.string(),
      quantity: z.number().positive(),
      unit: z.string(),
      unit_price: z.number().nonnegative().nullable(),
      uncertain: z.preprocess((value) => (value === undefined ? null : value), z.boolean().nullable()),
    }),
  ),
  warnings: z.array(z.string()),
});

export const ReceiptExtractionSchema = z.object({
  vendor: z.string().nullable(),
  purchased_at: z.string().nullable(),
  currency: z.string().default("CAD"),
  subtotal: z.number().nullable(),
  tax: z.number().nullable(),
  total: z.number().nullable(),
  lines: z.array(
    z.object({
      description: z.string(),
      quantity: z.number().positive(),
      unit_price: z.number().nonnegative(),
      line_total: z.number().nonnegative(),
    }),
  ),
  warnings: z.array(z.string()),
});

export type DescribeExtractionParsed = z.infer<typeof DescribeExtractionSchema>;
