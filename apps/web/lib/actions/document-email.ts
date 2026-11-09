"use server";

import { revalidatePath } from "next/cache";
import { formText } from "@/lib/actions/form-data";
import { getContractor } from "@/lib/auth";
import { ensureDb } from "@/lib/db";
import { isEmailProviderConfigured } from "@/lib/email";
import { NotFoundError, ValidationError } from "@/lib/services/context";
import { sendDocumentEmailToClient } from "@/lib/services/document-email";

const NOT_SENT = "Email was not sent.";

async function ctx() {
  const contractor = await getContractor();
  return { db: await ensureDb(), contractorId: contractor.id };
}

export async function sendDocumentEmailAction(
  _: unknown,
  formData: FormData,
): Promise<{ ok: true; message: string } | { error: string }> {
  if (!isEmailProviderConfigured()) return { error: NOT_SENT };
  const documentId = formText(formData, "documentId");
  if (!documentId) return { error: NOT_SENT };
  const authUrl = process.env.AUTH_URL?.trim();
  if (!authUrl) return { error: NOT_SENT };
  try {
    await sendDocumentEmailToClient(await ctx(), documentId, { authUrl });
    revalidatePath(`/app/documents/${documentId}`);
    return { ok: true, message: "Email sent." };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) return { error: NOT_SENT };
    if (error instanceof Error) return { error: NOT_SENT };
    throw error;
  }
}
