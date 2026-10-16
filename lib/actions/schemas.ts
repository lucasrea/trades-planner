import { z } from "zod";

export const saveClientSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  billingAddress: z.string().optional(),
});

const jobStatuses = ["quoted", "active", "done"] as const;

export const saveJobSchema = z
  .object({
    title: z.string().trim().min(1),
    siteAddress: z.string().optional(),
    notes: z.string().optional(),
    clientId: z.string().optional(),
    clientName: z.string().optional(),
    clientEmail: z.string().optional(),
    clientPhone: z.string().optional(),
    clientBillingAddress: z.string().optional(),
  })
  .refine((v) => v.clientId || v.clientName?.trim(), { message: "Pick or create a client." });

export const setJobStatusSchema = z.object({
  jobId: z.string().min(1),
  status: z.enum(jobStatuses),
});

const lineKinds = ["material", "labour", "other"] as const;

export const saveLineItemSchema = z.object({
  id: z.string().optional(),
  jobId: z.string().min(1),
  documentId: z.string().optional().nullable(),
  kind: z.enum(lineKinds),
  description: z.string().trim().min(1),
  quantity: z.coerce.number().gt(0),
  unit: z.string().trim().min(1),
  unitPrice: z.coerce.number().min(0),
});

export const createDraftDocumentSchema = z.object({
  jobId: z.string().min(1),
  type: z.enum(["quote", "invoice"]),
});

export const saveDocumentSchema = z.object({
  documentId: z.string().min(1),
  notes: z.string().optional(),
  validUntil: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});
