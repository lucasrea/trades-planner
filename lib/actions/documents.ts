"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formOptionalText, formText } from "@/lib/actions/form-data";
import { createDraftDocumentSchema, saveDocumentSchema } from "@/lib/actions/schemas";
import { getContractor } from "@/lib/auth";
import { ensureDb } from "@/lib/db";
import type { DocStatus, DocType } from "@/lib/documents";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/services/context";
import {
  addTrackedLinesToInvoice,
  createDraftDocument,
  createInvoiceFromQuote,
  createInvoiceFromTrackedLines,
  deleteDraftDocument,
  saveDocumentMeta,
  setDocumentStatus,
} from "@/lib/services/documents";

async function ctx() {
  const contractor = await getContractor();
  return { db: await ensureDb(), contractorId: contractor.id };
}

export async function createDraftDocumentAction(formData: FormData) {
  const parsed = createDraftDocumentSchema.safeParse({ jobId: formText(formData, "jobId"), type: formText(formData, "type") });
  if (!parsed.success) throw new Error("Invalid input.");
  const { id } = await createDraftDocument(await ctx(), parsed.data.jobId, parsed.data.type as DocType);
  revalidatePath("/app/documents");
  redirect(`/app/documents/${id}`);
}

export async function saveDocumentAction(_: unknown, formData: FormData) {
  const parsed = saveDocumentSchema.safeParse({ documentId: formText(formData, "documentId"), notes: formText(formData, "notes"), validUntil: formOptionalText(formData, "validUntil"), dueDate: formOptionalText(formData, "dueDate") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  try {
    await saveDocumentMeta(await ctx(), parsed.data);
    revalidatePath(`/app/documents/${parsed.data.documentId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ConflictError) return { error: error.message };
    throw error;
  }
}

export async function setDocumentStatusAction(formData: FormData) {
  const documentId = formText(formData, "documentId");
  const next = formText(formData, "next");
  if (!documentId || !next) throw new Error("Invalid input.");
  await setDocumentStatus(await ctx(), documentId, next as DocStatus);
  revalidatePath(`/app/documents/${documentId}`);
}

export async function createInvoiceFromQuoteAction(formData: FormData) {
  const quoteId = formText(formData, "quoteId");
  if (!quoteId) throw new Error("Invalid input.");
  redirect(`/app/documents/${await createInvoiceFromQuote(await ctx(), quoteId)}`);
}

export async function createInvoiceFromTrackedLinesAction(formData: FormData) {
  const jobId = formText(formData, "jobId");
  if (!jobId) throw new Error("Invalid input.");
  try {
    redirect(`/app/documents/${await createInvoiceFromTrackedLines(await ctx(), jobId)}`);
  } catch (error) {
    if (error instanceof ValidationError) redirect(`/app/jobs/${jobId}?error=nothing-to-bill`);
    throw error;
  }
}

export async function addTrackedLinesToInvoiceAction(formData: FormData) {
  const documentId = formText(formData, "documentId");
  if (!documentId) throw new Error("Invalid input.");
  await addTrackedLinesToInvoice(await ctx(), documentId);
  redirect(`/app/documents/${documentId}`);
}

export async function deleteDraftDocumentAction(formData: FormData) {
  const documentId = formText(formData, "documentId");
  if (!documentId) return;
  try {
    await deleteDraftDocument(await ctx(), documentId);
    redirect("/app/documents");
  } catch {
    return;
  }
}
