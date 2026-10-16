import { z } from "zod";

const lineKinds = ["material", "labour", "other"] as const;

export const confirmLineSchema = z.object({
  kind: z.enum(lineKinds),
  description: z.string().trim().min(1).max(500),
  quantity: z.number().positive().max(1_000_000),
  unit: z.string().trim().min(1).max(32),
  unitCost: z.number().min(0).nullable().optional(),
  unitPrice: z.number().min(0),
  jobId: z.string().min(1).optional(),
});

const clientExistingSchema = z.object({ id: z.string().min(1) });
const clientNewSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(50).optional(),
  billingAddress: z.string().trim().max(500).optional(),
});

const jobExistingSchema = z.object({ id: z.string().min(1) });
const jobNewSchema = z.object({
  title: z.string().trim().min(1).max(200),
  siteAddress: z.string().trim().max(500).optional(),
});

export const confirmCaptureSchema = z.object({
  captureId: z.string().min(1),
  createAs: z.enum(["quote", "invoice", "log"]),
  client: z.union([clientExistingSchema, clientNewSchema]).optional(),
  job: z.union([jobExistingSchema, jobNewSchema]).optional(),
  notes: z.string().trim().max(4000).optional(),
  lines: z.array(confirmLineSchema).min(1).max(100),
});

export const textCaptureBodySchema = z.object({
  text: z.string().trim().min(1).max(4000),
  jobId: z.string().min(1).optional(),
});

export type ConfirmCaptureInputParsed = z.infer<typeof confirmCaptureSchema>;
