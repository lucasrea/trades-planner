"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { formOptionalText, formText } from "@/lib/actions/form-data";
import { saveLineItemSchema } from "@/lib/actions/schemas";
import { getContractor } from "@/lib/auth";
import { ensureDb } from "@/lib/db";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/services/context";
import { deleteLine, saveDocumentLine, saveTrackedLine } from "@/lib/services/line-items";

const deleteLineItemSchema = z.object({ id: z.string().min(1), jobId: z.string().min(1), documentId: z.string().optional() });

async function ctx() {
  const contractor = await getContractor();
  return { db: await ensureDb(), contractorId: contractor.id };
}

export async function saveLineItemAction(_: unknown, formData: FormData) {
  const parsed = saveLineItemSchema.safeParse({
    id: formText(formData, "id") || undefined,
    jobId: formText(formData, "jobId"),
    documentId: formOptionalText(formData, "documentId"),
    kind: formText(formData, "kind") || "material",
    description: formText(formData, "description"),
    quantity: formData.get("quantity"),
    unit: formText(formData, "unit") || "ea",
    unitPrice: formData.get("unitPrice"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  try {
    const input = { ...parsed.data, unitPrice: parsed.data.unitPrice };
    if (parsed.data.documentId) await saveDocumentLine(await ctx(), { ...input, documentId: parsed.data.documentId });
    else await saveTrackedLine(await ctx(), input);
    revalidatePath(`/app/jobs/${parsed.data.jobId}`);
    if (parsed.data.documentId) revalidatePath(`/app/documents/${parsed.data.documentId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError || error instanceof ConflictError) return { error: error.message };
    throw error;
  }
}

export async function deleteLineItemAction(formData: FormData) {
  const parsed = deleteLineItemSchema.safeParse({ id: formText(formData, "id"), jobId: formText(formData, "jobId"), documentId: formText(formData, "documentId") || undefined });
  if (!parsed.success) return;
  try {
    await deleteLine(await ctx(), parsed.data.id);
    revalidatePath(`/app/jobs/${parsed.data.jobId}`);
    if (parsed.data.documentId) revalidatePath(`/app/documents/${parsed.data.documentId}`);
  } catch {
    return;
  }
}
