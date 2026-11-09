"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { codeFromServiceError } from "@/lib/action-errors";
import { formText } from "@/lib/actions/form-data";
import { getContractor } from "@/lib/auth";
import { ensureDb } from "@/lib/db";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/services/context";
import { createDocumentLink, respondToSharedQuote, revokeDocumentLink } from "@/lib/services/document-links";

async function ctx() {
  const contractor = await getContractor();
  return { db: await ensureDb(), contractorId: contractor.id };
}

export async function createDocumentLinkAction(documentId: string): Promise<{ token: string } | { error: string }> {
  try {
    const token = await createDocumentLink(await ctx(), String(documentId));
    revalidatePath(`/app/documents/${documentId}`);
    return { token };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ConflictError) return { error: error.message };
    throw error;
  }
}

export async function revokeDocumentLinkAction(documentId: string): Promise<{ ok: true } | { error: string }> {
  try {
    await revokeDocumentLink(await ctx(), String(documentId));
    revalidatePath(`/app/documents/${documentId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof NotFoundError) return { error: error.message };
    throw error;
  }
}

/** Public: no session. The token is the only input that picks the document. */
export async function respondToSharedQuoteAction(formData: FormData) {
  const token = formText(formData, "token");
  const response = formText(formData, "response");
  if (response !== "approved" && response !== "declined") throw new Error("Invalid input.");
  try {
    const result = await respondToSharedQuote(await ensureDb(), token, response);
    if (result.changed) {
      revalidatePath(`/app/documents/${result.documentId}`);
      revalidatePath(`/app/jobs/${result.jobId}`);
      revalidatePath("/app/documents");
      revalidatePath("/app");
    }
  } catch (error) {
    if (error instanceof NotFoundError) redirect(`/d/${encodeURIComponent(token)}`);
    if (error instanceof ValidationError) {
      redirect(`/d/${encodeURIComponent(token)}?error=${codeFromServiceError(error)}`);
    }
    throw error;
  }
  redirect(`/d/${encodeURIComponent(token)}`);
}
